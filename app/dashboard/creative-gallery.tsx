"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenSquare, Play } from "lucide-react";

const DISPLAY_TYPES = new Set(["IMAGE", "VIDEO", "REEL", "STORY"]);
const VIDEO_TYPES = new Set(["VIDEO", "REEL", "STORY"]);

interface Creative {
  id: string;
  url: string | null;
  status: string;
  campaignId: string;
  type: string;
  signedUrl?: string;
}

interface Campaign {
  id: string;
}

type SignedUrlFetcher = (id: string) => Promise<string | null>;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getCampaigns(data: any): Campaign[] {
  return Array.isArray(data) ? data : (data.campaigns ?? []);
}

function isDisplayCreative(creative: Creative) {
  return creative.url && creative.status === "GENERATED" && DISPLAY_TYPES.has(creative.type);
}

async function fetchCampaignCreatives(campaignId: string): Promise<Creative[]> {
  try {
    const res = await fetch(`/api/campaigns/${campaignId}/creatives`);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.creatives ?? []).filter(isDisplayCreative);
  } catch {
    return [];
  }
}

function dedupeCreatives(creatives: Creative[]) {
  const seen = new Set<string>();

  return creatives.filter(creative => {
    if (seen.has(creative.id)) return false;
    seen.add(creative.id);
    return true;
  });
}

async function enrichWithSignedUrls(creatives: Creative[], fetchSignedUrl: SignedUrlFetcher) {
  const enriched: Creative[] = [];

  for (const creative of creatives) {
    const signedUrl = await fetchSignedUrl(creative.id) ?? undefined;
    if (signedUrl) enriched.push({ ...creative, signedUrl });
    await delay(150);
  }

  return enriched;
}

async function loadCreatives(fetchSignedUrl: SignedUrlFetcher) {
  const campaignsRes = await fetch("/api/campaigns");
  const campaigns = getCampaigns(await campaignsRes.json());
  const creativeGroups = await Promise.all(
    campaigns.map(campaign => fetchCampaignCreatives(campaign.id))
  );
  const recent = dedupeCreatives(creativeGroups.flat()).slice(0, 8);

  return enrichWithSignedUrls(recent, fetchSignedUrl);
}

interface CreativeCardProps {
  creative: Creative;
  onOpen: (creative: Creative) => void;
  onEdit: (creative: Creative) => void;
}

function CreativeCard({ creative, onOpen, onEdit }: Readonly<CreativeCardProps>) {
  const isVideo = VIDEO_TYPES.has(creative.type);

  return (
    <div
      className="relative shrink-0 w-40 rounded-xl overflow-hidden border border-zinc-100 shadow-sm group hover:shadow-md transition-shadow"
    >
      <button
        type="button"
        onClick={() => onOpen(creative)}
        aria-label="View creative preview"
        className="absolute inset-0 z-10"
      />
      {isVideo ? (
        <video
          src={creative.signedUrl!}
          className="w-full aspect-[3/4] object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={creative.signedUrl!}
          alt="Creative"
          className="w-full aspect-[3/4] object-cover"
          onError={(e) => {
            console.error("[gallery] Image failed to load:", creative.signedUrl);
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      {/* Edit overlay */}
      <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
        {isVideo && (
          <div className="absolute top-2 left-2 bg-black/60 rounded-full p-1">
            <Play size={10} className="text-white fill-white" />
          </div>
        )}
        {!isVideo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(creative);
            }}
            className="pointer-events-auto relative z-20 flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-zinc-800 shadow hover:bg-zinc-50 transition-colors"
          >
            <PenSquare size={12} /> Edit
          </button>
        )}
      </div>
    </div>
  );
}

export default function CreativeGallery() {
  const router = useRouter();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignedUrl = useCallback(async (id: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/creatives/${id}/signed-url`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.url ?? null;
    } catch { return null; }
  }, []);

  useEffect(() => {
    loadCreatives(fetchSignedUrl)
      .then(setCreatives)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchSignedUrl]);

  const openCreative = useCallback((creative: Creative) => {
    router.push(
      VIDEO_TYPES.has(creative.type)
        ? `/preview/video?campaignId=${creative.campaignId}&creativeId=${creative.id}`
        : `/preview/image?campaignId=${creative.campaignId}&creativeId=${creative.id}`
    );
  }, [router]);

  const editCreative = useCallback((creative: Creative) => {
    router.push(`/editor/image?creativeId=${creative.id}&campaignId=${creative.campaignId}`);
  }, [router]);

  if (loading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-bold text-zinc-900">Your Saved Creatives</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[#4CAF31]" />
        </div>
      </div>
    );
  }

  if (creatives.length === 0) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Your Saved Creatives</h2>
          <p className="text-xs text-zinc-400 mt-0.5">View, edit, and create your templates</p>
        </div>
        <span className="text-xs text-zinc-400">{creatives.length} generated</span>
      </div>

      <div className="p-4">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {creatives.map(creative => (
            <CreativeCard
              key={creative.id}
              creative={creative}
              onOpen={openCreative}
              onEdit={editCreative}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
