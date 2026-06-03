"use client";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Home, ShoppingCart, LayoutGrid, Megaphone,
  BarChart3, PenSquare, Loader2,
  Download, Video, Send, Check, Wand2, RotateCcw
} from "lucide-react";
import { getAgentToken } from "@/lib/auth-client";
import { PLATFORMS, type TargetPlatform } from "@/lib/platforms";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import BrandAvatar from "@/components/BrandAvatar";
import AgentUsageBadge from "@/components/usage/AgentUsageBadge";

const BASE_INTERVAL = 3000;
const MAX_INTERVAL = 10000;
const MAX_POLLS = 60;

function aspectRatioToCssRatio(ar: string): string {
  // "1:1" → "1 / 1", "16:9" → "16 / 9"
  return ar.replace(":", " / ");
}

function buildPlatformTabs() {
  return PLATFORMS.map((p) => ({
    key: p.id,
    label: p.name,
    ratio: aspectRatioToCssRatio(p.aspectRatio),
    aspectRatio: p.aspectRatio,
  }));
}

interface PreviewCreative {
  id: string;
  type: string;
  url?: string | null;
  signedUrl?: string | null;
  status?: string;
  createdAt: string;
  updatedAt?: string | null;
  variantsRequested?: number | null;
  isEdited?: boolean;
  headlines?: string[] | null;
  adCopy?: string | null;
  platformName?: string | null;
  aspectRatio?: string | null;
  sourceId?: string;
}

interface ThumbnailCardProps {
  index: number;
  creative?: PreviewCreative;
  isSelected: boolean;
  isRegenerating: boolean;
  selectedCreativeId: string | undefined;
  brandLogoUrl: string | null;
  getDisplayUrl: (creative: PreviewCreative) => string | null;
  onSelect: (index: number) => void;
  onDownload: (creative: PreviewCreative) => void;
  onEdit: (creativeId: string) => void;
  onRegenerate: (creative: PreviewCreative) => void;
  onAdapt: (creative: PreviewCreative, platformKey: string) => void;
  platformTabs: { key: string; label: string; ratio: string; aspectRatio: string }[];
  onGenerateVideo: (creative: PreviewCreative) => void;
  onPublish: (creative: PreviewCreative) => void;
}


interface RegenerationPollOptions {
  creativeId: string;
  getDisplayUrl: (creative: PreviewCreative) => string | null;
  onGenerated: (creative: PreviewCreative) => void;
  onTimeout: () => void;
}

function getPublicStorageUrl(raw: string): string {
  return raw.startsWith("gs://")
    ? raw.replace("gs://", "https://storage.googleapis.com/")
    : raw.replace("https://storage.cloud.google.com/", "https://storage.googleapis.com/");
}

function toProxyImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return `/api/image-proxy?url=${encodeURIComponent(getPublicStorageUrl(raw))}`;
}

function sortByDateDesc<T extends PreviewCreative>(items: T[], key: "createdAt" | "updatedAt" = "createdAt"): T[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a[key] ?? a.createdAt).getTime();
    const bTime = new Date(b[key] ?? b.createdAt).getTime();
    return bTime - aTime;
  });
}

function getImageCreatives(allCreatives: PreviewCreative[]): PreviewCreative[] {
  return sortByDateDesc(allCreatives.filter((creative) => creative.type === "IMAGE"));
}

function getLatestVideoCreative(allCreatives: PreviewCreative[]): PreviewCreative | null {
  const videos = sortByDateDesc(allCreatives.filter((creative) => creative.type === "VIDEO"));
  return videos[0] ?? null;
}

function getReferenceCreative(allImages: PreviewCreative[], initialCreativeId: string | null): PreviewCreative | null {
  const explicitCreative = initialCreativeId
    ? allImages.find((creative) => creative.id === initialCreativeId)
    : null;

  return explicitCreative ?? allImages[0] ?? null;
}

function getRecentReferenceCreative(
  allImages: PreviewCreative[],
  refCreative: PreviewCreative | null,
  initialCreativeId: string | null
): PreviewCreative | null {
  if (!refCreative || initialCreativeId || !refCreative.variantsRequested) {
    return refCreative;
  }

  const ageInMinutes = (Date.now() - new Date(refCreative.createdAt).getTime()) / 60000;
  if (ageInMinutes <= 10) {
    return refCreative;
  }

  const recentWithSameVariants = allImages.find(
    (creative) => creative.variantsRequested === refCreative.variantsRequested && !creative.isEdited
  );

  if (recentWithSameVariants) {
    console.log("[Preview] Using most recent creative instead of old reference");
    return recentWithSameVariants;
  }

  return refCreative;
}

function getEditedSessionImages(allImages: PreviewCreative[], refCreative: PreviewCreative): PreviewCreative[] {
  const refTime = new Date(refCreative.createdAt).getTime();
  const timeWindow = 30000;
  const editedImages = allImages.filter((creative) => {
    const creativeTime = new Date(creative.createdAt).getTime();
    return creative.isEdited && Math.abs(creativeTime - refTime) <= timeWindow;
  });

  return editedImages.length > 0 ? editedImages : [refCreative];
}

function getBatchSessionImages(allImages: PreviewCreative[], refCreative: PreviewCreative): PreviewCreative[] {
  const refTime = new Date(refCreative.updatedAt || refCreative.createdAt).getTime();
  const timeWindow = 300000;
  const expectedVariants = refCreative.variantsRequested || 1;

  console.log("[Preview] Filtering logic:");
  console.log("  refTime:", new Date(refTime).toISOString());
  console.log("  expectedVariants:", expectedVariants);
  console.log("  allImages count:", allImages.length);

  const sessionImages = allImages.filter((creative) => {
    const creativeTime = new Date(creative.updatedAt || creative.createdAt).getTime();
    const timeDiff = Math.abs(creativeTime - refTime);
    const withinTimeWindow = timeDiff <= timeWindow;
    // Remove sameVariantCount filter to prevent filtering out variants when the agent hallucinates variantsRequested

    console.log(`  Creative ${creative.id.slice(0, 8)}:`, {
      createdAt: new Date(creative.createdAt).toISOString(),
      updatedAt: creative.updatedAt ? new Date(creative.updatedAt).toISOString() : "null",
      timeDiff: `${timeDiff}ms`,
      withinTimeWindow,
      variantsRequested: creative.variantsRequested,
      isEdited: creative.isEdited,
      passes: withinTimeWindow && !creative.isEdited,
    });

    return withinTimeWindow && !creative.isEdited;
  });

  return sessionImages.length > 0 ? sessionImages : [refCreative];
}

