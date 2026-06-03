"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2, Type, Download, X, AlertCircle, Play, Pause, SkipBack,
  ImagePlus, Square, Sparkles, Search,
} from "lucide-react";
import { useFFmpegCompositor } from "@/hooks/useFFmpegCompositor";
import OverlayLayersPanel from "@/components/video/OverlayLayersPanel";
import OverlayPropertiesPanel from "@/components/video/OverlayPropertiesPanel";
import dynamic from "next/dynamic";
import { SHAPE_LIBRARY, SHAPE_CATEGORIES } from "@/lib/shapes";

const OverlayCanvas = dynamic(
  () => import("@/components/video/OverlayCanvas"),
  { ssr: false }
);

// ─── Overlay Data Model ───────────────────────────────────────────────────────

/** Controls when an overlay is visible during playback */
export interface TimelineWindow {
  readonly inPoint: number;
  readonly outPoint: number;
}

// ─── Animation types ──────────────────────────────────────────────────────────

/** Entrance animation — plays once when the overlay first appears */
export type EntranceAnimation =
  | "none"
  | "fade-in"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "bounce-in"
  | "flip-in";

/** Loop animation — plays continuously while the overlay is visible */
export type LoopAnimation =
  | "none"
  | "spin"
  | "pulse"
  | "float"
  | "shake"
  | "bounce"
  | "swing"
  | "blink";

export interface OverlayAnimation {
  readonly entrance: EntranceAnimation;
  readonly entranceDuration: number;
  readonly loop: LoopAnimation;
  readonly loopSpeed: number;
}

/** Base fields shared by all overlay types */
export interface BaseOverlay {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly timeline: TimelineWindow;
  readonly animation?: OverlayAnimation;
}


/** Logo (image) overlay — brand logo, fixed position */
export interface LogoOverlay extends BaseOverlay {
  type: "logo";
  src: string;                          // proxied URL (via /api/image-proxy)
  width: number;                        // canvas pixels
  height: number;                       // canvas pixels
  opacity: number;                      // 0–1
  konvaImage: HTMLImageElement | null;  // loaded Image object for Konva
}

/** Image overlay — user-uploaded image with full styling controls */
export interface ImageOverlay extends BaseOverlay {
  type: "image";
  src: string;                          // data URL or proxied URL
  width: number;                        // canvas pixels
  height: number;                       // canvas pixels
  opacity: number;                      // 0–1
  // Border/frame
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;                 // corner radius in pixels
  // Flip
  flipX: boolean;
  flipY: boolean;
  konvaImage: HTMLImageElement | null;
}

/** Text overlay */
export interface TextOverlay extends BaseOverlay {
  type: "text";
  text: string;
  fontFamily: string;   // e.g. "Arial", "Inter"
  fontSize: number;     // canvas pixels
  fill: string;         // CSS color string, e.g. "#ffffff"
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  underline: boolean;
  textAlign: "left" | "center" | "right";
  opacity: number;      // 0–1
  lineHeight: number;   // multiplier, e.g. 1.2
  letterSpacing: number;// pixels between chars
  // Measured dimensions — written back by TextNode after Konva renders
  width?: number;
  height?: number;
  // Shadow effect
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  // Outline effect
  outlineEnabled: boolean;
  outlineColor: string;
  outlineWidth: number;
  // Highlight/background effect
  highlightEnabled: boolean;
  highlightColor: string;
  highlightPadding: number;
}

/** Shape overlay (rectangle/box) */
export interface ShapeOverlay extends BaseOverlay {
  type: "shape";
  shapeType: "rectangle" | "circle" | "badge" | "library";
  width: number;        // canvas pixels
  height: number;       // canvas pixels
  fill: string;         // CSS color string (solid or gradient start)
  fillType: "solid" | "linear" | "radial";
  gradientEnd?: string; // CSS color for gradient end
  gradientAngle?: number; // degrees, for linear gradient
  gradientFocalRadius?: number; // 0–1, for radial: 0=tight center, 1=full radius
  opacity: number;      // 0–1
  cornerRadius: number; // pixels, 0 = sharp corners (rectangle only)
  // Border properties
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dashed";
  // Badge-specific properties
  badgeText?: string;
  badgePreset?: "50off" | "new" | "limited" | "sale" | "custom";
  shapeLibraryId?: string; // id from SHAPE_LIBRARY
  shapePath?: string;      // SVG path data
}

