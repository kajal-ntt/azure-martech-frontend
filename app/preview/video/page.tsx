"use client";

import React, { Suspense, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Home, Megaphone,
  RotateCcw, PenSquare, Loader2, Download,
  Send, Play, Pause, SkipBack, Film, AlertCircle,
} from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useVideoOverlays } from "@/hooks/useVideoOverlays";
import { getAgentToken } from "@/lib/auth-client";
import AgentUsageBadge from "@/components/usage/AgentUsageBadge";

const VideoOverlayEditor = dynamic(
  () => import("@/components/video/VideoOverlayEditor"),
  { ssr: false }
);

interface ProgressChunk {
  step: string;
  message: string;
  progress: number;
  ts: number;
  status?: string;
  data?: any;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    executionTimeMs: number;
    agentTraceId?: string | null;
  };
}

const STEP_LABELS: Record<string, string> = {
  prefetch:   "Fetching campaign & brand context",
  context:    "Resolving campaign images & aspect ratio",
  prompt:     "Building video prompt",
  generating: "Generating video with Veo (2–4 min)",
  complete:   "Video generated and saved",
  done:       "Complete",
  error:      "Error",
};

type PageStatus = "loading" | "streaming" | "ready" | "error";

interface VideoStreamContext {
  creativeId: string;
  fetchSignedUrl: (id: string) => Promise<string | null>;
  setChunks: React.Dispatch<React.SetStateAction<ProgressChunk[]>>;
  setCurrentChunk: React.Dispatch<React.SetStateAction<ProgressChunk | null>>;
  setVideoCreative: React.Dispatch<React.SetStateAction<any>>;
  setStreamError: React.Dispatch<React.SetStateAction<string | null>>;
  setStatus: React.Dispatch<React.SetStateAction<PageStatus>>;
  setUsage: React.Dispatch<React.SetStateAction<ProgressChunk["usage"] | null>>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const VIDEO_API_HEADERS = { "Content-Type": "application/json" };

function resetGenerationState(
  setStatus: (status: "streaming") => void,
  setChunks: React.Dispatch<React.SetStateAction<ProgressChunk[]>>,
  setCurrentChunk: React.Dispatch<React.SetStateAction<ProgressChunk | null>>,
  setStreamError: React.Dispatch<React.SetStateAction<string | null>>
) {
  setStatus("streaming");
  setChunks([]);
  setCurrentChunk(null);
  setStreamError(null);
}

async function createVideoGenerationResponse(campId: string, creativeId: string) {
  const token = await getAgentToken();
  return fetch("/api/agents/video", {
    method: "POST",
    headers: {
      ...VIDEO_API_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ campaign_id: campId, creative_id: creativeId }),
  });
}

function parseProgressChunk(line: string): ProgressChunk | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    console.warn("[video-preview] skipped non-JSON:", trimmed.slice(0, 80));
    return null;
  }
}

