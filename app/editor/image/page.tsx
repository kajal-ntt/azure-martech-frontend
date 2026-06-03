"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import EditorLayout, {
  type Creative,
  type BrandKit,
  type EditorLayoutRef,
} from "../../../components/editor/EditorLayout";
import { type LayerDef } from "../../../components/editor/EditorCanvas";
import { uploadEditedImage } from "../../../lib/api/editor";

type PageState = "loading" | "error" | "ready";

interface Toast {
  message: string;
  type: "success" | "error";
}

interface EditorLoadResult {
  creative: any;
  signedUrl: string;
  brandKit: BrandKit | null;
  logoUrl: string | null;
}

/** Convert a GCS or storage URL to a proxied URL safe for browser rendering */
function toProxyUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("gs://") || raw.startsWith("https://storage.googleapis.com/")) {
    const https = raw.startsWith("gs://")
      ? raw.replace("gs://", "https://storage.googleapis.com/")
      : raw;
    return `/api/image-proxy?url=${encodeURIComponent(https)}`;
  }
  return raw;
}

function getBackgroundLayer(creative: any, signedUrl: string): LayerDef | null {
  // For already-generated IMAGE creatives, always use the signedUrl (the actual
  // generated image) as the background — not the guided background URL which
  // may point to a source reference instead of the final output.
  const bgUrl = signedUrl || creative.guidedBackgroundUrl;
  if (!bgUrl) return null;

  return { id: "background", label: "Background", type: "background", url: bgUrl };
}

function getBandConfig(creative: any, brandKit: any) {
  const defaultConfig = {
    bandColor: brandKit?.primaryColor || "#1E3A5F",
    heightPct: 0.08,
  };

  if (!creative.textUrl) return defaultConfig;

  try {
    const cfg = JSON.parse(creative.textUrl);
    return {
      bandColor: cfg.bandColor || defaultConfig.bandColor,
      heightPct: cfg.heightPct || defaultConfig.heightPct,
    };
  } catch {
    return defaultConfig;
  }
}

function getHeadlineText(creative: any): string {
  if (Array.isArray(creative.headlines) && creative.headlines.length > 0) {
    return creative.headlines[0];
  }

  return "Your Headline Here";
}

function getCaptionText(creative: any): string {
  if (creative.adCopy && creative.adCopy.length <= 300) {
    return creative.adCopy;
  }

  return "Your caption here";
}

function buildEditableLayers(creative: any, brandKit: any, logoUrl: string | null): LayerDef[] {
  const { bandColor, heightPct } = getBandConfig(creative, brandKit);
  const layers: LayerDef[] = [
    {
      id: "bottom-band",
      label: "Bottom Band",
      type: "shape",
      text: JSON.stringify({ color: bandColor, heightPct }),
    },
    { id: "headline", label: "Headline", type: "text", text: getHeadlineText(creative), top: 200 },
    { id: "caption", label: "Caption", type: "text", text: getCaptionText(creative), top: 768 },
  ];

  if (logoUrl) {
    layers.splice(1, 0, { id: "logo", label: "Logo", type: "logo", url: logoUrl });
  }

  return layers;
}