/** Union type for all overlay variants */
export type Overlay = LogoOverlay | TextOverlay | ShapeOverlay | ImageOverlay;
export type ReorderDirection = "up" | "down" | "top" | "bottom";

// ─── Component Props ──────────────────────────────────────────────────────────

export interface VideoOverlayEditorProps {
  readonly videoSrc: string;
  readonly creativeId: string;
  readonly campaignId: string;
  readonly videoDuration: number;
  readonly videoIntrinsicWidth: number;
  readonly videoIntrinsicHeight: number;
  readonly overlays: Overlay[];
  readonly selectedId: string | null;
  readonly onAddTextOverlay: (stageWidth: number, stageHeight: number) => void;
  readonly onAddShapeOverlay: (stageWidth: number, stageHeight: number) => void;
  readonly onAddShapeWithType?: (stageWidth: number, stageHeight: number, shapeId: string, shapePath: string, shapeLabel: string) => void;
  readonly onAddBadgeOverlay?: (stageWidth: number, stageHeight: number, badgeText: string, badgeColor: string) => void;
  readonly onAddLogoOverlay: (src: string, image: HTMLImageElement) => void;
  readonly onAddImageOverlay: (src: string, image: HTMLImageElement) => void;
  readonly onUpdateOverlay: (id: string, patch: Partial<Overlay>) => void;
  readonly onDeleteOverlay: (id: string) => void;
  readonly onSelectOverlay: (id: string | null) => void;
  readonly onReorderOverlay?: (id: string, direction: ReorderDirection) => void;
  readonly onDuplicateOverlay?: (id: string) => void;
  readonly onSaved: (newCreativeId: string) => void;
  readonly onClose: () => void;
}

export interface OverlayCanvasProps {
  readonly overlays: Overlay[];
  readonly selectedId: string | null;
  readonly currentTime: number;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly onSelect: (id: string | null) => void;
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
}

export interface OverlayPropertiesPanelProps {
  overlay: Overlay | null; // null when nothing is selected
  videoDuration: number;
  brandColors: string[];   // Preset color options from brand kit
  stageWidth: number;      // Canvas width for alignment calculations
  stageHeight: number;     // Canvas height for alignment calculations
  onUpdate: (id: string, patch: Partial<Overlay>) => void;
  onAddLogoOverlay: (src: string, image: HTMLImageElement) => void;
}