async function fetchSignedUrlWithRetry(
  creativeId: string,
  fetchSignedUrl: (id: string) => Promise<string | null>
) {
  let signedUrl = await fetchSignedUrl(creativeId);

  for (let i = 0; i < 10 && !signedUrl; i++) {
    console.log(`[video-preview] signed URL retry ${i + 1}/10`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    signedUrl = await fetchSignedUrl(creativeId);
  }

  return signedUrl;
}

async function handleSuccessfulGeneration(
  chunk: ProgressChunk,
  context: Pick<VideoStreamContext, "creativeId" | "fetchSignedUrl" | "setVideoCreative" | "setStreamError" | "setStatus" | "setUsage">
) {
  console.log("[video-preview] done - fetching signed URL");
  const signedUrl = await fetchSignedUrlWithRetry(context.creativeId, context.fetchSignedUrl);

  if (!signedUrl) {
    context.setStreamError("Video saved but signed URL unavailable. Try refreshing.");
    context.setStatus("error");
    return true;
  }

  console.log("[video-preview] signed URL ready");
  context.setVideoCreative({ id: context.creativeId, signedUrl, ...chunk.data });
  if (chunk.usage) {
    context.setUsage(chunk.usage);
  }
  context.setStatus("ready");
  return true;
}

async function processProgressChunk(
  chunk: ProgressChunk,
  context: VideoStreamContext
) {
  console.log(`[video-preview] chunk step=${chunk.step} progress=${chunk.progress}% status=${chunk.status ?? "-"}`);
  context.setChunks((prev) => [...prev, chunk]);
  context.setCurrentChunk(chunk);

  if (chunk.status === "error") {
    console.error("[video-preview] agent error:", chunk.message);
    context.setStreamError(chunk.message);
    context.setStatus("error");
    return true;
  }

  if (chunk.step !== "done" || chunk.status !== "success") {
    return false;
  }

  return handleSuccessfulGeneration(chunk, context);
}

async function consumeVideoStream(
  response: Response,
  context: VideoStreamContext
) {
  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(errText);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log("[video-preview] stream closed");
      return;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const chunk = parseProgressChunk(line);
      if (!chunk) continue;

      const shouldStop = await processProgressChunk(chunk, context);

      if (shouldStop) return;
    }
  }
}

export default function VideoPreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <VideoPreviewContent />
    </Suspense>
  );
}

function VideoPreviewContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const campaignId   = searchParams.get("campaignId");
  const creativeId   = searchParams.get("creativeId");
  const shouldGenerate = searchParams.get("generate") === "true"; // set by "Generate Video" button
  const withImage    = searchParams.get("withImage") === "true";
  const { isPending, isAuthenticated } = useAuthGuard();

  // ── State ────────────────────────────────────────────────────────────────────
  const [status, setStatus]           = useState<PageStatus>("loading");
  const [videoCreative, setVideoCreative] = useState<any>(null);
  const [chunks, setChunks]           = useState<ProgressChunk[]>([]);
  const [currentChunk, setCurrentChunk] = useState<ProgressChunk | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [usage, setUsage]             = useState<ProgressChunk["usage"] | null>(null);

  // Guard: only fire once per (creativeId, shouldGenerate) combination
  const startedRef = useRef<string | null>(null);

  // ── Video player ─────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [editorOpen, setEditorOpen]   = useState(false);

  const {
    overlays, selectedId,
    addLogoOverlay, addTextOverlay, addShapeOverlay, addImageOverlay,
    updateOverlay, deleteOverlay, selectOverlay,
    reorderOverlay, duplicateOverlay,
    addShapeWithType, addBadgeOverlay,
  } = useVideoOverlays(duration);
  const [videoIntrinsicWidth, setVideoIntrinsicWidth]   = useState(0);
  const [videoIntrinsicHeight, setVideoIntrinsicHeight] = useState(0);

  // ── Fetch signed URL ─────────────────────────────────────────────────────────
  const fetchSignedUrl = useCallback(async (id: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/creatives/${id}/signed-url`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.url ?? null;
    } catch { return null; }
  }, []);

  // ── Stream generation ─────────────────────────────────────────────────────────
  const runGeneration = useCallback(async (campId: string, creativeIdParam: string) => {
    resetGenerationState(setStatus, setChunks, setCurrentChunk, setStreamError);
    setUsage(null);

    try {
      const response = await createVideoGenerationResponse(campId, creativeIdParam);
      await consumeVideoStream(response, {
        creativeId: creativeIdParam,
        fetchSignedUrl,
        setChunks,
        setCurrentChunk,
        setVideoCreative,
        setStreamError,
        setStatus,
        setUsage,
      });
    } catch (err: any) {
      console.error("[video-preview] stream error:", err);
      setStreamError(err.message ?? "Stream failed");
      setStatus("error");
    }
  }, [fetchSignedUrl]);

  // ── Load existing video ───────────────────────────────────────────────────────
  const loadExisting = useCallback(async (creativeIdParam: string) => {
    try {
      const signedUrl = await fetchSignedUrl(creativeIdParam);
      if (signedUrl) {
        setVideoCreative({ id: creativeIdParam, signedUrl });
        setStatus("ready");
        return;
      }
      // Signed URL not ready yet — shouldn't happen for GENERATED creatives, but handle it
      setStreamError("Could not load video. Try refreshing.");
      setStatus("error");
    } catch (err: any) {
      setStreamError(err.message ?? "Failed to load video");
      setStatus("error");
    }
  }, [fetchSignedUrl]);

  // ── On mount / param change ───────────────────────────────────────────────────
  useEffect(() => {
    if (!campaignId || !creativeId) return;

    // Key includes shouldGenerate so clicking "view existing" after generating
    // a new one doesn't get blocked by the guard
    const key = `${creativeId}:${shouldGenerate}`;
    if (startedRef.current === key) return; // Strict Mode / double-fire guard
    startedRef.current = key;

    if (shouldGenerate) {
      // Came from "Generate Video" button — run the agent and stream progress
      runGeneration(campaignId, creativeId);
    } else {
      // Came from clicking an existing video — just load the signed URL
      loadExisting(creativeId);
    }
  }, [campaignId, creativeId, shouldGenerate, runGeneration, loadExisting]);

  if (isPending) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

  // ── Player controls ───────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else          { v.pause(); setIsPlaying(false); }
  };

  const skipBack10 = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime - 10);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  const handlePublish = async () => {
    if (!videoCreative?.signedUrl) return;
    try {
      const res = await fetch(`/api/creatives/${videoCreative.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (res.ok) { alert("Video published successfully!"); router.push(`/campaigns/${campaignId}`); }
    } catch { alert("Failed to publish video."); }
  };

  const handleDownload = async () => {
    if (!videoCreative?.signedUrl) return;
    try {
      const res  = await fetch(videoCreative.signedUrl);
      const blob = await res.blob();
      const a    = document.createElement("a");
      a.href     = URL.createObjectURL(blob);
      a.download = `video-${videoCreative.id.slice(0, 8)}.mp4`;
      a.click();
    } catch { alert("Download failed."); }
  };

  const handleRetry = () => {
    if (!campaignId || !creativeId) return;
    startedRef.current = null;
    setStatus("loading");
    setStreamError(null);
    setChunks([]);
    setCurrentChunk(null);
    setVideoCreative(null);
    const key = `${creativeId}:${shouldGenerate}`;
    startedRef.current = key;
    if (shouldGenerate) runGeneration(campaignId, creativeId);
    else loadExisting(creativeId);
  };

  const handleSaved = (newCreativeId: string) => {
    router.push(`/preview/video?campaignId=${campaignId}&creativeId=${newCreativeId}`);
  };

  const progress   = currentChunk?.progress ?? 0;
  const stepLabel  = currentChunk ? (STEP_LABELS[currentChunk.step] ?? currentChunk.message) : "Initialising…";
  const isStreaming = status === "streaming";
  const isLoading   = status === "loading";
  let pageTitle = "AI Video Generated";
  if (isStreaming) {
    pageTitle = "AI Video Generation";
  } else if (isLoading) {
    pageTitle = "Loading Video…";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans text-zinc-900">

      {/* SIDEBAR */}
      <aside className="w-64 border-r border-zinc-200 bg-white flex flex-col shrink-0 h-screen sticky top-0">
        <Link href="/dashboard" className="block p-6">
          <h2 className="text-xl font-bold text-[#4CAF31]">MARTECH</h2>
        </Link>
        <nav className="flex-1 px-4 py-2 space-y-2">
          <NavItem icon={<Home size={18} />} label="Home" onClick={() => router.push("/dashboard")} />
          <NavItem
            icon={<Megaphone size={18} />}
            label="Campaign Manager"
            active
            onClick={() => router.push(campaignId ? `/campaigns/${campaignId}` : "/campaigns")}
          />
          <div className="ml-4 border-l border-zinc-100 mt-1">
            {withImage && (
              <button
                type="button"
                onClick={() => router.back()}
                className="block w-full text-left py-2 px-6 text-sm text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 rounded-r-md transition-colors"
              >
                Image Preview
              </button>
            )}
            <div className="py-2 px-6 text-sm font-semibold text-[#4CAF31] bg-[#F1F8F1] rounded-r-md border-r-4 border-[#4CAF31]">
              Video Preview
            </div>
          </div>
        </nav>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-8 bg-white sticky top-0 z-20">
          <div className="text-sm flex items-center gap-2">
            <button
              onClick={() => router.push(campaignId ? `/campaigns/${campaignId}` : "/campaigns")}
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Campaign Manager
            </button>
            <span className="text-zinc-300">&gt;</span>
            <span className="text-zinc-800 font-bold">Video Preview</span>
          </div>
          <button
            onClick={() => router.back()}
            className="text-xs font-bold text-[#4CAF31] flex items-center gap-1 hover:underline"
          >
            <RotateCcw size={14} /> Back to Variants
          </button>
        </header>

        <div className="flex flex-1 min-w-0 overflow-hidden">

          {/* Left — video / progress */}
          <div className={`flex flex-col transition-all duration-300 overflow-y-auto ${editorOpen ? "w-[40%]" : "w-full"}`}>
            <div className="flex-1 p-8 pb-32">
              <h1 className="text-2xl font-bold mb-8 text-center">
                {pageTitle}
              </h1>

              <div className="max-w-2xl mx-auto space-y-4">

                {/* ── Main video container ── */}
                <div className="relative bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden aspect-video flex items-center justify-center">

                  {/* Loading (fetching existing video) */}
                  {isLoading && (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="animate-spin text-zinc-500" size={36} />
                      <p className="text-sm text-zinc-500">Loading…</p>
                    </div>
                  )}

                  {/* Streaming (new generation) */}
                  {isStreaming && (
                    <div className="flex flex-col items-center gap-6 text-center px-8 w-full">
                      <Loader2 className="animate-spin text-[#4CAF31]" size={48} />
                      <div className="space-y-1 w-full">
                        <p className="text-lg font-bold text-white">Generating AI Video…</p>
                        <p className="text-xs text-zinc-400">{stepLabel}</p>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full space-y-2">
                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-[#4CAF31] transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-zinc-500 text-right tabular-nums">{progress}%</p>
                      </div>

                      {/* Live step log */}
                      {chunks.length > 0 && (
                        <div className="w-full max-h-28 overflow-y-auto space-y-1 text-left">
                          {chunks.map((c, i) => {
                            const isLatest = i === chunks.length - 1;
                            let dotClass = "bg-[#4CAF31]";
                            if (c.status === "error") {
                              dotClass = "bg-red-500";
                            } else if (isLatest) {
                              dotClass = "bg-[#4CAF31] animate-pulse";
                            }

                            return (
                              <div key={`${c.ts}-${c.step}`} className="flex items-start gap-2 text-xs">
                                <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${dotClass}`} />
                                <span className={isLatest ? "text-zinc-300" : "text-zinc-500"}>
                                  {STEP_LABELS[c.step] ?? c.message}
                                  {!isLatest && c.status !== "error" && " ✓"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {status === "error" && (
                    <div className="flex flex-col items-center gap-4 text-center px-8">
                      <AlertCircle size={48} className="text-red-400" />
                      <div>
                        <p className="text-lg font-bold text-white">Failed</p>
                        <p className="text-xs text-zinc-400 mt-1">{streamError ?? "An unexpected error occurred."}</p>
                      </div>
                      <button
                        onClick={handleRetry}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#4CAF31] text-white text-sm font-bold rounded-xl hover:bg-[#3d8e27] transition-colors"
                      >
                        <RotateCcw size={14} /> Retry
                      </button>
                    </div>
                  )}

                  {/* Ready — video player */}
                  {status === "ready" && videoCreative?.signedUrl && (
                    <video
                      ref={videoRef}
                      src={videoCreative.signedUrl}
                      className="w-full h-full object-contain"
                      playsInline
                      onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                      onLoadedMetadata={() => {
                        const v = videoRef.current;
                        if (!v) return;
                        const dur = v.duration ?? 0;
                        setDuration(dur);
                        setVideoIntrinsicWidth(v.videoWidth ?? 0);
                        setVideoIntrinsicHeight(v.videoHeight ?? 0);
                        if (dur > 0) {
                          overlays.forEach(o => {
                            if (o.timeline.outPoint === 0)
                              updateOverlay(o.id, { timeline: { inPoint: 0, outPoint: dur } });
                          });
                        }
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    >
                      <track kind="captions" src="data:text/vtt,WEBVTT%0A" srcLang="en" label="English captions" />
                    </video>
                  )}
                </div>

                {/* Player controls */}
                {status === "ready" && (
                  <div className="bg-zinc-900 rounded-2xl px-5 py-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
                      <input
                        type="range" min={0} max={duration || 0} step={0.1} value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1.5 rounded-full accent-[#4CAF31] cursor-pointer"
                      />
                      <span className="text-xs text-zinc-400 w-10 tabular-nums">{formatTime(duration)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-8">
                      <button onClick={skipBack10} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition-colors">
                        <SkipBack size={22} />
                        <span className="text-[10px]">-10s</span>
                      </button>
                      <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-[#4CAF31] hover:bg-[#3d8e27] flex items-center justify-center shadow-lg transition-all">
                        {isPlaying ? <Pause size={22} className="text-white" /> : <Play size={22} className="text-white ml-0.5" />}
                      </button>
                      <button onClick={handleDownload} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition-colors">
                        <Download size={22} />
                        <span className="text-[10px]">Save</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {status === "ready" && (
                  <div className="flex flex-col items-center gap-4 pt-4">
                    {usage && (
                      <AgentUsageBadge
                        totalTokens={usage.totalTokens}
                        inputTokens={usage.inputTokens}
                        outputTokens={usage.outputTokens}
                        executionTimeMs={usage.executionTimeMs}
                      />
                    )}
                    <div className="flex justify-center gap-4 flex-wrap">
                    {!editorOpen && (
                      <button
                        onClick={() => router.push(`/editor/video?creativeId=${videoCreative?.id}&campaignId=${campaignId}`)}
                        className="px-8 py-4 rounded-2xl border border-zinc-200 bg-white font-bold text-zinc-700 hover:bg-zinc-50 transition-all flex items-center gap-2"
                      >
                        <Film size={20} /> Edit Video
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/editor/image?creativeId=${videoCreative?.id}&campaignId=${campaignId}`)}
                      className="px-8 py-4 rounded-2xl border border-zinc-200 bg-white font-bold text-zinc-700 hover:bg-zinc-50 transition-all flex items-center gap-2"
                    >
                      <PenSquare size={20} /> Fine-tune Edit
                    </button>
                    <button
                      onClick={handlePublish}
                      className="px-12 py-4 bg-[#4CAF31] text-white rounded-2xl font-bold text-lg hover:bg-[#3d8e27] transition-all shadow-xl shadow-[#4CAF31]/30 flex items-center gap-2"
                    >
                      <Send size={22} /> Publish Video
                    </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right — editor panel */}
          <div className={`transition-all duration-300 overflow-hidden shrink-0 ${editorOpen ? "w-[60%]" : "w-0"}`}>
            {editorOpen && videoCreative?.signedUrl && (
              <VideoOverlayEditor
                videoSrc={videoCreative.signedUrl}
                creativeId={videoCreative.id}
                campaignId={campaignId ?? ""}
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
                onClose={() => setEditorOpen(false)}
              />
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

function NavItem({
  icon, label, active = false, onClick,
}: {
  readonly icon: React.ReactNode; readonly label: string; readonly active?: boolean; readonly onClick?: () => void;
}) {
  const className = `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
    active ? "text-[#4CAF31] bg-[#F1F8F1]" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`w-full text-left ${className}`}>
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className={className}>
      {icon}
      <span>{label}</span>
    </div>
  );
}
