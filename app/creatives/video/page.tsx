"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import {
  GeneratedVideosPanel,
  VideoCreativeSidebar,
  VideoPromptForm,
  type VideoCreativeFormData,
  type VideoCreativeRecord,
  type VideoDropdownOptions,
} from "@/components/creatives/VideoCreativeSections";

const DEFAULT_DROPDOWN_OPTIONS: VideoDropdownOptions = {
  cameraMovement: ["dolly zoom", "pan left", "pan right", "tilt up", "tilt down", "static", "handheld", "aerial drone", "tracking shot"],
  transition: ["cut", "fade", "dissolve", "wipe", "zoom in", "zoom out"],
  aspectRatio: ["9:16", "16:9", "1:1", "4:3"],
  duration: ["5", "8", "10", "15", "30"],
  mood: ["energetic", "calm", "dramatic", "playful", "professional", "romantic", "mysterious"],
  lighting: ["natural daylight", "golden hour", "studio lighting", "neon", "candlelight", "overcast", "backlit"],
};

const DEFAULT_FORM_DATA: VideoCreativeFormData = {
  visuals: {
    subject: "",
    scene: "",
    lighting: "natural daylight",
  },
  motion: {
    cameraMovement: "dolly zoom",
    transition: "cut",
    description: "",
  },
  format: {
    aspectRatio: "9:16",
    duration: "8",
  },
  audio: {
    mood: "energetic",
    soundscape: "",
  },
};

type VideoSectionKey = "visuals" | "motion" | "format" | "audio";