export interface OverlayLayersPanelProps {
  readonly overlays: Overlay[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onReorder?: (id: string, direction: ReorderDirection) => void;
  readonly onDuplicate?: (id: string) => void;
}

// ─── Hook Return Types ────────────────────────────────────────────────────────
export interface UseVideoOverlaysReturn {
  overlays: Overlay[];
  selectedId: string | null;
  addLogoOverlay: (src: string, image: HTMLImageElement) => void;
  addTextOverlay: (stageWidth: number, stageHeight: number) => void;
  addShapeOverlay: (stageWidth: number, stageHeight: number) => void;
  addShapeWithType?: (stageWidth: number, stageHeight: number, shapeId: string, shapePath: string, shapeLabel: string) => void;
  addBadgeOverlay?: (stageWidth: number, stageHeight: number, badgeText: string, badgeColor: string) => void;
  addImageOverlay: (src: string, image: HTMLImageElement) => void;
  updateOverlay: (id: string, patch: Partial<Overlay>) => void;
  deleteOverlay: (id: string) => void;
  selectOverlay: (id: string | null) => void;
  reorderOverlay?: (id: string, direction: "up" | "down" | "top" | "bottom") => void;
  duplicateOverlay?: (id: string) => void;
}

export interface UseFFmpegCompositorReturn {
  isLoading: boolean;    // FFmpeg WASM is loading
  isProcessing: boolean; // FFmpeg exec is running
  error: string | null;
  composite: (params: CompositeParams) => Promise<Blob | null>;
}

export interface CompositeParams {
  videoSrc: string;            // Signed URL to fetch source video
  overlays: Overlay[];
  stageWidth: number;          // Rendered canvas width (for scale factor)
  stageHeight: number;         // Rendered canvas height (for scale factor)
  videoIntrinsicWidth: number;
  videoIntrinsicHeight: number;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface BrandKit {
  id: string;
  brandId: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logos: string[];  // Array of logo URLs (GCS or public)
  fonts: Array<{ name: string; weight: number }>;
}

export interface SaveAsNewResponse {
  id: string;
  campaignId: string;
  status: string;
  url: string | null;
  type: string;
}

type SaveStage = "idle" | "compositing" | "uploading" | "done";

async function fetchCampaignBrandKit(campaignId: string): Promise<BrandKit | null> {
  const res = await fetch(`/api/campaigns/${campaignId}/brand-kit`);
  if (!res.ok) throw new Error(`Brand kit fetch failed: ${res.status}`);

  const data = await res.json();
  return data.brandKit ?? data ?? null;
}

function normalizeLogoUrl(raw: string) {
  const httpsUrl = raw.startsWith("gs://")
    ? raw.replace("gs://", "https://storage.googleapis.com/")
    : raw.replace("https://storage.cloud.google.com/", "https://storage.googleapis.com/");
  return `/api/image-proxy?url=${encodeURIComponent(httpsUrl)}`;
}

async function fetchBrandLogoUrl(brandId: string): Promise<string | null> {
  const logoRes = await fetch(`/api/brands/${brandId}/logo-url`);
  if (!logoRes.ok) return null;

  const logoData = await logoRes.json();
  const raw: string | null = logoData.url ?? null;
  return raw ? normalizeLogoUrl(raw) : null;
}

function loadLogoImage(
  logoUrl: string,
  onLoad: (img: HTMLImageElement) => void,
  isCancelled: () => boolean
) {
  const img = new Image();
  img.onload = () => {
    if (!isCancelled()) onLoad(img);
  };
  img.onerror = () => console.warn("[VideoOverlayEditor] Logo image failed to load:", logoUrl);
  img.src = logoUrl;
}

function SaveButtonContent({
  saveStage,
  saveButtonLabel,
}: Readonly<{
  saveStage: SaveStage;
  saveButtonLabel: string;
}>) {
  if (saveStage !== "idle") {
    return <><Loader2 size={12} className="animate-spin" />{saveButtonLabel}</>;
  }

  return <><Download size={12} />Export &amp; Save</>;
}

function SaveProgressDialog({
  saveStage,
  savedCreativeId,
  onSaved,
}: Readonly<{
  saveStage: SaveStage;
  savedCreativeId: string | null;
  onSaved: (creativeId: string) => void;
}>) {
  if (saveStage === "idle") return null;

  const savingTitle = saveStage === "compositing" ? "Compositing video…" : "Uploading…";
  const savingDescription = saveStage === "compositing"
    ? "Rendering overlays into the video. This may take a moment."
    : "Saving your edited video to the cloud.";

  return (
    <dialog
      open
      aria-modal="true"
      aria-label="Saving video"
      className="fixed inset-0 z-50 flex h-full max-h-none w-full max-w-none items-center justify-center bg-black/60 backdrop-blur-sm p-0 border-0"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className={`h-1.5 w-full ${saveStage === "done" ? "bg-[#4CAF31]" : "bg-zinc-200"}`}>
          {saveStage !== "done" && (
            <div className="h-full bg-[#4CAF31] animate-pulse" style={{ width: "60%" }} />
          )}
        </div>

        <div className="p-8 flex flex-col items-center gap-5 text-center">
          {saveStage === "done" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#F0F9F6] flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4CAF31" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-zinc-900">Video saved!</p>
                <p className="text-sm text-zinc-500 mt-1">Redirecting to preview…</p>
              </div>
              <button
                onClick={() => savedCreativeId && onSaved(savedCreativeId)}
                className="px-5 py-2 text-sm font-medium text-white bg-[#4CAF31] rounded-lg hover:bg-[#3d9a27] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4CAF31]"
              >
                Go to preview now
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-[#4CAF31]" />
              </div>
              <div>
                <p className="text-lg font-semibold text-zinc-900">{savingTitle}</p>
                <p className="text-sm text-zinc-500 mt-1">{savingDescription}</p>
              </div>
              <p className="text-xs text-zinc-400">Please don&apos;t close this tab.</p>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

// ─── GCS URL detection (re-exported from utils for backward compat) ───────────
export { isGcsUrl, buildProxiedUrl } from "@/components/video/videoOverlayUtils";

// ─── VideoOverlayEditor Component ─────────────────────────────────────────────
export default function VideoOverlayEditor({
  videoSrc,
  creativeId,
  campaignId,
  videoDuration,
  videoIntrinsicWidth,
  videoIntrinsicHeight,
  overlays,
  selectedId,
  onAddTextOverlay,
  onAddShapeOverlay,
  onAddShapeWithType,
  onAddBadgeOverlay,
  onAddLogoOverlay,
  onAddImageOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  onSelectOverlay,
  onReorderOverlay,
  onDuplicateOverlay,
  onSaved,
  onClose,
}: VideoOverlayEditorProps) {
  // ── Left panel state ──────────────────────────────────────────────────────
  const [leftPanel, setLeftPanel] = useState<"text" | "shapes" | "elements" | "upload" | null>(null);
  const [shapeSearch, setShapeSearch] = useState("");
  const [shapeCategory, setShapeCategory] = useState("All");

  // ── 8.1 Brand kit state ───────────────────────────────────────────────────
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [brandKitLoading, setBrandKitLoading] = useState(true);

  // ── 8.4 Save state ────────────────────────────────────────────────────────
  const [saveError, setSaveError] = useState<string | null>(null);
  // "idle" | "compositing" | "uploading" | "done"
  const [saveStage, setSaveStage] = useState<SaveStage>("idle");
  const [savedCreativeId, setSavedCreativeId] = useState<string | null>(null);

  // ── Editor-panel video ref and canvas dimensions ──────────────────────────
  const editorVideoRef = useRef<HTMLVideoElement>(null);
  const editorVideoContainerRef = useRef<HTMLDivElement>(null);
  const editorPlaybackBarRef = useRef<HTMLDivElement>(null);
  // Image upload ref for "Add Image" toolbar button
  const imageUploadRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => onAddImageOverlay(src, img);
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [onAddImageOverlay]);

  const [editorStageWidth, setEditorStageWidth] = useState(0);
  const [editorStageHeight, setEditorStageHeight] = useState(0);
  const [editorCurrentTime, setEditorCurrentTime] = useState(0);
  const [editorDuration, setEditorDuration] = useState(0);
  const [editorIsPlaying, setEditorIsPlaying] = useState(false);

  // Compute the rendered video size from the container + aspect ratio.
  // Called whenever the container resizes or intrinsic dimensions change.
  const recomputeStageSize = useCallback(() => {
    const container = editorVideoContainerRef.current;
    if (!container || !videoIntrinsicWidth || !videoIntrinsicHeight) return;

    const availW = container.clientWidth;
    const availH = container.clientHeight;

    if (availW <= 0 || availH <= 0) return;

    const aspect = videoIntrinsicWidth / videoIntrinsicHeight;
    let w = availW;
    let h = Math.round(availW / aspect);
    if (h > availH) {
      h = availH;
      w = Math.round(availH * aspect);
    }

    setEditorStageWidth(w);
    setEditorStageHeight(h);
  }, [videoIntrinsicWidth, videoIntrinsicHeight]);

  // Re-run whenever the container resizes or intrinsic dimensions arrive.
  useEffect(() => {
    const container = editorVideoContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(recomputeStageSize);
    ro.observe(container);
    recomputeStageSize();
    return () => ro.disconnect();
  }, [recomputeStageSize]);

  const toggleEditorPlay = useCallback(() => {
    const v = editorVideoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setEditorIsPlaying(true); }
    else { v.pause(); setEditorIsPlaying(false); }
  }, []);

  const editorSkipBack = useCallback(() => {
    const v = editorVideoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime - 10);
  }, []);

  const handleEditorSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = editorVideoRef.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setEditorCurrentTime(Number(e.target.value));
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ── FFmpeg compositor hook ────────────────────────────────────────────────
  const compositor = useFFmpegCompositor();

  // Keep a stable ref to onAddLogoOverlay so the brand-kit effect never
  // re-runs just because the callback identity changed (it changes whenever
  // videoDuration updates, which would add a duplicate logo each time).
  const onAddLogoOverlayRef = useRef(onAddLogoOverlay);
  useEffect(() => { onAddLogoOverlayRef.current = onAddLogoOverlay; }, [onAddLogoOverlay]);

  // ── 8.1 Fetch brand kit on mount, then load logo via signed URL ─────────
  // Runs only when campaignId changes — logo is added exactly once.
  useEffect(() => {
    let cancelled = false;

    async function loadBrandData() {
      try {
        const kit = await fetchCampaignBrandKit(campaignId);
        if (!cancelled && kit) {
          setBrandKit(kit);
        }

        // Fetch logo via /api/brands/:brandId/logo-url (same as editor page)
        const brandId = kit?.brandId;
        if (!brandId) return;

        const logoUrl = await fetchBrandLogoUrl(brandId).catch(() => null);
        if (logoUrl && !cancelled) {
          loadLogoImage(logoUrl, (img) => onAddLogoOverlayRef.current(logoUrl, img), () => cancelled);
        }
      } catch (err) {
        console.error("[VideoOverlayEditor] Failed to fetch brand kit:", err);
      } finally {
        if (!cancelled) setBrandKitLoading(false);
      }
    }

    loadBrandData();
    return () => { cancelled = true; };
  }, [campaignId]); // ← intentionally omits onAddLogoOverlay — use ref above

  // ── 8.2 (logo loading is now handled inside the brand kit effect above) ──

  // ── 8.3 Derive brand colors from brand kit ────────────────────────────────
  const brandColors = [
    brandKit?.primaryColor,
    brandKit?.secondaryColor,
    brandKit?.accentColor,
  ].filter((c): c is string => Boolean(c));

  // ── 8.4 Selected overlay (for properties panel) ───────────────────────────
  const selectedOverlay = overlays.find((o) => o.id === selectedId) ?? null;  // ── 8.4 Export & Save handler ─────────────────────────────────────────────
  const handleExportAndSave = async () => {
    setSaveError(null);
    setSaveStage("compositing");

    // Composite the video with overlays
    const blob = await compositor.composite({
      videoSrc,
      overlays,
      stageWidth: editorStageWidth,
      stageHeight: editorStageHeight,
      videoIntrinsicWidth,
      videoIntrinsicHeight,
    });

    if (!blob) {
      setSaveStage("idle");
      return;
    }

    setSaveStage("uploading");
    try {
      const formData = new FormData();
      formData.append("image", blob, "video-overlay-edited.mp4");

      const res = await fetch(`/api/creatives/${creativeId}/save-as-new`, {
        method: "POST",
        body: formData,
      });

      if (res.status === 201) {
        const data = await res.json();
        // Backend returns { success: true, creative: { id, ... } }
        const newId = data?.creative?.id ?? data?.id;
        if (newId) {
          setSavedCreativeId(newId);
          setSaveStage("done");
          // Auto-redirect after 2.5 s so the user can read the success message
          setTimeout(() => onSaved(newId), 2500);
        } else {
          setSaveError("Save succeeded but no creative ID was returned.");
          setSaveStage("idle");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(
          (data as { error?: string }).error ||
            `Save failed with status ${res.status}`
        );
        setSaveStage("idle");
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "An unexpected error occurred while saving."
      );
      setSaveStage("idle");
    }
  };

  // ── 8.4 Disable export button while loading / processing / saving ─────────
  const exportDisabled = saveStage !== "idle";
  const saveStageLabels = {
    compositing: "Compositing…",
    uploading: "Saving…",
    done: "Saved!",
  };
  const saveButtonLabel = saveStage === "idle" ? "" : saveStageLabels[saveStage];

  // ── 8.5 Combined error message ────────────────────────────────────────────
  const errorMessage = saveError ?? compositor.error;

  return (
    <>
    <div className="flex flex-col bg-white font-sans" style={{ height: "100vh", overflow: "hidden" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="h-[52px] shrink-0 bg-white border-b border-zinc-200 flex items-center justify-between px-5 z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#4CAF31] tracking-tight">MAR<span className="text-zinc-800">TECH</span></span>
          <div className="w-px h-4 bg-zinc-200" />
          <span className="text-xs text-zinc-500 font-medium">Video Editor</span>
          <div className="w-px h-4 bg-zinc-200" />
          <span className="text-xs text-zinc-400 font-mono">#{creativeId.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportAndSave} disabled={exportDisabled}
            className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-white bg-[#4CAF31] rounded-lg hover:bg-[#3d9a27] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-[#4CAF31]/20">
            <SaveButtonContent saveStage={saveStage} saveButtonLabel={saveButtonLabel} />
          </button>
          <button onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
            <X size={13} /> Cancel
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {errorMessage && (
        <div role="alert" className="flex items-start gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs shrink-0">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 overflow-hidden" style={{ flex: "1 1 0px" }}>

        {/* ── Icon rail ──────────────────────────────────────────────────── */}
        <div className="w-[60px] shrink-0 bg-white border-r border-zinc-200 flex flex-col items-center py-3 gap-1">
          {(["text", "shapes", "elements", "upload"] as const).map((tool) => {
            const icons: Record<string, React.ReactNode> = {
              text:     <Type size={19} />,
              shapes:   <Square size={19} />,
              elements: <Sparkles size={19} />,
              upload:   <ImagePlus size={19} />,
            };
            const labels: Record<string, string> = { text: "Text", shapes: "Shapes", elements: "Badges", upload: "Upload" };
            const active = leftPanel === tool;
            return (
              <button key={tool} onClick={() => setLeftPanel(active ? null : tool)} title={labels[tool]}
                className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                  active ? "bg-[#F0F9F6] text-[#4CAF31] ring-1 ring-[#4CAF31]/30" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                }`}>
                {icons[tool]}
                <span className="text-[7px] font-medium leading-none tracking-wide uppercase">{labels[tool]}</span>
              </button>
            );
          })}
        </div>

        {/* ── Left content panel ─────────────────────────────────────────── */}
        {leftPanel && (
          <div className="w-64 shrink-0 bg-white border-r border-zinc-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 shrink-0">
              <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
                {({ text: "Text", shapes: "Shapes", elements: "Badges", upload: "Upload" } as Record<string,string>)[leftPanel]}
              </span>
              <button onClick={() => setLeftPanel(null)} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {leftPanel === "text" && (
                <div className="p-4 space-y-3">
                  <button onClick={() => { onAddTextOverlay(editorStageWidth, editorStageHeight); setLeftPanel(null); }}
                    className="w-full py-4 rounded-xl border-2 border-dashed border-zinc-200 hover:border-[#4CAF31] hover:bg-[#F0F9F6] text-sm font-semibold text-zinc-500 hover:text-[#4CAF31] transition-all flex items-center justify-center gap-2 group">
                    <Type size={16} className="group-hover:scale-110 transition-transform" /> Add a text box
                  </button>
                  <p className="text-[10px] text-zinc-400 text-center">Double-click text on canvas to edit</p>
                </div>
              )}
              {leftPanel === "shapes" && (
                <div className="p-3 space-y-3">
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="text" placeholder="Search shapes..." value={shapeSearch} onChange={e => setShapeSearch(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-[#4CAF31] transition-colors" />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {["All", ...SHAPE_CATEGORIES].map(cat => (
                      <button key={cat} onClick={() => setShapeCategory(cat)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors ${shapeCategory === cat ? "bg-[#4CAF31] text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SHAPE_LIBRARY.filter(s => {
                      const ms = shapeSearch === "" || s.label.toLowerCase().includes(shapeSearch.toLowerCase());
                      const mc = shapeCategory === "All" || s.category === shapeCategory;
                      return ms && mc;
                    }).map(shape => (
                      <button key={shape.id} onClick={() => { onAddShapeWithType?.(editorStageWidth, editorStageHeight, shape.id, shape.path, shape.label); setLeftPanel(null); }} title={shape.label}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg bg-zinc-50 hover:bg-[#F0F9F6] border border-zinc-100 hover:border-[#4CAF31]/40 transition-all group">
                        <svg width="32" height="32" viewBox="0 0 100 100" className="text-zinc-500 group-hover:text-[#4CAF31] transition-colors">
                          <path d={shape.path} fill={shape.defaultStroke ? "none" : "currentColor"} stroke={shape.defaultStroke ? "currentColor" : "none"} strokeWidth={shape.defaultStroke ? 7 : 0} />
                        </svg>
                        <span className="text-[7px] text-zinc-400 group-hover:text-zinc-700 leading-none text-center truncate w-full transition-colors">{shape.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {leftPanel === "elements" && (
                <div className="p-3 space-y-3">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Pre-built Badges</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { text: "SALE", color: "#E53935" }, { text: "NEW", color: "#4CAF31" },
                      { text: "🔥 HOT", color: "#FF6F00" }, { text: "50% OFF", color: "#E53935" },
                      { text: "LIMITED", color: "#7B1FA2" }, { text: "FREE", color: "#00897B" },
                      { text: "BEST BUY", color: "#1565C0" }, { text: "TRENDING", color: "#F4511E" },
                    ]).map(badge => (
                      <button key={badge.text} onClick={() => { onAddBadgeOverlay?.(editorStageWidth, editorStageHeight, badge.text, badge.color); setLeftPanel(null); }}
                        className="flex items-center justify-center px-2 py-2 rounded-lg border border-zinc-100 hover:border-[#4CAF31]/40 hover:bg-[#F0F9F6] transition-all">
                        <span className="text-[10px] font-bold text-white px-2 py-1 rounded-full" style={{ backgroundColor: badge.color }}>{badge.text}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pt-1">Basic Shapes</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[{ label: "Rectangle" }, { label: "Circle" }].map(item => (
                      <button key={item.label} onClick={() => { onAddShapeOverlay(editorStageWidth, editorStageHeight); setLeftPanel(null); }}
                        className="flex items-center justify-center p-3 rounded-xl bg-zinc-50 hover:bg-[#F0F9F6] border border-zinc-100 hover:border-[#4CAF31]/40 transition-all">
                        <span className="text-[9px] text-zinc-500">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {leftPanel === "upload" && (
                <div className="p-4">
                  <label className="flex flex-col items-center justify-center gap-3 w-full py-10 rounded-xl border-2 border-dashed border-zinc-200 hover:border-[#4CAF31] hover:bg-[#F0F9F6] cursor-pointer transition-all group">
                    <div className="w-12 h-12 rounded-full bg-zinc-100 group-hover:bg-[#F0F9F6] flex items-center justify-center transition-colors">
                      <ImagePlus size={22} className="text-zinc-400 group-hover:text-[#4CAF31] transition-colors" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-zinc-500 group-hover:text-zinc-800 transition-colors">Upload image</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">JPG, PNG, SVG, WebP</p>
                    </div>
                    <input ref={imageUploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleImageUpload(e); setLeftPanel(null); }} />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Layers panel ───────────────────────────────────────────────── */}
        <div className="w-56 shrink-0 border-r border-zinc-200 flex flex-col bg-white" style={{ height: "100%", overflow: "hidden" }}>
          <div className="flex-1 overflow-y-auto min-h-0">
            {brandKitLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : (
              <OverlayLayersPanel
                overlays={overlays}
                selectedId={selectedId}
                onSelect={onSelectOverlay}
                onDelete={onDeleteOverlay}
                onReorder={onReorderOverlay}
                onDuplicate={onDuplicateOverlay}
              />
            )}
          </div>
        </div>

        {/* ── Center: video canvas ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-zinc-100" style={{ overflow: "hidden", maxWidth: "60%" }}>
          {/* Video area */}
          <div
            ref={editorVideoContainerRef}
            className="flex-1 min-h-0 min-w-0 overflow-hidden"
          >
            {/* Inner box: sized exactly to the computed stage dimensions, centered */}
            <div
              className="w-full h-full flex items-center justify-center"
            >
              <div
                className="relative overflow-hidden shrink-0 shadow-2xl rounded"
                style={
                  editorStageWidth > 0 && editorStageHeight > 0
                    ? { width: editorStageWidth, height: editorStageHeight }
                    : { width: "100%", maxWidth: "100%", aspectRatio: videoIntrinsicWidth && videoIntrinsicHeight ? `${videoIntrinsicWidth} / ${videoIntrinsicHeight}` : "16 / 9" }
                }
              >
            <div className="absolute inset-0 pointer-events-none">
              <video
                ref={editorVideoRef}
                src={videoSrc}
                className="w-full h-full object-fill pointer-events-auto"
                playsInline
                onTimeUpdate={() => {
                  const v = editorVideoRef.current;
                  if (!v) return;
                  setEditorCurrentTime(v.currentTime);
                  // Also keep duration in sync — it may not be set yet on first load
                  if (v.duration && !Number.isNaN(v.duration) && v.duration !== editorDuration) {
                    setEditorDuration(v.duration);
                  }
                }}
                onLoadedMetadata={() => {
                  const v = editorVideoRef.current;
                  if (v?.duration && !Number.isNaN(v.duration)) {
                    setEditorDuration(v.duration);
                  }
                  // Re-measure now that the browser has applied the aspect-ratio CSS
                  // (videoIntrinsicWidth/Height come from the parent via props, so the
                  // ResizeObserver effect will fire once those are non-zero)
                }}
                onDurationChange={() => {
                  const v = editorVideoRef.current;
                  if (v?.duration && !Number.isNaN(v.duration)) {
                    setEditorDuration(v.duration);
                  }
                }}
                onCanPlay={() => {
                  const v = editorVideoRef.current;
                  if (v?.duration && !Number.isNaN(v.duration) && editorDuration === 0) {
                    setEditorDuration(v.duration);
                  }
                }}
                onPlay={() => setEditorIsPlaying(true)}
                onPause={() => setEditorIsPlaying(false)}
                onEnded={() => {
                  setEditorIsPlaying(false);
                  setEditorCurrentTime(0);
                  const v = editorVideoRef.current;
                  if (v) v.currentTime = 0;
                }}
              >
                <track
                  kind="captions"
                  src="data:text/vtt;charset=utf-8,WEBVTT%0A%0A"
                  srcLang="en"
                  label="English captions"
                />
              </video>
            </div>
            {editorStageWidth > 0 && editorStageHeight > 0 && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: editorStageWidth, height: editorStageHeight, pointerEvents: "auto" }}
              >
                <OverlayCanvas
                  overlays={overlays}
                  selectedId={selectedId}
                  currentTime={editorCurrentTime}
                  stageWidth={editorStageWidth}
                  stageHeight={editorStageHeight}
                  onSelect={onSelectOverlay}
                  onUpdate={onUpdateOverlay}
                />
              </div>
            )}
              </div>{/* end sized box */}
            </div>{/* end centering wrapper */}
          </div>{/* end video area */}

          {/* Playback bar */}
          <div ref={editorPlaybackBarRef} className="shrink-0 bg-white border-t border-zinc-200 px-4 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 w-8 text-right tabular-nums">
                {formatTime(editorCurrentTime)}
              </span>
              <div className="flex-1 relative h-1.5 rounded-full bg-zinc-200 cursor-pointer">
                <div className="absolute inset-y-0 left-0 bg-[#4CAF31] rounded-full pointer-events-none"
                  style={{ width: editorDuration > 0 ? `${(editorCurrentTime / editorDuration) * 100}%` : "0%" }} />
                <input type="range" min={0} max={editorDuration > 0 ? editorDuration : 100} step={0.01} value={editorCurrentTime}
                  onChange={handleEditorSeek} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
              </div>
              <span className="text-[10px] text-zinc-400 w-8 tabular-nums">
                {formatTime(editorDuration)}
              </span>
            </div>
            <div className="flex items-center justify-center gap-8">
              <button onClick={editorSkipBack} className="flex flex-col items-center gap-0.5 text-zinc-400 hover:text-zinc-700 transition-colors" title="Back 10s">
                <SkipBack size={16} />
                <span className="text-[9px]">-10s</span>
              </button>
              <button onClick={toggleEditorPlay} className="w-10 h-10 rounded-full bg-[#4CAF31] hover:bg-[#3d8e27] flex items-center justify-center shadow-lg shadow-[#4CAF31]/30 transition-all">
                {editorIsPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
              </button>
              <div className="w-8" />
            </div>
          </div>
        </div>

        {/* ── Right: Properties panel ────────────────────────────────────── */}
        <div className="w-64 shrink-0 border-l border-zinc-200 bg-white flex flex-col" style={{ height: "100%", overflow: "hidden" }}>
          <div className="px-4 py-3 border-b border-zinc-100 shrink-0">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Properties</span>
          </div>
          <div style={{ flex: "1 1 0px", overflowY: "auto", minHeight: 0 }}>
            {selectedOverlay ? (
              <OverlayPropertiesPanel
                overlay={selectedOverlay}
                videoDuration={videoDuration}
                brandColors={brandColors}
                stageWidth={editorStageWidth}
                stageHeight={editorStageHeight}
                onUpdate={onUpdateOverlay}
                onAddLogoOverlay={onAddLogoOverlay}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
                  <Square size={20} className="text-zinc-300" />
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">Select an overlay on the canvas to edit its properties</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    <SaveProgressDialog saveStage={saveStage} savedCreativeId={savedCreativeId} onSaved={onSaved} />
    </>
  );
}
