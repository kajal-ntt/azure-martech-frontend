"use client";

import Link from "next/link";
import {
  Download,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  AccordionSection,
  CreativeSidebar,
  DropdownField,
  formatCreativeBrief,
  InputField,
} from "@/components/creatives/CreativeLayoutParts";

export interface VideoCreativeFormData {
  visuals: {
    subject: string;
    scene: string;
    lighting: string;
  };
  motion: {
    cameraMovement: string;
    transition: string;
    description: string;
  };
  format: {
    aspectRatio: string;
    duration: string;
  };
  audio: {
    mood: string;
    soundscape: string;
  };
}

export interface VideoDropdownOptions {
  cameraMovement: string[];
  transition: string[];
  aspectRatio: string[];
  duration: string[];
  mood: string[];
  lighting: string[];
}

export interface VideoCreativeRecord {
  id: string;
  status: string;
  url?: string | null;
  signedUrl?: string | null;
  creativeBrief?: string | null;
}

type VideoSectionKey = "visuals" | "motion" | "format" | "audio";

function updateVideoFormField(
  value: VideoCreativeFormData,
  section: keyof VideoCreativeFormData,
  field: string,
  nextValue: string
): VideoCreativeFormData {
  return {
    ...value,
    [section]: {
      ...value[section],
      [field]: nextValue,
    },
  };
}

export function VideoCreativeSidebar({
  campaignId,
  onNavigate,
}: Readonly<{
  campaignId: string | null;
  onNavigate: (href: string) => void;
}>) {
  return <CreativeSidebar activeType="video" campaignId={campaignId} onNavigate={onNavigate} />;
}

export function VideoPromptForm({
  formData,
  dropdownOptions,
  openSection,
  isSubmitting,
  setFormData,
  setOpenSection,
  addDropdownOption,
  onGenerate,
}: Readonly<{
  formData: VideoCreativeFormData;
  dropdownOptions: VideoDropdownOptions;
  openSection: VideoSectionKey | null;
  isSubmitting: boolean;
  setFormData: (value: VideoCreativeFormData) => void;
  setOpenSection: (value: VideoSectionKey | null) => void;
  addDropdownOption: (field: keyof VideoDropdownOptions, value: string) => void;
  onGenerate: () => void;
}>) {
  const updateField = (section: keyof VideoCreativeFormData, field: string, value: string) => {
    setFormData(updateVideoFormField(formData, section, field, value));
  };
  const toggleSection = (section: VideoSectionKey) => setOpenSection(openSection === section ? null : section);

  return (
    <div className="p-8 space-y-4 flex-1 max-w-3xl mx-auto w-full">
      <h2 className="text-xl font-bold">Video Prompts</h2>

      <AccordionSection title="Visuals" isOpen={openSection === "visuals"} onToggle={() => toggleSection("visuals")}>
        <div className="space-y-3">
          <InputField label="Subject" placeholder="e.g. young professional in a modern office" value={formData.visuals.subject} onChange={(value) => updateField("visuals", "subject", value)} />
          <InputField label="Scene / Setting" placeholder="e.g. rooftop at sunset, busy city street" value={formData.visuals.scene} onChange={(value) => updateField("visuals", "scene", value)} />
          <InputField label="Lighting" placeholder="e.g. natural daylight, golden hour, neon" value={formData.visuals.lighting} onChange={(value) => updateField("visuals", "lighting", value)} />
        </div>
      </AccordionSection>

      <AccordionSection title="Motion & Camera" isOpen={openSection === "motion"} onToggle={() => toggleSection("motion")}>
        <div className="space-y-3">
          <InputField label="Camera Movement" placeholder="e.g. dolly zoom, pan left, tracking shot" value={formData.motion.cameraMovement} onChange={(value) => updateField("motion", "cameraMovement", value)} />
          <InputField label="Transition Style" placeholder="e.g. cut, fade, dissolve, wipe" value={formData.motion.transition} onChange={(value) => updateField("motion", "transition", value)} />
          <InputField label="Motion Description" placeholder="e.g. slow push in on product, quick cuts between scenes" value={formData.motion.description} onChange={(value) => updateField("motion", "description", value)} />
        </div>
      </AccordionSection>

      <AccordionSection title="Format" isOpen={openSection === "format"} onToggle={() => toggleSection("format")}>
        <div className="space-y-3">
          <DropdownField label="Aspect Ratio" value={formData.format.aspectRatio} options={dropdownOptions.aspectRatio} onSelect={(value) => updateField("format", "aspectRatio", value)} onAdd={(value) => addDropdownOption("aspectRatio", value)} />
          <DropdownField label="Duration (seconds)" value={formData.format.duration} options={dropdownOptions.duration} onSelect={(value) => updateField("format", "duration", value)} onAdd={(value) => addDropdownOption("duration", value)} />
        </div>
      </AccordionSection>

      <AccordionSection title="Audio & Mood" isOpen={openSection === "audio"} onToggle={() => toggleSection("audio")}>
        <div className="space-y-3">
          <InputField label="Mood" placeholder="e.g. energetic, calm, dramatic, playful" value={formData.audio.mood} onChange={(value) => updateField("audio", "mood", value)} />
          <InputField label="Soundscape" placeholder="e.g. upbeat background music, ambient city sounds, no music" value={formData.audio.soundscape} onChange={(value) => updateField("audio", "soundscape", value)} />
        </div>
      </AccordionSection>

      <button onClick={onGenerate} disabled={isSubmitting} className="w-full py-3 bg-[#4CAF31] rounded-lg text-sm font-bold text-white hover:bg-[#3d8e27] flex items-center justify-center gap-2 disabled:opacity-50">
        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
        Generate Video
      </button>
    </div>
  );
}