function parsePrompt(value: unknown) {
  if (!value) return null;

  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function mergeCreativePrompts(creative: any, previous: VideoCreativeFormData): VideoCreativeFormData {
  const visuals = parsePrompt(creative.guidedVideoVisualsPrompt);
  const motion = parsePrompt(creative.guidedVideoMotionPrompt);
  const format = parsePrompt(creative.guidedVideoFormatPrompt);
  const audio = parsePrompt(creative.guidedVideoAudioPrompt);

  return {
    visuals: {
      subject: visuals?.subject || previous.visuals.subject,
      scene: visuals?.scene || previous.visuals.scene,
      lighting: visuals?.lighting || previous.visuals.lighting,
    },
    motion: {
      cameraMovement: motion?.cameraMovement || previous.motion.cameraMovement,
      transition: motion?.transition || previous.motion.transition,
      description: motion?.description || previous.motion.description,
    },
    format: {
      aspectRatio: format?.aspectRatio || previous.format.aspectRatio,
      duration: format?.duration || previous.format.duration,
    },
    audio: {
      mood: audio?.mood || previous.audio.mood,
      soundscape: audio?.soundscape || previous.audio.soundscape,
    },
  };
}

async function fetchSourceCreativeBrief(creativeId: string | null) {
  if (!creativeId) return null;

  try {
    const response = await fetch(`/api/creatives/${creativeId}`);
    if (!response.ok) return null;

    const data = await response.json();
    return data.creative?.creativeBrief ?? data.creativeBrief ?? null;
  } catch {
    return null;
  }
}

async function fetchSignedCreativeUrl(id: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/creatives/${id}/signed-url`);
    if (!response.ok) return null;

    const data = await response.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function VideoCreativesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <VideoCreativesContent />
    </Suspense>
  );
}

function VideoCreativesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const creativeIdFromUrl = searchParams.get("creativeId");
  const briefFromUrl = searchParams.get("brief");
  const { isPending, isAuthenticated } = useAuthGuard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openSection, setOpenSection] = useState<VideoSectionKey | null>("visuals");
  const [dropdownOptions, setDropdownOptions] = useState(DEFAULT_DROPDOWN_OPTIONS);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [creatives, setCreatives] = useState<VideoCreativeRecord[]>([]);
  const [dirtyBriefs, setDirtyBriefs] = useState<Record<string, string>>({});

  const addDropdownOption = (field: keyof VideoDropdownOptions, value: string) => {
    const trimmed = value.trim();
    if (!trimmed || dropdownOptions[field].includes(trimmed)) return;

    setDropdownOptions((prev) => ({ ...prev, [field]: [...prev[field], trimmed] }));
  };

  const loadCreatives = useCallback(async () => {
    if (!campaignId) return;

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/creatives`);
      if (!response.ok) return;

      const data = await response.json();
      const videos: VideoCreativeRecord[] = (data.creatives ?? []).filter((creative: any) => creative.type === "VIDEO");
      const enriched = await Promise.all(
        videos.map(async (creative) => ({
          ...creative,
          signedUrl: creative.signedUrl ?? (creative.url ? await fetchSignedCreativeUrl(creative.id) : null),
        }))
      );
      setCreatives(enriched);
    } catch {
      // Keep the panel quiet; manual refresh is available.
    }
  }, [campaignId]);

  useEffect(() => {
    loadCreatives();
  }, [loadCreatives]);

  useEffect(() => {
    if (!briefFromUrl && !creativeIdFromUrl) return;
    if (!creativeIdFromUrl) return;

    fetch(`/api/creatives/${creativeIdFromUrl}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        setFormData((previous) => mergeCreativePrompts(data.creative ?? data, previous));
      })
      .catch(() => {});
  }, [briefFromUrl, creativeIdFromUrl]);

  if (isPending) return <LoadingState />;
  if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

  const handleDownload = async (url: string, id: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `video-${id.slice(0, 8)}.mp4`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      alert("Download failed.");
    }
  };

  const handleGenerate = async () => {
    if (!campaignId) {
      alert("Campaign ID is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const creativeBrief = await fetchSourceCreativeBrief(creativeIdFromUrl);
      const response = await fetch(`/api/campaigns/${campaignId}/creatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "VIDEO",
          promptType: "GUIDED",
          guidedVideoVisualsPrompt: JSON.stringify(formData.visuals),
          guidedVideoMotionPrompt: JSON.stringify(formData.motion),
          guidedVideoFormatPrompt: JSON.stringify(formData.format),
          guidedVideoAudioPrompt: JSON.stringify(formData.audio),
          ...(creativeBrief ? { creativeBrief } : {}),
        }),
      });

      if (!response.ok) throw new Error("Failed to create creative");

      const data = await response.json();
      const newCreativeId = data.creative?.id;
      setCreatives((prev) => [{ ...data.creative, signedUrl: null }, ...prev]);
      router.replace(`/preview/video?campaignId=${campaignId}&creativeId=${newCreativeId}&generate=true`);
    } catch (err) {
      console.error(err);
      alert("Error generating video.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const regenerateWithBrief = async (creative: VideoCreativeRecord) => {
    const brief = dirtyBriefs[creative.id];
    if (!campaignId || !brief) return;

    await fetch(`/api/creatives/${creative.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creativeBrief: brief }),
    });
    setDirtyBriefs((prev) => {
      const next = { ...prev };
      delete next[creative.id];
      return next;
    });

    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      router.replace(`/preview/video?campaignId=${campaignId}`);
      return;
    }

    router.replace(`/preview/video?campaignId=${campaignId}&creativeId=${creative.id}&generate=true`);
  };

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] font-sans text-zinc-900">
      <VideoCreativeSidebar campaignId={campaignId} onNavigate={router.push} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8">
          <div className="text-sm font-medium text-zinc-500 flex items-center gap-2">
            <button onClick={() => router.push("/dashboard")} className="hover:text-zinc-900">Dashboard</button>
            <span>&gt;</span>
            <span className="text-zinc-500">Campaign Manager</span>
            <span>&gt;</span>
            <span className="text-zinc-900 font-bold">Video Creative</span>
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-y-auto border-r border-zinc-200">
            <VideoPromptForm
              formData={formData}
              dropdownOptions={dropdownOptions}
              openSection={openSection}
              isSubmitting={isSubmitting}
              setFormData={setFormData}
              setOpenSection={setOpenSection}
              addDropdownOption={addDropdownOption}
              onGenerate={handleGenerate}
            />
          </div>
          <GeneratedVideosPanel
            creatives={creatives}
            campaignId={campaignId}
            dirtyBriefs={dirtyBriefs}
            loadCreatives={loadCreatives}
            setDirtyBriefs={setDirtyBriefs}
            onDownload={handleDownload}
            onRegenerate={regenerateWithBrief}
          />
        </div>
      </main>
    </div>
  );
}
