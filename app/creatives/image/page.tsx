"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Loader2, RotateCcw, Plus, Download,
} from "lucide-react";
import { getAgentToken } from "@/lib/auth-client";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import {
    AccordionSection,
    CreativeSidebar,
    DropdownField,
    formatCreativeBrief,
    InputField,
} from "@/components/creatives/CreativeLayoutParts";

export default function CreativesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
            <CreativesContent />
        </Suspense>
    );
}

function CreativesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const campaignId = searchParams.get("campaignId");
    const creativeIdFromUrl = searchParams.get("creativeId");
    const { isPending, isAuthenticated } = useAuthGuard();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openSection, setOpenSection] = useState<string | null>("background");
    const [variants, setVariants] = useState(1);

    // Intercept browser back button to prevent leaving localhost
    useEffect(() => {
        if (!campaignId) return;

        // Push a dummy state to create history entry
        globalThis.history.pushState({ page: 'image-creative' }, '', globalThis.location.href);

        const handlePopState = (e: PopStateEvent) => {
            // When user clicks back, redirect to campaign page instead
            e.preventDefault();
            router.push(`/campaigns/${campaignId}`);
        };

        globalThis.addEventListener('popstate', handlePopState);

        return () => {
            globalThis.removeEventListener('popstate', handlePopState);
        };
    }, [campaignId, router]);

    // Dropdown options state — users can add custom values
    const [dropdownOptions, setDropdownOptions] = useState({
        scene: ["forest", "beach", "city", "mountains", "studio", "garden", "indoor", "outdoor"],
        style: ["2d", "3d", "realistic", "cartoon", "watercolor", "minimalist", "vintage", "modern"],
        age: ["18-24", "25-34", "35-44", "45-54", "55+", "all ages"],
        fontStyle: ["Mayfest", "Inter", "Playfair Display", "Montserrat", "Roboto", "Lato", "Poppins", "Georgia"],
    });

    const addDropdownOption = (field: keyof typeof dropdownOptions, value: string) => {
        if (!value.trim() || dropdownOptions[field].includes(value.trim())) return;
        setDropdownOptions(prev => ({ ...prev, [field]: [...prev[field], value.trim()] }));
    };

    const [formData, setFormData] = useState({
        background: { name: "", theme: "", colorPalette: "", scene: "" },
        graphic: { name: "", primaryType: "images", style: "realistic", elements: "" },
        actors: { visualSegment: "", subject: "", age: "", clothing: "", theme: "" },
        text: { headline: "", tagline: "", fontStyle: "Inter", language: "English" },
    });

    // ── Right panel state ─────────────────────────────────────────────────────
    const [creatives, setCreatives] = useState<any[]>([]);
    const [dirtyBriefs, setDirtyBriefs] = useState<Record<string, string>>({});

    const fetchSignedUrl = useCallback(async (id: string): Promise<string | null> => {
        try {
            const res = await fetch(`/api/creatives/${id}/signed-url`);
            if (!res.ok) return null;
            const data = await res.json();
            return data.url ?? null;
        } catch { return null; }
    }, []);

    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadCreatives = useCallback(async () => {
        if (!campaignId) return;
        try {
            const res = await fetch(`/api/campaigns/${campaignId}/creatives`);
            if (!res.ok) return;
            const data = await res.json();
            // Only show IMAGE creatives in this panel
            const list: any[] = (data.creatives ?? []).filter((c: any) => c.type === "IMAGE");
            const enriched = await Promise.all(list.map(async (c) => ({
                ...c,
                signedUrl: c.url ? await fetchSignedUrl(c.id) : null,
            })));
            setCreatives(enriched);

            const stillPending = enriched.some(c => c.status === "PENDING" || c.status === "GENERATING" || (c.url && !c.signedUrl));
            if (stillPending) {
                pollRef.current = setTimeout(loadCreatives, 4000);
            }
        } catch { }
    }, [campaignId, fetchSignedUrl]);

    // Clear poll timer on unmount
    useEffect(() => {
        return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    }, []);

    useEffect(() => { loadCreatives(); }, [loadCreatives]);

    // Pre-fill form from creative's guided prompt fields
    useEffect(() => {
        if (!creativeIdFromUrl) return;
        fetch(`/api/creatives/${creativeIdFromUrl}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                const c = data.creative ?? data;

                const tryParse = (val: any) => {
                    if (!val) return null;
                    try { return typeof val === "string" ? JSON.parse(val) : val; } catch { return null; }
                };

                const bg = tryParse(c.guidedBackgroundPrompt);
                const graphic = tryParse(c.guidedGraphicPrompt);
                const actors = tryParse(c.guidedActorsPrompt);
                const text = tryParse(c.guidedTextPrompt);

                setFormData(prev => ({
                    background: {
                        name: bg?.name || prev.background.name,
                        theme: bg?.theme || prev.background.theme,
                        colorPalette: bg?.colorPalette || prev.background.colorPalette,
                        scene: bg?.scene || prev.background.scene,
                    },
                    graphic: {
                        name: graphic?.name || prev.graphic.name,
                        primaryType: graphic?.primaryType || prev.graphic.primaryType,
                        style: graphic?.style || prev.graphic.style,
                        elements: graphic?.elements || prev.graphic.elements,
                    },
                    actors: {
                        visualSegment: actors?.visualSegment || prev.actors.visualSegment,
                        subject: actors?.subject || prev.actors.subject,
                        age: actors?.age || prev.actors.age,
                        clothing: actors?.clothing || prev.actors.clothing,
                        theme: actors?.theme || prev.actors.theme,
                    },
                    text: {
                        headline: text?.headline || prev.text.headline,
                        tagline: text?.tagline || prev.text.tagline,
                        fontStyle: text?.fontStyle || prev.text.fontStyle,
                        language: text?.language || prev.text.language,
                    },
                }));
            })
            .catch(() => { });
    }, [creativeIdFromUrl]);

    if (isPending) return <div className="flex min-h-screen items-center justify-center"><div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" /></div>;
    if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

    const handleDownload = async (url: string, id: string) => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const ext = blob.type.includes("video") ? "mp4" : "png";
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `creative-${id.slice(0, 8)}.${ext}`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch { alert("Download failed."); }
    };

    const saveBrief = async (creativeId: string, brief: string) => {
        try {
            await fetch(`/api/creatives/${creativeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ creativeBrief: brief }),
            });
        } catch { /* silent — brief is non-critical */ }
    };

    const regenerateWithBrief = async (creativeId: string) => {
        const brief = dirtyBriefs[creativeId];
        if (!campaignId) return;

        // Save brief first if it was edited
        if (brief) {
            await saveBrief(creativeId, brief);
            setDirtyBriefs(prev => { const n = { ...prev }; delete n[creativeId]; return n; });
        }

        // Re-invoke agent — it will read updated brief from DB (or use existing brief if not edited)
        if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
            // Update the mock creative's brief in the right panel if it was edited
            if (brief) {
                setCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, creativeBrief: brief } : c));
            }
            return;
        }

        const agentBase = "/api";
        const { getAgentToken } = await import("@/lib/auth-client");
        const token = await getAgentToken();
        if (token) {
            fetch(`${agentBase}/agents/image/invoke`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ campaign_id: campaignId, creative_id: creativeId, variants }),
            }).catch(err => console.warn("Regenerate failed:", err));
        }
        // Use replace instead of push to avoid going back to editor on browser back button
        router.replace(`/preview/image?campaignId=${campaignId}&creativeId=${creativeId}&batch=true`);
    };

    const handleGenerate = async () => {
        if (!campaignId) { alert("Campaign ID is required"); return; }
        setIsSubmitting(true);

        try {
            // Always create a NEW creative record — never reuse an existing one.
            // This ensures the preview shows a loading state for the new generation
            // and the old creative is preserved in history.
            const res = await fetch(`/api/campaigns/${campaignId}/creatives`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "IMAGE", promptType: "GUIDED",
                    guidedBackgroundPrompt: JSON.stringify(formData.background),
                    guidedGraphicPrompt: JSON.stringify(formData.graphic),
                    guidedActorsPrompt: JSON.stringify(formData.actors),
                    guidedTextPrompt: JSON.stringify(formData.text),
                    variantsRequested: variants,
                }),
            });
            if (!res.ok) throw new Error("Failed to create creative");
            const data = await res.json();
            const newCreativeId = data.creative?.id;
            setCreatives(prev => [{ ...data.creative, signedUrl: null }, ...prev]);

            // Fire image agent with the new creative ID (skip in mock mode)
            if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
                console.log("[Mock Mode] Skipping agent call - using mock data");
            } else {
                const agentBase = "/api";
                const token = await getAgentToken();
                if (token) {
                    fetch(`${agentBase}/agents/image/invoke`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                        body: JSON.stringify({ campaign_id: campaignId, creative_id: newCreativeId, variants }),
                    }).catch(err => console.warn("Image agent failed:", err));
                }
            }

            // Use replace instead of push to avoid going back to editor on browser back button
            router.replace(`/preview/image?campaignId=${campaignId}&creativeId=${newCreativeId}&batch=true`);
        } catch (err) {
            console.error(err);
            alert("Error generating images.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-[#F9FAFB] font-sans text-zinc-900">
            <CreativeSidebar activeType="image" campaignId={campaignId} onNavigate={router.push} />

            {/* MAIN — two-column layout */}
            <main className="flex-1 flex flex-col min-w-0">
                <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8">
                    <div className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                        <button
                            onClick={() => campaignId ? router.push(`/campaigns/${campaignId}`) : router.push("/dashboard")}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                            Back to Campaign
                        </button>
                        <span className="text-zinc-300">|</span>
                        <button onClick={() => router.push("/dashboard")} className="hover:text-zinc-900 transition-colors">Dashboard</button>
                        <span>&gt;</span>
                        <span className="text-zinc-500">Campaign Manager</span>
                        <span>&gt;</span>
                        {campaignId && (
                            <>
                                <button onClick={() => router.push(`/campaigns/${campaignId}`)} className="hover:text-zinc-900 transition-colors">Campaign Details</button>
                                <span>&gt;</span>
                            </>
                        )}
                        <span className="text-zinc-900 font-bold">Image Creatives</span>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT — prompt form (bigger) */}
                    <div className="flex-1 flex flex-col overflow-y-auto border-r border-zinc-200">
                        <div className="p-8 space-y-4 flex-1 max-w-3xl mx-auto w-full">
                            {!campaignId && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                    <div className="flex items-start gap-3">
                                        <span className="text-yellow-600 text-xl">⚠️</span>
                                        <div>
                                            <h3 className="text-sm font-bold text-yellow-800 mb-1">Campaign ID Required</h3>
                                            <p className="text-xs text-yellow-700">
                                                To generate images, please access this page from a campaign.
                                                Go to <button onClick={() => router.push("/dashboard")} className="underline font-semibold hover:text-yellow-900">Dashboard</button> →
                                                Select a campaign → Click "Image Creative"
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <h2 className="text-xl font-bold">Image Prompts</h2>

                            <AccordionSection title="Background" isOpen={openSection === "background"} onToggle={() => setOpenSection(openSection === "background" ? null : "background")}>
                                <div className="space-y-3">
                                    <InputField label="Name" value={formData.background.name} onChange={(value) => setFormData({ ...formData, background: { ...formData.background, name: value } })} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <InputField label="Theme" value={formData.background.theme} onChange={(value) => setFormData({ ...formData, background: { ...formData.background, theme: value } })} />
                                        <InputField label="Color Palette" value={formData.background.colorPalette} onChange={(value) => setFormData({ ...formData, background: { ...formData.background, colorPalette: value } })} />
                                    </div>
                                    <InputField label="Scene/Setting" value={formData.background.scene} onChange={(value) => setFormData({ ...formData, background: { ...formData.background, scene: value } })} />
                                </div>
                            </AccordionSection>

                            <AccordionSection title="Graphic" isOpen={openSection === "graphic"} onToggle={() => setOpenSection(openSection === "graphic" ? null : "graphic")}>
                                <div className="space-y-3">
                                    <InputField label="Name" value={formData.graphic.name} onChange={(value) => setFormData({ ...formData, graphic: { ...formData.graphic, name: value } })} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <InputField label="Primary Type" value={formData.graphic.primaryType} onChange={(value) => setFormData({ ...formData, graphic: { ...formData.graphic, primaryType: value } })} />
                                        <InputField label="Style" value={formData.graphic.style} onChange={(value) => setFormData({ ...formData, graphic: { ...formData.graphic, style: value } })} />
                                    </div>
                                    <InputField label="Elements" value={formData.graphic.elements} onChange={(value) => setFormData({ ...formData, graphic: { ...formData.graphic, elements: value } })} />
                                </div>
                            </AccordionSection>

                            <AccordionSection title="Actors" isOpen={openSection === "actors"} onToggle={() => setOpenSection(openSection === "actors" ? null : "actors")}>
                                <div className="space-y-3">
                                    <InputField label="Visual Segment" value={formData.actors.visualSegment} onChange={(value) => setFormData({ ...formData, actors: { ...formData.actors, visualSegment: value } })} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <InputField label="Subject" value={formData.actors.subject} onChange={(value) => setFormData({ ...formData, actors: { ...formData.actors, subject: value } })} />
                                        <DropdownField label="Age" value={formData.actors.age} options={dropdownOptions.age} onSelect={(v) => setFormData({ ...formData, actors: { ...formData.actors, age: v } })} onAdd={(v) => addDropdownOption("age", v)} />
                                    </div>
                                    <InputField label="Clothing" value={formData.actors.clothing} onChange={(value) => setFormData({ ...formData, actors: { ...formData.actors, clothing: value } })} />
                                    <InputField label="Theme" value={formData.actors.theme} onChange={(value) => setFormData({ ...formData, actors: { ...formData.actors, theme: value } })} />
                                </div>
                            </AccordionSection>

                            <AccordionSection title="Text" isOpen={openSection === "text"} onToggle={() => setOpenSection(openSection === "text" ? null : "text")}>
                                <div className="space-y-3">
                                    <InputField label="Headline" value={formData.text.headline} onChange={(value) => setFormData({ ...formData, text: { ...formData.text, headline: value } })} />
                                    <InputField label="Tagline" value={formData.text.tagline} onChange={(value) => setFormData({ ...formData, text: { ...formData.text, tagline: value } })} />
                                    <InputField label="Font Style" value={formData.text.fontStyle} onChange={(value) => setFormData({ ...formData, text: { ...formData.text, fontStyle: value } })} />
                                    <div className="space-y-1">
                                        <label htmlFor="creative-language" className="text-xs text-zinc-500">Language</label>
                                        <select id="creative-language" className="w-full border border-zinc-200 rounded p-2.5 text-sm bg-white outline-none" value={formData.text.language} onChange={(e) => setFormData({ ...formData, text: { ...formData.text, language: e.target.value } })}>
                                            {["English", "Hindi", "Chinese", "Tamil"].map(l => <option key={l}>{l}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </AccordionSection>

                            {/* Variations selector */}
                            <fieldset className="space-y-2">
                                <legend className="text-xs font-bold text-zinc-500 uppercase">Number of Variations</legend>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setVariants(n)}
                                            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${variants === n
                                                ? "border-[#4CAF31] bg-[#F0F9F6] text-[#2d6b1d]"
                                                : "border-zinc-200 text-zinc-400 hover:border-zinc-300"
                                                }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-zinc-400">{variants} image variant{variants > 1 ? "s" : ""} will be generated</p>
                            </fieldset>

                            <button
                                onClick={handleGenerate}
                                disabled={isSubmitting || !campaignId}
                                className="w-full py-3 bg-[#4CAF31] rounded-lg text-sm font-bold text-white hover:bg-[#3d8e27] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                                Generate {variants} Image{variants > 1 ? "s" : ""}
                            </button>
                            {!campaignId && (
                                <p className="text-xs text-red-500 text-center mt-2">
                                    ⚠️ Campaign ID is required. Please access this page from a campaign.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* RIGHT — preview panel (fixed narrow) */}
                    <div className="w-100 shrink-0 flex flex-col overflow-y-auto bg-white">
                        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-700">Generated Creatives</h2>
                            <button onClick={loadCreatives} className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
                                <RotateCcw size={12} /> Refresh
                            </button>
                        </div>

                        {/* Creatives history list */}
                        <div className="p-4 flex-1 overflow-y-auto">
                            {creatives.length === 0 ? (
                                <p className="text-xs text-zinc-400 text-center mt-8">No creatives yet. Generate one using the form.</p>
                            ) : (
                                <div className="space-y-3">
                                    {creatives.map(c => (
                                        <div
                                            key={c.id}
                                            className={`rounded-xl overflow-hidden border transition-all ${c.signedUrl ? "border-zinc-200 hover:border-[#4CAF31] hover:shadow-sm" : "border-zinc-100 opacity-60"}`}
                                        >
                                            {c.signedUrl ? (
                                                <Link
                                                    href={
                                                        c.type === "VIDEO"
                                                            ? `/preview/video?campaignId=${campaignId}`
                                                            : `/preview/image?campaignId=${campaignId}&creativeId=${c.id}`
                                                    }
                                                    className="block"
                                                >
                                                    {c.type === "VIDEO" || c.type === "REEL" ? (
                                                        <video
                                                            src={c.signedUrl}
                                                            className="w-full aspect-video object-cover"
                                                            muted
                                                            playsInline
                                                            preload="metadata"
                                                        />
                                                    ) : (
                                                        <img src={c.signedUrl} alt="Creative" className="w-full aspect-video object-cover" />
                                                    )}
                                                </Link>
                                            ) : (
                                                <div>
                                                    <div className="w-full aspect-video bg-zinc-100 flex items-center justify-center gap-2 text-zinc-400">
                                                        <Loader2 size={14} className="animate-spin" />
                                                        <span className="text-xs">Generating...</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="px-3 py-2 bg-white flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] text-zinc-400 truncate">{c.id.slice(0, 8)}...</p>
                                                    <p className={`text-[10px] font-semibold ${c.status === "GENERATED" ? "text-[#4CAF31]" : "text-zinc-400"}`}>{c.status}</p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {c.signedUrl && (
                                                        <button
                                                            onClick={() => router.push(
                                                                c.type === "VIDEO"
                                                                    ? `/preview/video?campaignId=${campaignId}`
                                                                    : `/preview/image?campaignId=${campaignId}&creativeId=${c.id}`
                                                            )}
                                                            title="View Preview"
                                                            className="text-[10px] font-bold text-[#4CAF31] px-2 py-1 rounded-lg hover:bg-[#F0F9F6] transition-colors"
                                                        >
                                                            Preview →
                                                        </button>
                                                    )}
                                                    {c.signedUrl && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDownload(c.signedUrl, c.id); }}
                                                            title="Download"
                                                            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                                                        >
                                                            <Download size={13} />
                                                        </button>
                                                    )}
                                                    {c.signedUrl && c.status === "GENERATED" && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); regenerateWithBrief(c.id); }}
                                                            title="Regenerate Image"
                                                            className="p-1.5 rounded-lg hover:bg-[#F0F9F6] text-zinc-400 hover:text-[#4CAF31] transition-colors"
                                                        >
                                                            <RotateCcw size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Creative Brief */}
                                            {(c.creativeBrief || c.status === "PENDING" || c.status === "GENERATING") && (
                                                <div className="px-3 pb-3 bg-white border-t border-zinc-50">
                                                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mt-2 mb-1">Creative Brief</p>
                                                    {c.creativeBrief ? (
                                                        <>
                                                            <textarea
                                                                defaultValue={formatCreativeBrief(c.creativeBrief)}
                                                                rows={3}
                                                                onChange={(e) => {
                                                                    if (e.target.value === c.creativeBrief) {
                                                                        setDirtyBriefs(prev => { const n = { ...prev }; delete n[c.id]; return n; });
                                                                    } else {
                                                                        setDirtyBriefs(prev => ({ ...prev, [c.id]: e.target.value }));
                                                                    }
                                                                }}
                                                                className="w-full text-[11px] text-zinc-600 leading-relaxed border border-zinc-100 rounded p-1.5 resize-none focus:border-[#4CAF31] outline-none bg-zinc-50"
                                                            />
                                                            {dirtyBriefs[c.id] && (
                                                                <button
                                                                    onClick={() => regenerateWithBrief(c.id)}
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
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