function parseJsonArray(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseBrandKitResponse(kitData: any): BrandKit | null {
  const rawKit = kitData?.brandKit ?? kitData ?? null;
  if (!rawKit) return null;

  return {
    brandId: rawKit.brandId,
    fonts: parseJsonArray(rawKit.fonts),
    primaryColor: rawKit.primaryColor || null,
    secondaryColor: rawKit.secondaryColor || null,
    accentColor: rawKit.accentColor || null,
    logos: parseJsonArray(rawKit.logos),
  };
}

async function fetchSignedCreativeUrl(creativeId: string, response: Response): Promise<string> {
  if (!response.ok) return "";

  const urlData = await response.json();
  return urlData.url ?? "";
}

async function fetchBrandLogoUrl(brandId: string | undefined): Promise<string | null> {
  if (!brandId) return null;

  try {
    const logoRes = await fetch(`/api/brands/${brandId}/logo-url`);
    if (!logoRes.ok) return null;

    const logoData = await logoRes.json();
    const raw = logoData.url ?? null;
    if (!raw) return null;

    const publicUrl = raw.startsWith("gs://")
      ? raw.replace("gs://", "https://storage.googleapis.com/")
      : raw.replace("https://storage.cloud.google.com/", "https://storage.googleapis.com/");

    return `/api/image-proxy?url=${encodeURIComponent(publicUrl)}`;
  } catch {
    return null;
  }
}

async function loadEditorData(creativeId: string, campaignId: string): Promise<EditorLoadResult | null> {
  console.log("[Editor] Loading data for creative:", creativeId, "campaign:", campaignId);

  const [creativeRes, signedUrlRes, brandKitRes] = await Promise.all([
    fetch(`/api/creatives/${creativeId}`),
    fetch(`/api/creatives/${creativeId}/signed-url`),
    fetch(`/api/campaigns/${campaignId}/brand-kit`),
  ]);

  console.log("[Editor] Brand kit response status:", brandKitRes.status, brandKitRes.ok);
  if (!creativeRes.ok) return null;

  const creativeData = await creativeRes.json();
  const rawCreative = creativeData.creative ?? creativeData;
  const signedUrl = await fetchSignedCreativeUrl(creativeId, signedUrlRes);

  let kit: BrandKit | null = null;
  if (brandKitRes.ok) {
    const kitData = await brandKitRes.json();
    console.log("[Editor] Raw brand kit response:", kitData);
    kit = parseBrandKitResponse(kitData);
    if (kit) {
      console.log("[Editor] Parsed brand kit:", kit);
      console.log("[Editor] Fonts array:", kit.fonts);
      console.log("[Editor] Colors:", {
        primary: kit.primaryColor,
        secondary: kit.secondaryColor,
        accent: kit.accentColor,
      });
    }
  }

  const brandId = (kit as any)?.brandId;
  const logoUrl = await fetchBrandLogoUrl(brandId) ?? toProxyUrl(rawCreative.guidedLogoUrl);

  return {
    creative: {
      ...rawCreative,
      // Ensure aspectRatio is always present so EditorLayout sets canvas dimensions correctly
      aspectRatio: rawCreative.aspectRatio ?? null,
    },
    signedUrl,
    brandKit: kit,
    logoUrl,
  };
}

/** Build layer definitions from a creative''s guided fields + brand kit fallbacks */
function buildLayers(creative: any, signedUrl: string, brandKit: any, logoUrl: string | null): LayerDef[] {
  const layers: LayerDef[] = [];
  const backgroundLayer = getBackgroundLayer(creative, signedUrl);

  if (backgroundLayer) {
    layers.push(backgroundLayer);
  }

  if (creative.isEdited === true) {
    return layers;
  }

  layers.push(...buildEditableLayers(creative, brandKit, logoUrl));
  return layers;
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950" />}>
      <EditorContent />
    </Suspense>
  );
}

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const creativeId = searchParams.get("creativeId") ?? "";
  const campaignId = searchParams.get("campaignId") ?? "";
  const { isPending, isAuthenticated } = useAuthGuard();

  const editorRef = useRef<EditorLayoutRef>(null);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [creative, setCreative] = useState<Creative | null>(null);
  const [layers, setLayers] = useState<LayerDef[]>([]);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Debug auth state
  useEffect(() => {
    console.log('[editor] Auth state:', { isPending, isAuthenticated });
  }, [isPending, isAuthenticated]);

  // Clean up history to ensure back button goes to campaign dashboard
  useEffect(() => {
    if (!campaignId) return;

    // Replace the current history entry to set a clean state
    // This ensures that when user clicks back from editor, they go to campaign dashboard
    const currentUrl = globalThis.location.href;
    const campaignUrl = `/campaigns/${campaignId}`;

    // Store the campaign URL as the referrer
    globalThis.history.replaceState(
      { from: campaignUrl, cleanHistory: true },
      "",
      currentUrl
    );
  }, [campaignId]);

  useEffect(() => {
    if (!creativeId || !campaignId) { setPageState("error"); return; }
    let cancelled = false;

    async function loadData() {
      try {
        const result = await loadEditorData(creativeId, campaignId);
        if (cancelled) return;
        if (!result) { setPageState("error"); return; }

        setCreative(result.creative);
        setLayers(buildLayers(result.creative, result.signedUrl, result.brandKit, result.logoUrl));
        setBrandKit(result.brandKit);
        setPageState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load editor data:", err);
        setPageState("error");
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [creativeId, campaignId]);

  const handleDirty = useCallback(() => setIsDirty(true), []);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const blob = await editorRef.current!.exportBlob();
      const newCreative = await uploadEditedImage(creativeId, blob);
      showToast("Creative saved successfully. Redirecting to preview...", "success");

      // Replace current history entry and redirect to preview page with the NEW creative ID
      // Add fromEditor=true flag to indicate this is coming from editor save
      // This prevents multiple back button presses
      setTimeout(() => {
        globalThis.history.replaceState(null, "", `/preview/image?campaignId=${campaignId}&creativeId=${newCreative.id}&fromEditor=true`);
        router.replace(`/preview/image?campaignId=${campaignId}&creativeId=${newCreative.id}&fromEditor=true`);
      }, 1200);
    } catch (err) {
      console.error("Failed to save changes:", err);
      showToast("Failed to save changes. Please try again.", "error");
    }
  }, [creativeId, campaignId, router, showToast]);

  const handleCancel = useCallback(() => {
    router.push(`/campaigns/${campaignId}`);
  }, [router, campaignId]);

  if (isPending) return <div className="flex min-h-screen items-center justify-center"><div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

  if (pageState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="animate-spin" size={36} />
          <p className="text-sm font-medium">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (pageState === "error" || !creative) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4 text-zinc-500">
          <p className="text-base font-semibold text-zinc-800">Failed to load creative</p>
          <p className="text-sm text-zinc-400">The creative could not be found or you don&apos;t have access.</p>
          <button onClick={() => router.back()}
            className="mt-2 px-5 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <EditorLayout
        ref={editorRef}
        creative={creative}
        layers={layers}
        brandKit={brandKit}
        isDirty={isDirty}
        onDirty={handleDirty}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