function getFallbackSessionImages(allImages: PreviewCreative[]): PreviewCreative[] {
  if (allImages.length === 0) return [];

  const mostRecent = allImages[0];
  const refTime = new Date(mostRecent.createdAt).getTime();
  const timeWindow = 120000;

  return allImages.filter((creative) => {
    const creativeTime = new Date(creative.createdAt).getTime();
    return Math.abs(creativeTime - refTime) <= timeWindow;
  });
}

function getSessionImages(
  allImages: PreviewCreative[],
  refCreative: PreviewCreative | null,
  initialCreativeId: string | null,
  isBatch: boolean
): PreviewCreative[] {
  // NOTE: We do NOT early-return for initialCreativeId here — the 2-master strategy
  // always generates multiple creatives per invoke (one per platform), and we want
  // the full batch visible. initialCreativeId is used only to set the initial
  // selected creative (via getReferenceCreative), not to filter the list.

  if (refCreative?.isEdited) {
    return getEditedSessionImages(allImages, refCreative);
  }

  if (refCreative) {
    return getBatchSessionImages(allImages, refCreative);
  }

  return getFallbackSessionImages(allImages);
}

function getExpectedVariantsCount(
  refCreative: PreviewCreative | null,
  initialCreativeId: string | null,
  actualCount: number,
  isBatch: boolean
): number {
  // NOTE: initialCreativeId is intentionally not used here — with the 2-master strategy,
  // every generation produces multiple creatives (one per platform) and we always want
  // to show the full batch, not restrict to 1 slot.
  if (refCreative?.isEdited) {
    return 1;
  }

  return refCreative?.variantsRequested ?? actualCount ?? 1;
}

function dedupeCreativesById(creatives: PreviewCreative[]): PreviewCreative[] {
  const seen = new Set<string>();
  return creatives.filter((creative) => {
    if (seen.has(creative.id)) return false;
    seen.add(creative.id);
    return true;
  });
}

function buildVariantSlots(expectedVariants: number): number[] {
  return Array.from({ length: expectedVariants }, (_, index) => index);
}

function areExpectedVariantsReady(creatives: PreviewCreative[], expectedVariants: number): boolean {
  return creatives.length >= expectedVariants && creatives.every((creative) => creative.url);
}

function getPreviewPollDelay(count: number): number {
  return count < 10 ? 2000 : Math.min(BASE_INTERVAL * (count - 10 + 1), MAX_INTERVAL);
}

function buildVariantStatusDots(expectedVariants: number, creatives: PreviewCreative[]) {
  return buildVariantSlots(expectedVariants).map((index) => (
    <div
      key={creatives[index]?.id ?? `progress-variant-${index + 1}`}
      className={`h-8 w-8 rounded-full border-2 border-white transition-colors ${creatives[index]?.signedUrl ? "bg-[#4CAF31]" : "bg-zinc-200"
        }`}
    />
  ));
}

function setupEditorBackNavigation(
  fromEditor: boolean,
  campaignId: string | null,
  initialCreativeId: string | null
) {
  if (!fromEditor || !initialCreativeId || !campaignId) {
    return undefined;
  }

  const cleanUrl = `/preview/image?campaignId=${campaignId}&creativeId=${initialCreativeId}`;
  globalThis.history.replaceState(null, "", `/campaigns/${campaignId}`);
  globalThis.history.pushState(null, "", cleanUrl);

  const handlePopState = () => {
    globalThis.location.href = `/campaigns/${campaignId}`;
  };

  globalThis.addEventListener("popstate", handlePopState);
  return () => {
    globalThis.removeEventListener("popstate", handlePopState);
  };
}

async function fetchCampaignBrandLogo(campaignId: string): Promise<string | null> {
  const campaignRes = await fetch(`/api/campaigns/${campaignId}/brand-kit`);
  if (!campaignRes.ok) return null;

  const campaignData = await campaignRes.json();
  const kit = campaignData.brandKit ?? campaignData;
  const brandId = kit?.brandId;
  if (!brandId) return null;

  const logoRes = await fetch(`/api/brands/${brandId}/logo-url`);
  if (!logoRes.ok) return null;

  const logoData = await logoRes.json();
  return toProxyImageUrl(logoData?.url);
}

function updateCreativeInList(
  creatives: PreviewCreative[],
  creativeId: string,
  updater: (creative: PreviewCreative) => PreviewCreative
): PreviewCreative[] {
  return creatives.map((creative) => (
    creative.id === creativeId ? updater(creative) : creative
  ));
}

function replaceCreativeInList(
  creatives: PreviewCreative[],
  creativeId: string,
  replacement: PreviewCreative
): PreviewCreative[] {
  return updateCreativeInList(creatives, creativeId, () => replacement);
}

async function fetchGeneratedCreative(
  creativeId: string,
  getDisplayUrl: (creative: PreviewCreative) => string | null
) {
  const res = await fetch(`/api/creatives/${creativeId}`);
  if (!res.ok) return null;

  const data = await res.json();
  const updatedCreative = data.creative || data;
  if (!updatedCreative.url || updatedCreative.status !== "GENERATED") return null;

  return {
    ...updatedCreative,
    signedUrl: getDisplayUrl(updatedCreative),
  };
}

function startRegenerationPoll({
  creativeId,
  getDisplayUrl,
  onGenerated,
  onTimeout,
}: RegenerationPollOptions) {
  let pollCount = 0;
  const pollInterval = setInterval(async () => {
    pollCount++;

    try {
      const generatedCreative = await fetchGeneratedCreative(creativeId, getDisplayUrl);
      if (generatedCreative) {
        onGenerated(generatedCreative);
        clearInterval(pollInterval);
      }
    } catch (err) {
      console.error("Poll error:", err);
    }

    if (pollCount >= 60) {
      clearInterval(pollInterval);
      onTimeout();
    }
  }, 2000);
}

