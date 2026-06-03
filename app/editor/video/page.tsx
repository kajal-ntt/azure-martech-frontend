"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useVideoOverlays } from "@/hooks/useVideoOverlays";

// VideoOverlayEditor depends on react-konva + @ffmpeg/ffmpeg — both need browser APIs
const VideoOverlayEditor = dynamic(
  () => import("@/components/video/VideoOverlayEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-zinc-900">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 size={32} className="animate-spin text-[#4CAF31]" />
          <span className="text-sm">Loading editor…</span>
        </div>
      </div>
    ),
  }
);

export default function VideoEditorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950" />}>
      <VideoEditorContent />
    </Suspense>
  );
}

function VideoEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? "";
  const creativeId = searchParams.get("creativeId") ?? "";
  const { isPending, isAuthenticated } = useAuthGuard();

  // ── Creative / signed URL ─────────────────────────────────────────────────
  const [creative, setCreative] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Video intrinsic dimensions ────────────────────────────────────────────
  const [videoIntrinsicWidth, setVideoIntrinsicWidth] = useState(1920);
  const [videoIntrinsicHeight, setVideoIntrinsicHeight] = useState(1080);
  const [duration, setDuration] = useState(0);

  // ── Hidden video element to read intrinsic dimensions + duration ──────────
  const metaVideoRef = useRef<HTMLVideoElement | null>(null);

  // ── Load video metadata (intrinsic size + duration) ──────────────────────
  useEffect(() => {
    if (!creative?.signedUrl) return;
    const vid = document.createElement("video");
    metaVideoRef.current = vid;
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      if (vid.videoWidth > 0) setVideoIntrinsicWidth(vid.videoWidth);
      if (vid.videoHeight > 0) setVideoIntrinsicHeight(vid.videoHeight);
      if (vid.duration && !Number.isNaN(vid.duration)) setDuration(vid.duration);
    };
    vid.src = creative.signedUrl;
    return () => { vid.src = ""; metaVideoRef.current = null; };
  }, [creative?.signedUrl]);

  // ── Overlay state ─────────────────────────────────────────────────────────
  const {
    overlays,
    selectedId,
    addLogoOverlay,
    addTextOverlay,
    addShapeOverlay,
    addImageOverlay,
    updateOverlay,
    deleteOverlay,
    selectOverlay,
    reorderOverlay,
    duplicateOverlay,
    addShapeWithType,
    addBadgeOverlay,
  } = useVideoOverlays(duration);

  // ── Fetch creative + signed URL ───────────────────────────────────────────
  useEffect(() => {
    if (!creativeId) {
      setLoadError("No creative ID provided.");
      return;
    }

    async function load() {
      try {
        // Fetch the creative record
        const creativeRes = await fetch(`/api/creatives/${creativeId}`);
        if (!creativeRes.ok) throw new Error(`Creative not found (${creativeRes.status})`);
        const creativeData = await creativeRes.json();
        const c = creativeData.creative ?? creativeData;

        // Fetch signed URL
        const signedRes = await fetch(`/api/creatives/${creativeId}/signed-url`);
        if (!signedRes.ok) throw new Error("Could not get signed URL");
        const signedData = await signedRes.json();
        const signedUrl = signedData.url ?? null;

        if (!signedUrl) throw new Error("Video URL not available yet");

        setCreative({ ...c, signedUrl });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load video");
      }
    }

    load();
  }, [creativeId]);

  // ── After save: navigate to preview with new creative ID ─────────────────
  const handleSaved = useCallback(
    (newCreativeId: string) => {
      router.push(`/preview/video?campaignId=${campaignId}&creativeId=${newCreativeId}`);
    },
    [router, campaignId]
  );

  // ── Cancel: go back to preview ────────────────────────────────────────────
  const handleClose = useCallback(() => {
    router.push(`/preview/video?campaignId=${campaignId}&creativeId=${creativeId}`);
  }, [router, campaignId, creativeId]);

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900">
        <div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

  // ── Error state ───────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900 text-white">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <p className="text-red-400 font-semibold">{loadError}</p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-zinc-700 rounded-lg text-sm hover:bg-zinc-600 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!creative) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 size={32} className="animate-spin text-[#4CAF31]" />
          <span className="text-sm">Loading video…</span>
        </div>
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-900">
      <VideoOverlayEditor
        videoSrc={creative.signedUrl}
        creativeId={creative.id}
        campaignId={campaignId}
        videoDuration={duration}
        videoIntrinsicWidth={videoIntrinsicWidth}
        videoIntrinsicHeight={videoIntrinsicHeight}
        overlays={overlays}
        selectedId={selectedId}
        onAddTextOverlay={addTextOverlay}
        onAddShapeOverlay={addShapeOverlay}
        onAddShapeWithType={addShapeWithType}
        onAddBadgeOverlay={addBadgeOverlay}
        onAddLogoOverlay={addLogoOverlay}
        onAddImageOverlay={addImageOverlay}
        onUpdateOverlay={updateOverlay}
        onDeleteOverlay={deleteOverlay}
        onSelectOverlay={selectOverlay}
        onReorderOverlay={reorderOverlay}
        onDuplicateOverlay={duplicateOverlay}
        onSaved={handleSaved}
        onClose={handleClose}
      />
    </div>
  );
}