function updateDirtyBrief(
  creative: VideoCreativeRecord,
  value: string,
  setDirtyBriefs: (updater: (prev: Record<string, string>) => Record<string, string>) => void
) {
  setDirtyBriefs((prev) => {
    const next = { ...prev };
    if (value === creative.creativeBrief) {
      delete next[creative.id];
    } else {
      next[creative.id] = value;
    }
    return next;
  });
}

function VideoThumbnail({ creative, previewHref }: Readonly<{ creative: VideoCreativeRecord; previewHref: string }>) {
  if (!creative.signedUrl) {
    return (
      <div className="w-full aspect-video bg-zinc-100 flex items-center justify-center gap-2 text-zinc-400">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-xs">Generating...</span>
      </div>
    );
  }

  return (
    <Link href={previewHref} className="block">
      <video
        src={creative.signedUrl}
        className="w-full aspect-video object-cover"
        muted
        playsInline
        preload="metadata"
        onMouseEnter={(event) => {
          const video = event.target as HTMLVideoElement;
          video.play().catch(() => {});
        }}
        onMouseLeave={(event) => {
          const video = event.target as HTMLVideoElement;
          video.pause();
          video.currentTime = 0;
        }}
        onError={() => {}}
      />
    </Link>
  );
}

function CreativeBriefEditor({
  creative,
  dirtyBrief,
  setDirtyBriefs,
  onRegenerate,
}: Readonly<{
  creative: VideoCreativeRecord;
  dirtyBrief?: string;
  setDirtyBriefs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onRegenerate: (creative: VideoCreativeRecord) => void;
}>) {
  const showBrief = creative.creativeBrief || creative.status === "PENDING" || creative.status === "GENERATING";
  if (!showBrief) return null;

  return (
    <div className="px-3 pb-3 bg-white border-t border-zinc-50">
      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mt-2 mb-1">Creative Brief</p>
      {creative.creativeBrief ? (
        <>
          <textarea
            defaultValue={formatCreativeBrief(creative.creativeBrief)}
            rows={3}
            onChange={(event) => updateDirtyBrief(creative, event.target.value, setDirtyBriefs)}
            className="w-full text-[11px] text-zinc-600 leading-relaxed border border-zinc-100 rounded p-1.5 resize-none focus:border-[#4CAF31] outline-none bg-zinc-50"
          />
          {dirtyBrief && (
            <button
              onClick={() => onRegenerate(creative)}
              className="mt-1.5 w-full py-1.5 bg-[#4CAF31] text-white text-[11px] font-bold rounded-lg hover:bg-[#3d8e27] flex items-center justify-center gap-1"
            >
              <RotateCcw size={10} /> Regenerate with updated brief
            </button>
          )}
        </>
      ) : (
        <p className="text-[11px] text-zinc-400 italic">Agent is generating brief...</p>
      )}
    </div>
  );
}

function VideoCreativeCard({
  creative,
  campaignId,
  dirtyBrief,
  setDirtyBriefs,
  onDownload,
  onRegenerate,
}: Readonly<{
  creative: VideoCreativeRecord;
  campaignId: string | null;
  dirtyBrief?: string;
  setDirtyBriefs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onDownload: (url: string, id: string) => void;
  onRegenerate: (creative: VideoCreativeRecord) => void;
}>) {
  const previewHref = `/preview/video?campaignId=${campaignId}&creativeId=${creative.id}`;
  const cardClass = creative.signedUrl
    ? "border-zinc-200 hover:border-[#4CAF31] hover:shadow-sm"
    : "border-zinc-100 opacity-60";

  return (
    <div className={`rounded-xl overflow-hidden border transition-all ${cardClass}`}>
      <VideoThumbnail creative={creative} previewHref={previewHref} />
      <div className="px-3 py-2 bg-white flex items-center justify-between">
        <div>
          <p className="text-[10px] text-zinc-400 truncate">{creative.id.slice(0, 8)}...</p>
          <p className={`text-[10px] font-semibold ${creative.status === "GENERATED" ? "text-[#4CAF31]" : "text-zinc-400"}`}>
            {creative.status}
          </p>
        </div>
        {creative.signedUrl && (
          <button onClick={() => onDownload(creative.signedUrl ?? "", creative.id)} title="Download" className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700">
            <Download size={13} />
          </button>
        )}
      </div>
      <CreativeBriefEditor
        creative={creative}
        dirtyBrief={dirtyBrief}
        setDirtyBriefs={setDirtyBriefs}
        onRegenerate={onRegenerate}
      />
    </div>
  );
}

export function GeneratedVideosPanel({
  creatives,
  campaignId,
  dirtyBriefs,
  loadCreatives,
  setDirtyBriefs,
  onDownload,
  onRegenerate,
}: Readonly<{
  creatives: VideoCreativeRecord[];
  campaignId: string | null;
  dirtyBriefs: Record<string, string>;
  loadCreatives: () => void;
  setDirtyBriefs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onDownload: (url: string, id: string) => void;
  onRegenerate: (creative: VideoCreativeRecord) => void;
}>) {
  return (
    <div className="w-80 shrink-0 flex flex-col overflow-y-auto bg-white">
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-700">Generated Videos</h2>
        <button onClick={loadCreatives} className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
          <RotateCcw size={12} /> Refresh
        </button>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        {creatives.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center mt-8">No videos yet. Generate one using the form.</p>
        ) : (
          <div className="space-y-3">
            {creatives.map((creative) => (
              <VideoCreativeCard
                key={creative.id}
                creative={creative}
                campaignId={campaignId}
                dirtyBrief={dirtyBriefs[creative.id]}
                setDirtyBriefs={setDirtyBriefs}
                onDownload={onDownload}
                onRegenerate={onRegenerate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