function loadImageWithCors(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function getTargetRatio(ratio: string): number {
  const [rw, rh] = ratio.split("/").map((value) => Number.parseFloat(value.trim()));
  return rw / rh;
}

function getCropRect(img: HTMLImageElement, targetRatio: number) {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const srcRatio = srcW / srcH;
  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (srcRatio > targetRatio) {
    sw = srcH * targetRatio;
    sx = (srcW - sw) / 2;
  } else if (srcRatio < targetRatio) {
    sh = srcW / targetRatio;
    sy = (srcH - sh) / 2;
  }

  return { sx, sy, sw, sh };
}

function createCroppedCanvas(bgImg: HTMLImageElement, targetRatio: number): HTMLCanvasElement {
  const { sx, sy, sw, sh } = getCropRect(bgImg, targetRatio);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function drawBrandLogo(canvas: HTMLCanvasElement, brandLogoUrl: string | null) {
  if (!brandLogoUrl) return;
  const ctx = canvas.getContext("2d")!;
  const logoImg = await loadImageWithCors(brandLogoUrl);
  const logoSize = Math.round(canvas.width * 0.1);
  const pad = Math.round(canvas.width * 0.02);
  ctx.drawImage(logoImg, canvas.width - logoSize - pad, pad, logoSize, logoSize);
}

function getWrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function drawCaption(canvas: HTMLCanvasElement, caption: string) {
  const ctx = canvas.getContext("2d")!;
  const fontSize = Math.round(canvas.width * 0.035);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#ffffff";

  const lines = getWrappedLines(ctx, caption, canvas.width * 0.8);
  const lineH = fontSize * 1.4;
  const totalH = lines.length * lineH;
  const startY = canvas.height - Math.round(canvas.height * 0.12) - totalH;

  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, startY + index * lineH);
  });

  ctx.shadowBlur = 0;
}

function exportCanvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Download failed."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ThumbnailPlaceholder({ index }: Readonly<{ index: number }>) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-2">
      <div className="w-8 h-8 rounded-full border-4 border-zinc-100 border-t-[#4CAF31] animate-spin" />
      <p className="text-[10px] font-bold uppercase tracking-widest">Variant {index + 1}</p>
    </div>
  );
}

function ThumbnailGenerating() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 gap-2">
      <Loader2 size={24} className="animate-spin text-[#4CAF31]" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Generating...</p>
    </div>
  );
}

function ThumbnailActions({
  creative,
  isRegenerating,
  showRegeneratingOverlay,
  platformTabs,
  onDownload,
  onEdit,
  onRegenerate,
  onAdapt,
  onGenerateVideo,
  onPublish,
}: Readonly<Pick<
  ThumbnailCardProps,
  "creative" | "isRegenerating" | "platformTabs" | "onDownload" | "onEdit" | "onRegenerate" | "onAdapt" | "onGenerateVideo" | "onPublish"
> & {
  creative: PreviewCreative;
  showRegeneratingOverlay: boolean;
}>) {
  const [showPlatforms, setShowPlatforms] = React.useState(false);
  return (
    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
      <button
        onClick={(e) => { e.stopPropagation(); onDownload(creative); }}
        disabled={isRegenerating}
        title="Download"
        className="p-1.5 bg-white/90 backdrop-blur rounded-lg text-zinc-800 hover:bg-white shadow transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={12} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(creative.id); }}
        disabled={isRegenerating}
        title="Edit"
        className="p-1.5 bg-white/90 backdrop-blur rounded-lg text-zinc-800 hover:bg-white shadow transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PenSquare size={12} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRegenerate(creative); }}
        disabled={isRegenerating}
        title={isRegenerating ? "Regenerating..." : "Regenerate"}
        className="p-1.5 bg-white/90 backdrop-blur rounded-lg text-zinc-800 hover:bg-white shadow transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RotateCcw size={12} className={showRegeneratingOverlay ? "animate-spin" : ""} />
      </button>
      {/* Adapt to platform dropdown */}
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setShowPlatforms((v) => !v); }}
          disabled={isRegenerating}
          title="Adapt to platform"
          className="p-1.5 bg-[#4CAF31]/90 backdrop-blur rounded-lg text-white hover:bg-[#4CAF31] shadow transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Wand2 size={12} />
        </button>
        {showPlatforms && (
          <div
            className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-zinc-100 p-1.5 z-30 min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest px-2 py-1">Adapt for</p>
            {platformTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={(e) => { e.stopPropagation(); setShowPlatforms(false); onAdapt(creative, tab.key); }}
                className="w-full text-left px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-[#F0F9F6] hover:text-[#4CAF31] rounded-lg transition-colors"
              >
                {tab.label}
                <span className="ml-1 text-[9px] text-zinc-400">{tab.aspectRatio}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onGenerateVideo(creative); }}
        disabled={isRegenerating}
        title="Animate"
        className="p-1.5 bg-zinc-900/90 backdrop-blur rounded-lg text-white hover:bg-black shadow transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Video size={12} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onPublish(creative); }}
        disabled={isRegenerating}
        title="Publish"
        className="p-1.5 bg-[#4CAF31]/90 backdrop-blur rounded-lg text-white hover:bg-[#4CAF31] shadow transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send size={12} />
      </button>
    </div>
  );
}

function ThumbnailLoadedContent({
  index,
  creative,
  isRegenerating,
  showRegeneratingOverlay,
  brandLogoUrl,
  getDisplayUrl,
  platformTabs,
  onDownload,
  onEdit,
  onRegenerate,
  onAdapt,
  onGenerateVideo,
  onPublish,
}: Readonly<Omit<ThumbnailCardProps, "creative" | "isSelected" | "selectedCreativeId" | "onSelect"> & {
  creative: PreviewCreative;
  showRegeneratingOverlay: boolean;
}>) {
  return (
    <React.Fragment>
      <img
        src={creative.signedUrl ?? ""}
        alt={`Variant ${index + 1}`}
        className={`w-full h-full object-cover transition-opacity duration-500 ${showRegeneratingOverlay ? "opacity-30" : "opacity-100"}`}
        onError={(e) => {
          const url = getDisplayUrl(creative);
          if (url) (e.target as HTMLImageElement).src = url;
        }}
      />
      {showRegeneratingOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm gap-2 z-20">
          <Loader2 size={24} className="animate-spin text-[#4CAF31]" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-700">Regenerating...</p>
        </div>
      )}
      {brandLogoUrl && brandLogoUrl.trim() !== "" && !creative.isEdited && (
        <img src={brandLogoUrl} alt="Logo" className="absolute top-2 right-2 h-7 w-7 object-contain drop-shadow-md" />
      )}
      {!creative.isEdited && creative.headlines && creative.headlines.length > 0 && (
        <div className="absolute inset-x-0 bottom-[18%] px-2">
          <p className="text-zinc-900 text-sm font-bold text-center leading-tight drop-shadow-sm line-clamp-2">
            {creative.headlines[0]}
          </p>
        </div>
      )}
      {!creative.isEdited && creative.adCopy && creative.adCopy.length <= 300 && (
        <div className="absolute inset-x-0 bottom-[5%] px-3">
          <p className="text-zinc-700 text-xs font-semibold text-center leading-snug line-clamp-1">
            {creative.adCopy}
          </p>
        </div>
      )}
      <ThumbnailActions
        creative={creative}
        isRegenerating={isRegenerating}
        showRegeneratingOverlay={showRegeneratingOverlay}
        platformTabs={platformTabs}
        onDownload={onDownload}
        onEdit={onEdit}
        onRegenerate={onRegenerate}
        onAdapt={onAdapt}
        onGenerateVideo={onGenerateVideo}
        onPublish={onPublish}
      />
    </React.Fragment>
  );
}

function ThumbnailContent(props: Readonly<ThumbnailCardProps & { showRegeneratingOverlay: boolean }>) {
  if (props.showRegeneratingOverlay) {
    return <ThumbnailGenerating />;
  }

  if (props.creative?.signedUrl) {
    return <ThumbnailLoadedContent {...props} creative={props.creative} />;
  }

  if (props.creative) {
    return <ThumbnailGenerating />;
  }

  return <ThumbnailPlaceholder index={props.index} />;
}

function getThumbnailBorderClass(isSelected: boolean) {
  return isSelected
    ? "border-[#4CAF31] ring-2 ring-[#4CAF31]/30 scale-[1.02]"
    : "border-zinc-200 hover:border-zinc-300";
}

function getVariantLabelClass(isSelected: boolean) {
  return isSelected ? "text-[#4CAF31]" : "text-zinc-500";
}

function ThumbnailCard(props: Readonly<ThumbnailCardProps>) {
  const { index, creative, isSelected, isRegenerating, selectedCreativeId, onSelect } = props;
  const showRegeneratingOverlay = isRegenerating && creative?.id === selectedCreativeId;

  return (
    <div className="flex flex-col gap-2 group">
      <div
        className={`relative bg-white rounded-xl border-2 shadow-md overflow-hidden transition-all hover:shadow-xl ${getThumbnailBorderClass(isSelected)}`}
        style={{ aspectRatio: aspectRatioToCssRatio(creative?.aspectRatio ?? "4:3") }}
      >
        {creative?.signedUrl && (
          <button
            type="button"
            onClick={() => onSelect(index)}
            className="absolute inset-0 z-10"
            aria-label={`Select variant ${index + 1}`}
          />
        )}
        <ThumbnailContent {...props} showRegeneratingOverlay={showRegeneratingOverlay} />
      </div>
      <div className="flex items-center justify-between px-1">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${getVariantLabelClass(isSelected)}`}>
          Variant 0{index + 1}
        </span>
        {creative?.signedUrl && <Check size={14} className="text-[#4CAF31]" />}
      </div>
    </div>
  );
}

export default function MultiPreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <MultiPreviewContent />
    </Suspense>
  );
}

function MultiPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const initialCreativeId = searchParams.get("creativeId");
  const withVideo = searchParams.get("withVideo") === "true";
  const { isPending, isAuthenticated } = useAuthGuard();

  const [activeTab, setActiveTab] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isAdapting, setIsAdapting] = useState(false);
  const [creatives, setCreatives] = useState<PreviewCreative[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [expectedVariants, setExpectedVariants] = useState(1); // Default to 1
  const [targetPlatforms, setTargetPlatforms] = useState<TargetPlatform[]>([]);
  const [agentUsage, setAgentUsage] = useState<{
    totalTokens: number; inputTokens: number; outputTokens: number; executionTimeMs: number;
  } | null>(null);
  const creativesRef = React.useRef<PreviewCreative[]>([]);
  const videoCreativeRef = React.useRef<PreviewCreative | null>(null);
  const hasInitializedRef = React.useRef(false);

  // Reset initialization flag when initialCreativeId changes
  useEffect(() => {
    hasInitializedRef.current = false;
  }, [initialCreativeId]);

  // Derive platform tabs from all platforms
  const platformTabs = buildPlatformTabs();

  // Fetch campaign data for targetPlatforms
  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/campaigns/${campaignId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const campaign = data?.campaign ?? data;
        const platforms = campaign?.targetPlatforms ?? [];
        setTargetPlatforms(platforms);
        // Set initial active tab to the first platform or first creative's platform
        if (platforms.length > 0) {
          const firstId = platforms[0].platformName.toLowerCase().replace(/[\s/]+/g, "-");
          // Ensure it's a valid id, fallback to instagram-feed
          const validTab = platformTabs.find(t => t.key === firstId);
          setActiveTab(validTab ? validTab.key : "instagram-feed");
        } else {
          setActiveTab("instagram-feed");
        }
      })
      .catch(() => setActiveTab("instagram-feed"));
  }, [campaignId]);

  // Check if we came from the editor (only then should we prevent back navigation)
  useEffect(() => {
    const fromEditor = searchParams.get("fromEditor") === "true";
    return setupEditorBackNavigation(fromEditor, campaignId, initialCreativeId);
  }, [searchParams, initialCreativeId, campaignId]);

  // Fetch brand logo URL once
  useEffect(() => {
    if (!campaignId) return;
    fetchCampaignBrandLogo(campaignId)
      .then((logoUrl) => {
        if (logoUrl) {
          setBrandLogoUrl(logoUrl);
        }
      })
      .catch(() => { });
  }, [campaignId]);

  const getDisplayUrl = useCallback((c: PreviewCreative): string | null => {
    return toProxyImageUrl(c?.url);
  }, []);

  const expectedVariantsRef = React.useRef(1);

  const fetchCampaignCreatives = useCallback(async () => {
    if (!campaignId) return;
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/creatives`);
      if (!res.ok) return;
      const data = await res.json();
      const all: PreviewCreative[] = data.creatives ?? [];
      const allImages = getImageCreatives(all);
      const isBatch = searchParams.get("batch") === "true";

      let imagesToShow: PreviewCreative[];
      let variantsCount: number;

      if (isBatch) {
        // Active generation session — filter by time window to group variants
        const initialRefCreative = getReferenceCreative(allImages, initialCreativeId);
        const refCreative = getRecentReferenceCreative(allImages, initialRefCreative, initialCreativeId);
        const sessionImages = getSessionImages(allImages, refCreative, initialCreativeId, isBatch);
        imagesToShow = [...sessionImages].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        // Always wait for the number of target platforms requested by the campaign
        variantsCount = targetPlatforms.length > 0 ? targetPlatforms.length : getExpectedVariantsCount(refCreative, initialCreativeId, imagesToShow.length, isBatch);
        console.log('[Preview] Batch mode — showing session images:', imagesToShow.length, 'expected:', variantsCount);
      } else if (initialCreativeId && !isBatch) {
        // Clicked a specific creative from the sidebar — load all generated variants for this campaign so the user can switch between them
        imagesToShow = [...allImages].filter(c => c.url).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        variantsCount = imagesToShow.length || 1;
        console.log('[Preview] Single creative mode (persisted gallery view) — loaded all campaign images for:', initialCreativeId);
      } else {
        // No filter — show ALL campaign images (persisted view)
        imagesToShow = [...allImages].filter(c => c.url).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        variantsCount = imagesToShow.length || 1;
        console.log('[Preview] Persist mode — showing all images:', imagesToShow.length);
      }

      const finalVariantsCount = variantsCount > 0 ? variantsCount : 1;
      setExpectedVariants(finalVariantsCount);
      expectedVariantsRef.current = finalVariantsCount;

      const enrichedImages = await Promise.all(
        imagesToShow.map(async (creative) => {
          const existing = creativesRef.current.find((prev) => prev.id === creative.id);
          if (existing?.signedUrl && creative.url && creative.url === existing.url) return existing;
          return { ...creative, signedUrl: getDisplayUrl(creative) };
        })
      );

      const latestVideo = getLatestVideoCreative(all);
      if (latestVideo && !videoCreativeRef.current?.signedUrl) {
        const enrichedVideo = { ...latestVideo, signedUrl: getDisplayUrl(latestVideo) };
        videoCreativeRef.current = enrichedVideo;
      }

      creativesRef.current = enrichedImages;
      const deduped = dedupeCreativesById(enrichedImages);
      setCreatives(deduped);
      // Update expected variants to total number of deduped creatives
      const totalCount = deduped.length;
      setExpectedVariants(totalCount);
      expectedVariantsRef.current = totalCount;

      // Auto-select the correct variant index and platform tab once on initial load
      if (initialCreativeId && !hasInitializedRef.current && deduped.length > 0) {
        const index = deduped.findIndex((c) => c.id === initialCreativeId);
        if (index !== -1) {
          setSelectedIndex(index);
          const currentCreative = deduped[index];
          const matchedTab = platformTabs.find(
            (t) => (currentCreative.platformName ? t.label.toLowerCase() === currentCreative.platformName.toLowerCase() : false) || t.aspectRatio === (currentCreative.aspectRatio || "1:1")
          );
          if (matchedTab) {
            setActiveTab(matchedTab.key);
          }
          hasInitializedRef.current = true;
        }
      }
    } catch (err) {
      console.error('Fetch creatives error:', err);
    }
  }, [campaignId, getDisplayUrl, initialCreativeId, targetPlatforms]);

  useEffect(() => {
    let cancelled = false;
    let count = 0;

    // Trigger initial fetch when targetPlatforms changes to ensure expectedVariants is updated immediately
    fetchCampaignCreatives();

    const poll = async () => {
      if (cancelled) return;
      await fetchCampaignCreatives();
      count++;
      const allReady = areExpectedVariantsReady(creativesRef.current, expectedVariantsRef.current);

      if (count >= MAX_POLLS || allReady) {
        console.log(`[Preview] Polling stopped. Count: ${count}, All ready: ${allReady}, Creatives: ${creativesRef.current.length}/${expectedVariantsRef.current}`);
        // Fetch the most recent agent trace for this creative once generation is done
        if (allReady && initialCreativeId) {
          fetch(`/api/agent-traces?creativeId=${encodeURIComponent(initialCreativeId)}&pageSize=1`, { cache: "no-store" })
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              const t = data?.traces?.[0];
              if (t && !cancelled) {
                setAgentUsage({
                  totalTokens: t.totalTokens ?? 0,
                  inputTokens: t.inputTokens ?? 0,
                  outputTokens: t.outputTokens ?? 0,
                  executionTimeMs: t.executionTimeMs ?? 0,
                });
              }
            })
            .catch(() => { });
        }
        return;
      }

      setTimeout(poll, getPreviewPollDelay(count));
    };
    poll();
    return () => { cancelled = true; };
  }, [fetchCampaignCreatives, initialCreativeId]);

  if (isPending) return <div className="flex min-h-screen items-center justify-center"><div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

  const handleGenerateVideo = async (sourceCreative: PreviewCreative) => {
    if (!campaignId || !sourceCreative) return;
    // Navigate to preview — the video preview page owns the agent stream
    router.push(`/preview/video?campaignId=${campaignId}&creativeId=${sourceCreative.id}&withImage=true`);
  };

  const handleDownload = async (creative: PreviewCreative) => {
    const url = creative.signedUrl;
    const id = creative.id;
    if (!url) return;

    try {
      const currentTab = platformTabs.find((t) => t.key === activeTab);
      const targetRatio = getTargetRatio(currentTab?.ratio ?? "1 / 1");
      const bgBlob = await fetch(url).then((response) => response.blob());
      const bgObjectUrl = URL.createObjectURL(bgBlob);
      const bgImg = await loadImageWithCors(bgObjectUrl);
      const canvasEl = createCroppedCanvas(bgImg, targetRatio);
      URL.revokeObjectURL(bgObjectUrl);

      if (brandLogoUrl && !creative.isEdited) {
        try {
          await drawBrandLogo(canvasEl, brandLogoUrl);
        } catch { }
      }

      if (!creative.isEdited && creative.adCopy && creative.adCopy.length <= 300) {
        drawCaption(canvasEl, creative.adCopy);
      }

      const blob = await exportCanvasBlob(canvasEl);
      downloadBlob(blob, `creative-${id.slice(0, 8)}-${activeTab}.png`);
    } catch {
      alert("Download failed.");
    }
  };

  const handlePublish = async (creative: PreviewCreative) => {
    if (!creative?.signedUrl) return;
    try {
      const res = await fetch(`/api/creatives/${creative.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (res.ok) {
        alert("Creative published successfully!");
        router.push(`/campaigns/${campaignId}`);
      } else {
        throw new Error("Publish failed");
      }
    } catch { alert("Failed to publish creative."); }
  };

  const handleRegenerate = async (creative: PreviewCreative, targetTab?: typeof platformTabs[0]) => {
    if (!creative || !campaignId) return;

    const confirmed = confirm("Regenerate this specific aspect ratio? This will reuse the original master image without changing its core contents.");
    if (!confirmed) return;

    try {
      setIsRegenerating(true);
      setCreatives((prev) => updateCreativeInList(prev, creative.id, (current) => ({ ...current, signedUrl: null, status: "GENERATING" })));

      const agentBase = "/api";
      const token = await getAgentToken();
      if (!token) throw new Error("Missing agent token");

      const currentTab = targetTab || platformTabs.find((t) => t.aspectRatio === (creative.aspectRatio || "1:1")) || platformTabs[0];
      const [tw, th] = currentTab.aspectRatio.split(":").map(Number);
      const targetIsLandscape = tw >= th;

      const allImageCreatives = creatives.filter(c => c.url);
      const landscapeMaster = allImageCreatives.find(c => {
        const [cw, ch] = (c.aspectRatio || "1:1").split(":").map(Number);
        return cw / ch > 1.2;
      });
      const portraitMaster = allImageCreatives.find(c => {
        const [cw, ch] = (c.aspectRatio || "1:1").split(":").map(Number);
        return ch / cw > 1.2;
      });

      let bestSource = creative;
      if (targetIsLandscape && landscapeMaster) {
        bestSource = landscapeMaster;
      } else if (!targetIsLandscape && portraitMaster) {
        bestSource = portraitMaster;
      } else if (landscapeMaster || portraitMaster) {
        bestSource = landscapeMaster ?? portraitMaster ?? creative;
      }

      const body = {
        campaign_id: campaignId,
        source_image_url: bestSource.url,
        target_aspect_ratio: currentTab.aspectRatio,
        platform_name: currentTab.label,
        target_creative_id: creative.id,
      };

      await fetch(`${agentBase}/agents/adapt-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      startRegenerationPoll({
        creativeId: creative.id,
        getDisplayUrl,
        onGenerated: (generatedCreative) => {
          setCreatives((prev) => replaceCreativeInList(prev, creative.id, generatedCreative));
          setIsRegenerating(false);
        },
        onTimeout: () => {
          setIsRegenerating(false);
          alert("Image generation is taking longer than expected. Please refresh the page.");
        },
      });
    } catch (err) {
      console.error("Regenerate failed:", err);
      setIsRegenerating(false);
      alert("Failed to regenerate image. Please try again.");
    }
  };

  const handleAdaptImage = async (sourceCreative: PreviewCreative, targetTab: typeof platformTabs[0]) => {
    if (!campaignId || !sourceCreative?.url || isAdapting) return;

    setIsAdapting(true);
    try {
      // 1. Create a placeholder creative in the DB first
      const createRes = await fetch(`/api/campaigns/${campaignId}/creatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "IMAGE",
          promptType: "GUIDED",
          platformName: targetTab.label,
          aspectRatio: targetTab.aspectRatio,
        }),
      });

      if (!createRes.ok) throw new Error("Failed to create creative placeholder");
      const createData = await createRes.json();
      const newCreativeId = createData?.creative?.id;

      if (!newCreativeId) throw new Error("No creative ID returned");

      const agentBase = "/api";
      const token = await getAgentToken();
      if (!token) throw new Error("Missing agent token");

      // Pick best master: for landscape-ish targets (W > H) use the landscape master,
      // for portrait/square targets (H >= W) use the portrait master.
      // We identify portrait vs landscape by their aspect ratio stored in the creative metadata.
      const [tw, th] = targetTab.aspectRatio.split(":").map(Number);
      const targetIsLandscape = tw >= th; // 1:1 and wider use landscape master

      const allImageCreatives = creatives.filter(c => c.url);
      const landscapeMaster = allImageCreatives.find(c => {
        const [cw, ch] = (c.aspectRatio || "1:1").split(":").map(Number);
        return cw / ch > 1.2; // 16:9 = 1.78, 4:3 = 1.33 etc.
      });
      const portraitMaster = allImageCreatives.find(c => {
        const [cw, ch] = (c.aspectRatio || "1:1").split(":").map(Number);
        return ch / cw > 1.2; // 9:16 = 1.78, 2:3 = 1.5 etc.
      });

      // Prefer the matching master; fall back to whichever exists, then sourceCreative
      let bestSource = sourceCreative;
      if (targetIsLandscape && landscapeMaster) {
        bestSource = landscapeMaster;
      } else if (!targetIsLandscape && portraitMaster) {
        bestSource = portraitMaster;
      } else if (landscapeMaster || portraitMaster) {
        bestSource = landscapeMaster ?? portraitMaster ?? sourceCreative;
      }

      const rawUrl = bestSource.url;
      console.log(`[Adapt] Target: ${targetTab.aspectRatio} (${targetIsLandscape ? 'landscape' : 'portrait/square'}) → using creative ${bestSource.id} (${bestSource.aspectRatio})`);

      const res = await fetch(`${agentBase}/agents/adapt-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          campaign_id: campaignId,
          source_image_url: rawUrl,
          target_aspect_ratio: targetTab.aspectRatio,
          platform_name: targetTab.label,
          creative_id: newCreativeId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Adapt failed");
      }

      const data = await res.json();
      const newImageUrl = data?.data?.image_url;
      const returnedCreativeId = data?.data?.creative_id;

      if (newImageUrl) {
        // Add the adapted image as a new entry in creatives display
        const adaptedCreative: PreviewCreative = {
          ...sourceCreative,
          id: returnedCreativeId || newCreativeId || `adapted-${targetTab.key}-${Date.now()}`,
          url: newImageUrl,
          signedUrl: toProxyImageUrl(newImageUrl),
          platformName: targetTab.label,
          aspectRatio: targetTab.aspectRatio,
          sourceId: sourceCreative.sourceId || sourceCreative.id,
        };
        setCreatives((prev) => [...prev, adaptedCreative]);
        setSelectedIndex(creatives.length); // Select the newly adapted image
      }
    } catch (err) {
      console.error("Adapt failed:", err);
      alert(`Failed to adapt image for ${targetTab.label}. Please try again.`);
    } finally {
      setIsAdapting(false);
    }
  };

  const selectedCreative = creatives[selectedIndex];

  // Check if current active tab matches the selected creative's aspect ratio
  const currentTab = platformTabs.find((t) => t.key === activeTab);
  const creativeAspectRatio = selectedCreative?.aspectRatio || "1:1";
  const creativeMatchesTab = currentTab && creativeAspectRatio === currentTab.aspectRatio;

  let selectedCreativeContent: React.ReactNode;

  if (!selectedCreative || isRegenerating) {
    selectedCreativeContent = (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 text-zinc-300 gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-zinc-100 border-t-[#4CAF31] animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          {isRegenerating ? "Regenerating Image..." : "Generating Creative..."}
        </p>
        {isRegenerating && <p className="text-[10px] text-zinc-400">This may take a few moments</p>}
      </div>
    );
  } else if (selectedCreative.signedUrl) {
    selectedCreativeContent = (
      <>
        <img
          src={selectedCreative.signedUrl}
          alt="Selected Variant"
          className="w-full h-full object-cover transition-opacity duration-500 opacity-100"
          onError={(e) => {
            const url = getDisplayUrl(selectedCreative);
            if (url) (e.target as HTMLImageElement).src = url;
          }}
        />
        {!creativeMatchesTab && currentTab && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-md gap-4 z-10 p-6 text-center">
            <div className="max-w-sm">
              <p className="text-base font-bold text-zinc-800 mb-2">
                You have created this for {selectedCreative.aspectRatio ? `${selectedCreative.aspectRatio} ratio` : "a different ratio"}.
              </p>
              <p className="text-sm text-zinc-600 mb-6">
                Let me regenerate this for {currentTab.label} ({currentTab.aspectRatio}) without changing the core image. I will just fill up the spaces to match the new aspect ratio.
              </p>
            </div>

            <button
              onClick={() => handleAdaptImage(selectedCreative, currentTab)}
              disabled={isAdapting}
              className="px-8 py-3.5 bg-[#4CAF31] text-white rounded-xl font-bold text-sm hover:bg-[#3d8e27] transition-all shadow-xl shadow-[#4CAF31]/30 flex items-center gap-2 disabled:opacity-50"
            >
              {isAdapting ? (
                <><Loader2 size={18} className="animate-spin" /> Regenerating...</>
              ) : (
                <><RotateCcw size={18} /> Regenerate for {currentTab.label}</>
              )}
            </button>
          </div>
        )}
        {brandLogoUrl && brandLogoUrl.trim() !== "" && !selectedCreative.isEdited && (
          <img src={brandLogoUrl} alt="Logo" className="absolute top-4 right-4 h-16 w-16 object-contain drop-shadow-lg" />
        )}
        {!selectedCreative.isEdited && selectedCreative.headlines && selectedCreative.headlines.length > 0 && (
          <div className="absolute inset-x-0 bottom-[22%] px-6">
            <h2 className="text-zinc-900 text-2xl font-bold text-center leading-tight">
              {selectedCreative.headlines[0]}
            </h2>
          </div>
        )}
        {!selectedCreative.isEdited && selectedCreative.adCopy && selectedCreative.adCopy.length <= 300 && (
          <div className="absolute inset-x-0 bottom-[10%] px-6">
            <p className="text-zinc-600 text-sm font-medium text-center leading-snug line-clamp-2">
              {selectedCreative.adCopy}
            </p>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/60 to-transparent flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-2">
            <button onClick={() => handleDownload(selectedCreative)} disabled={isRegenerating} title="Download" className="p-2.5 bg-white/90 backdrop-blur rounded-xl text-zinc-800 hover:bg-white shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={18} />
            </button>
            <button onClick={() => router.push(`/editor/image?creativeId=${selectedCreative.id}&campaignId=${campaignId}`)} disabled={isRegenerating} title="Edit" className="p-2.5 bg-white/90 backdrop-blur rounded-xl text-zinc-800 hover:bg-white shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              <PenSquare size={18} />
            </button>
            <button onClick={() => handleRegenerate(selectedCreative)} disabled={isRegenerating} title={isRegenerating ? "Regenerating..." : "Regenerate"} className="p-2.5 bg-white/90 backdrop-blur rounded-xl text-zinc-800 hover:bg-white shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              <RotateCcw size={18} className={isRegenerating ? "animate-spin" : ""} />
            </button>
            <button onClick={() => handleGenerateVideo(selectedCreative)} disabled={isRegenerating} title="Animate (Veo)" className="p-2.5 bg-zinc-900/90 backdrop-blur rounded-xl text-white hover:bg-black shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              <Video size={18} />
            </button>
            <button onClick={() => handlePublish(selectedCreative)} disabled={isRegenerating} title="Publish" className="p-2.5 bg-[#4CAF31]/90 backdrop-blur rounded-xl text-white hover:bg-[#4CAF31] shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              <Send size={18} />
            </button>
          </div>
          <div className="px-3 py-1 bg-[#4CAF31] text-white text-[10px] font-bold rounded-full shadow-lg">
            {isRegenerating ? "Regenerating..." : "Ready to Publish"}
          </div>
        </div>
      </>
    );
  } else {
    selectedCreativeContent = (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 gap-3">
        <Loader2 size={32} className="animate-spin text-[#4CAF31]" />
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
          Generating Variant {String(selectedIndex + 1).padStart(2, "0")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans text-zinc-900">

      {/* SIDEBAR */}
      <aside className="w-64 border-r border-zinc-200 bg-white flex flex-col shrink-0 h-screen sticky top-0">
        <Link href="/dashboard" className="block p-6">
          <h2 className="text-xl font-bold text-[#4CAF31] flex flex-col">
            <span>MARTECH</span>
            <span className="text-[10px] text-zinc-400 font-medium tracking-tight mt-0.5">
              Marketing . Technology . Solution.
            </span>
          </h2>
        </Link>
        <nav className="flex-1 px-4 py-2 space-y-6 overflow-y-auto">
          <div>
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 px-2">Overview</h3>
            <div className="space-y-1">
              <NavItem icon={<Home size={18} />} label="Home" onClick={() => router.push("/dashboard")} />
              <NavItem icon={<ShoppingCart size={18} />} label="Subscribed Product" />
              <NavItem icon={<LayoutGrid size={18} />} label="Marketplace" />
            </div>
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 px-2">Martech</h3>
            <div className="space-y-1">
              <NavItem icon={<Megaphone size={18} />} label="Campaign Manager" active onClick={() => {
                if (campaignId) {
                  router.push(`/campaigns/${campaignId}`);
                } else {
                  router.push("/dashboard");
                }
              }} />
              <div className="ml-4 border-l border-zinc-100 mt-1">
                <div className="py-2 px-6 text-sm font-semibold text-[#4CAF31] bg-[#F1F8F1] rounded-r-md border-r-4 border-[#4CAF31]">
                  Image Preview
                </div>
                {withVideo && (
                  <Link
                    href={`/preview/video?campaignId=${campaignId}&withImage=true`}
                    className="block py-2 px-6 text-sm text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 rounded-r-md transition-colors"
                  >
                    Video Preview
                  </Link>
                )}
              </div>
              <NavItem icon={<BarChart3 size={18} />} label="Analytics & Reports" />
            </div>
          </div>
        </nav>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-8 bg-white sticky top-0 z-20">
          <div className="text-sm flex items-center gap-2">
            <button onClick={() => router.push("/dashboard")} className="text-zinc-400 hover:text-zinc-700 transition-colors">Dashboard</button>
            <span className="text-zinc-300">&gt;</span>
            <button onClick={() => {
              if (campaignId) {
                router.push(`/campaigns/${campaignId}`);
              } else {
                router.push("/dashboard");
              }
            }} className="text-zinc-400 hover:text-zinc-700 transition-colors">Campaign Manager</button>
            <span className="text-zinc-300">&gt;</span>
            <span className="text-zinc-800 font-bold">Preview</span>
          </div>
          <div className="flex items-center gap-4">
            {withVideo && (
              <button
                onClick={() => router.push(`/preview/video?campaignId=${campaignId}&withImage=true`)}
                className="text-xs font-bold text-[#4CAF31] flex items-center gap-1 hover:underline"
              >
                <Video size={14} /> View Video Preview
              </button>
            )}
            <BrandAvatar size="sm" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 pb-32">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">Creative Variants</h1>
            <div className="flex bg-white rounded-xl p-1 border border-zinc-200 shadow-sm overflow-x-auto">
              {platformTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    // Prefer a generated variant with a signedUrl for this aspect ratio
                    const signedIndex = creatives.findIndex((c) => (c.aspectRatio || "1:1") === tab.aspectRatio && c.signedUrl);
                    if (signedIndex !== -1) {
                      setSelectedIndex(signedIndex);
                    } else {
                      // Fallback to any matching creative (may be placeholder)
                      const matchIndex = creatives.findIndex((c) => (c.aspectRatio || "1:1") === tab.aspectRatio);
                      if (matchIndex !== -1) setSelectedIndex(matchIndex);
                    }
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === tab.key ? "bg-[#4CAF31] text-white shadow-md" : "text-zinc-400 hover:text-zinc-600"
                    }`}
                >
                  {tab.label}
                  <span className="ml-1 text-[9px] opacity-60">{tab.aspectRatio}</span>
                </button>
              ))}
            </div>
          </div>

          {/* HERO — selected variant */}
          <div className="mb-6">
            <div
              className="relative bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden group mx-auto"
              style={{ aspectRatio: currentTab?.ratio ?? "1 / 1", maxHeight: "70vh", width: "auto" }}
            >
              {selectedCreativeContent}
            </div>
            <div className="flex items-center justify-between px-1 mt-2">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Variant {String(selectedIndex + 1).padStart(2, "0")}
              </span>
              {creatives[selectedIndex]?.signedUrl && <Check size={16} className="text-[#4CAF31]" />}
            </div>
          </div>

          {/* THUMBNAILS */}
          <div className="grid grid-cols-4 gap-4">
            {buildVariantSlots(creatives.length).map((index) => {
              const creative = creatives[index];
              return (
                <ThumbnailCard
                  key={index}
                  index={index}
                  creative={creative}
                  isSelected={index === selectedIndex}
                  isRegenerating={isRegenerating}
                  selectedCreativeId={creatives[selectedIndex]?.id}
                  brandLogoUrl={brandLogoUrl}
                  getDisplayUrl={getDisplayUrl}
                  onSelect={(index) => {
                    setSelectedIndex(index);
                    const selected = creatives[index];
                    if (selected) {
                      let matchingTab;
                      if (selected.platformName) {
                        matchingTab = platformTabs.find(t => t.label === selected.platformName);
                      }
                      if (!matchingTab && selected.aspectRatio) {
                        matchingTab = platformTabs.find(t => t.aspectRatio === selected.aspectRatio);
                      }
                      if (matchingTab) {
                        setActiveTab(matchingTab.key);
                      }
                    }
                  }}
                  onDownload={handleDownload}
                  onEdit={(creativeId) => router.push(`/editor/image?creativeId=${creativeId}&campaignId=${campaignId}`)}
                  onRegenerate={handleRegenerate}
                  onAdapt={(creative, platformKey) => {
                    const targetTab = platformTabs.find((t) => t.key === platformKey);
                    if (targetTab) handleAdaptImage(creative, targetTab);
                  }}
                  platformTabs={platformTabs}
                  onGenerateVideo={handleGenerateVideo}
                  onPublish={handlePublish}
                />
              );
            })}
          </div>
        </div>

        {/* STICKY BOTTOM BAR */}
        <footer className="h-24 border-t border-zinc-200 bg-white/80 backdrop-blur-md sticky bottom-0 z-20 flex items-center justify-between px-12">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">{buildVariantStatusDots(creatives.length, creatives)}</div>
            <p className="text-xs font-bold text-zinc-400">
              {creatives.filter(c => c.signedUrl).length} of {creatives.length} Images Generated
            </p>
            {agentUsage && (
              <AgentUsageBadge
                totalTokens={agentUsage.totalTokens}
                inputTokens={agentUsage.inputTokens}
                outputTokens={agentUsage.outputTokens}
                executionTimeMs={agentUsage.executionTimeMs}
              />
            )}
          </div>
          <div className="flex items-center gap-4">
            {withVideo && (
              <button
                onClick={() => router.push(`/preview/video?campaignId=${campaignId}&withImage=true`)}
                className="px-6 py-3 border border-zinc-200 bg-white text-zinc-700 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-all flex items-center gap-2"
              >
                <Video size={16} /> View Video
              </button>
            )}
            <button
              onClick={() => handlePublish(creatives[selectedIndex])}
              disabled={!creatives.some(c => c.signedUrl)}
              className="px-10 py-3.5 bg-[#4CAF31] text-white rounded-2xl font-bold text-sm hover:bg-[#3d8e27] transition-all shadow-xl shadow-[#4CAF31]/30 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={18} /> Publish Best Creative
            </button>
          </div>
        </footer>
      </main>
    </div >
  );
}

function NavItem({ icon, label, active = false, onClick }: { readonly icon: React.ReactNode; readonly label: string; readonly active?: boolean; readonly onClick?: () => void }) {
  const className = `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${active ? "text-[#4CAF31] bg-[#F1F8F1]" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
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
