"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Home,
    LayoutGrid,
    ShoppingBag,
    Send,
    Loader2,
    Edit2,
    Save,
    X,
    FileText,
    ChevronLeft,
    ArrowRight,
    RotateCcw,
    Images,
    ImageIcon,
    Upload,
    ZoomIn,
} from "lucide-react";
import { authClient, getAgentToken } from "@/lib/auth-client";
import BrandAvatar from "@/components/BrandAvatar";
import { PlatformBadge } from "@/components/campaigns/PlatformSelector";
import type { TargetPlatform } from "@/lib/platforms";

const DISPLAY_TYPES = new Set(["IMAGE", "VIDEO", "REEL", "STORY"]);
const VIDEO_TYPES = new Set(["VIDEO", "REEL", "STORY"]);

type EditableBriefs = Record<string, string>;
type SetCreatives = React.Dispatch<React.SetStateAction<any[]>>;
type SetEditableBriefs = React.Dispatch<React.SetStateAction<EditableBriefs>>;

function hasCreativeBrief(creative: any) {
    return Boolean(creative.creativeBrief);
}

function mergeCreativeBriefs(prev: EditableBriefs, creatives: any[]) {
    const updated = { ...prev };

    for (const creative of creatives) {
        if (creative.creativeBrief) updated[creative.id] = creative.creativeBrief;
    }

    return updated;
}

async function fetchCreativesNoStore(campaignId: string) {
    const res = await fetch(`/api/campaigns/${campaignId}/creatives`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.creatives ?? [];
}

async function refreshCreativeBriefs(
    campaignId: string,
    setCreatives: SetCreatives,
    setEditableBriefs: SetEditableBriefs,
    onAllReady: () => void
) {
    try {
        const list = await fetchCreativesNoStore(campaignId);
        if (!list) return;

        setCreatives(list);
        setEditableBriefs(prev => mergeCreativeBriefs(prev, list));

        if (list.every(hasCreativeBrief)) {
            onAllReady();
        }
    } catch { }
}

export default function CampaignDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const campaignId = params.id as string;
    const session = authClient.useSession();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [campaign, setCampaign] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [briefText, setBriefText] = useState("");
    const [error, setError] = useState("");
    const [creatives, setCreatives] = useState<any[]>([]);
    // Editable creative brief texts keyed by creative id
    const [editableBriefs, setEditableBriefs] = useState<EditableBriefs>({});
    const [generatingEmail, setGeneratingEmail] = useState(false);
    const [emailPersonalized, setEmailPersonalized] = useState(false);
    const [generatingBlog, setGeneratingBlog] = useState(false);
    const [pastCreatives, setPastCreatives] = useState<any[]>([]);
    const [pastCreativesLoading, setPastCreativesLoading] = useState(false);

    // Reference image state
    const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
    const [refImageLightbox, setRefImageLightbox] = useState(false);
    const [refImageUploading, setRefImageUploading] = useState(false);
    const refImageInputRef = useRef<HTMLInputElement>(null);

    // Normalise any raw GCS URL to a proxied /api/image-proxy URL the browser can load
   const toProxiedUrl = useCallback((raw: string | null | undefined): string | null => {
    if (!raw) return null;

    // Already proxied
    if (raw.startsWith("/api/image-proxy")) return raw;

    // ✅ HANDLE AZURE (IMPORTANT FIX)
    if (raw.includes("blob.core.windows.net")) {
        return raw; // don't proxy
    }

    // GCS fallback
    if (raw.startsWith("gs://")) {
        const https = raw.replace("gs://", "https://storage.googleapis.com/");
        return `/api/image-proxy?url=${encodeURIComponent(https)}`;
    }

    return raw;
}, []);
    const fetchSignedUrl = useCallback(async (id: string): Promise<string | null> => {
        try {
            const res = await fetch(`/api/creatives/${id}/signed-url`);
            if (!res.ok) return null;
            const data = await res.json();
            return data.url ?? null;
        } catch { return null; }
    }, []);

    useEffect(() => {
        if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
            fetchCampaign();
            return;
        }

        if (!session.isPending && !session.data) {
            router.replace("/sign-in");
            return;
        }

        if (session.data && campaignId) {
            fetchCampaign();
        }
    }, [session.data, session.isPending, campaignId, router]);

    // Poll for creative briefs if they haven't been populated yet (agent runs async)
    useEffect(() => {
        if (!campaignId || loading) return;
        const hasPendingBriefs = creatives.some(c => !c.creativeBrief);
        if (!hasPendingBriefs) return;

        const timer = setInterval(() => {
            void refreshCreativeBriefs(campaignId, setCreatives, setEditableBriefs, () => {
                clearInterval(timer);
            });
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(timer);
    }, [creatives, campaignId, loading]);

    // Load past generated creatives for the right panel
    const [hasLoadedPastCreatives, setHasLoadedPastCreatives] = useState(false);

    useEffect(() => {
        if (!campaignId || loading || hasLoadedPastCreatives) return;

        const generated = creatives.filter(
            (c: any) => c.url && c.status === "GENERATED" && DISPLAY_TYPES.has(c.type)
        );

        if (generated.length === 0) {
            setPastCreatives([]);
            setHasLoadedPastCreatives(true); // Mark as loaded even if empty
            return;
        }

        setPastCreativesLoading(true);
        setHasLoadedPastCreatives(true);

        (async () => {
            const enriched: any[] = [];
            for (const cr of generated) {
                const signedUrl = await fetchSignedUrl(cr.id);
                // Fall back to the raw url if signed-url fetch fails
                enriched.push({ ...cr, signedUrl: signedUrl ?? cr.url });
                await new Promise(r => setTimeout(r, 100));
            }
            setPastCreatives(enriched);
            setPastCreativesLoading(false);
        })();
    }, [creatives, campaignId, loading, hasLoadedPastCreatives]);

    const fetchCampaign = async () => {
        try {
            const [campRes, creativesRes] = await Promise.all([
                fetch(`/api/campaigns/${campaignId}`),
                fetch(`/api/campaigns/${campaignId}/creatives`),
            ]);
            if (!campRes.ok) throw new Error("Failed to fetch campaign details");
            const data = await campRes.json();
            const camp = data.campaign || data.data || data;
            setCampaign(camp);
            setRefImageUrl(toProxiedUrl(camp.referenceImageUrl));
            const raw = camp.campaignBreif;
            if (raw && typeof raw === "object") {
                setBriefText(raw.strategy || JSON.stringify(raw, null, 2));
            } else {
                setBriefText(raw || "");
            }
            if (creativesRes.ok) {
                const cd = await creativesRes.json();
                const list = cd.creatives ?? [];
                setCreatives(list);
                // Initialize editable briefs
                const initial: Record<string, string> = {};
                list.forEach((c: any) => { if (c.creativeBrief) initial[c.id] = c.creativeBrief; });
                setEditableBriefs(initial);
            }
        } catch (err) {
            console.error(err);
            setError("Could not load campaign. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBrief = async () => {
        setSaving(true);
        try {
            const existingBreif = campaign?.campaignBreif;
            const updatedBreif = existingBreif && typeof existingBreif === "object"
                ? { ...existingBreif, strategy: briefText }
                : { strategy: briefText };

            const res = await fetch(`/api/campaigns/${campaignId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignBreif: updatedBreif }),
            });
            if (!res.ok) throw new Error("Failed to save brief");

            setCampaign({ ...campaign, campaignBreif: updatedBreif });
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            alert("Error saving the brief. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleReferenceImageUpload = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            alert("Please select an image file.");
            return;
        }
        setRefImageUploading(true);
        try {
            const formData = new FormData();
            formData.append("referenceImage", file);
            const res = await fetch(`/api/campaigns/${campaignId}/reference-image`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            const url: string = data.referenceImageUrl ?? data.campaign?.referenceImageUrl ?? null;
            if (url) {
                setRefImageUrl(toProxiedUrl(url));
                setCampaign((prev: any) => ({ ...prev, referenceImageUrl: url }));
            }
        } catch (err) {
            console.error("Reference image upload error:", err);
            alert("Failed to upload reference image. Please try again.");
        } finally {
            setRefImageUploading(false);
            if (refImageInputRef.current) refImageInputRef.current.value = "";
        }
    };

    const ensurePlaceholderCreatives = async () => {
        if (creatives.length === 0) {
            const primary = campaign?.targetPlatforms?.[0] ?? { platformName: "", aspectRatio: "1:1", orientation: "square" };

            await Promise.all([
                fetch(`/api/campaigns/${campaignId}/creatives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "IMAGE", promptType: "GUIDED",
                        platformName: primary.platformName || null,
                        aspectRatio: primary.aspectRatio || null,
                        orientation: primary.orientation || null,
                    }),
                }).catch(() => { }),
                fetch(`/api/campaigns/${campaignId}/creatives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "VIDEO", promptType: "GUIDED",
                        platformName: primary.platformName || null,
                        aspectRatio: primary.aspectRatio || null,
                        orientation: primary.orientation || null,
                    }),
                }).catch(() => { }),
                fetch(`/api/campaigns/${campaignId}/creatives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "EMAIL", promptType: "GUIDED" }),
                }).catch(() => { }),
            ]);
        }
    };

    const pollBrief = async () => {
        let attempts = 0;
        const poll = async () => {
            const [campRes, creativesRes] = await Promise.all([
                fetch(`/api/campaigns/${campaignId}`),
                fetch(`/api/campaigns/${campaignId}/creatives`),
            ]);
            if (campRes.ok) {
                const data = await campRes.json();
                const camp = data.campaign || data;
                const brief = camp.campaignBreif;
                if (brief) {
                    setCampaign(camp);
                    const strategy =
                        typeof brief === "object"
                            ? brief.strategy ?? JSON.stringify(brief, null, 2)
                            : String(brief);
                    setBriefText(strategy);
                    if (creativesRes.ok) {
                        const cd = await creativesRes.json();
                        const list = cd.creatives ?? [];
                        setCreatives(list);
                        const updated: EditableBriefs = {};
                        list.forEach((c: any) => {
                            if (c.creativeBrief) updated[c.id] = c.creativeBrief;
                        });
                        setEditableBriefs(updated);
                    }
                    setRetrying(false);
                    return;
                }
            }
            attempts++;
            if (attempts < 30) setTimeout(poll, 5000);
            else setRetrying(false);
        };
        setTimeout(poll, 5000);
    };

    const retryCampaignBrief = async () => {
        setRetrying(true);
        try {
            const agentBase = "/api";
            const token = await getAgentToken();
            if (!token) throw new Error("Could not get auth token");

            await ensurePlaceholderCreatives();

            const res = await fetch(`${agentBase}/agents/campaign/invoke`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ campaign_id: campaignId }),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Agent API Error (${res.status}): ${text}`);
            }

            await pollBrief();
        } catch (err) {
            console.error(err);
            alert("Failed to retry. Please try again.");
            setRetrying(false);
        }
    };

    if (session.isPending || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
                <Loader2 className="h-8 w-8 animate-spin text-[#4CAF31]" />
            </div>
        );
    }

    if (!session.data && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

    return (
        <div className="flex min-h-screen bg-[#F9FAFB] font-sans text-zinc-900">
            <Sidebar router={router} />

            <main className="flex-1 flex flex-col min-w-0">
                <TopBar router={router} campaign={campaign} session={session} />

                {error ? (
                    <div className="p-8">
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 border border-red-100">
                            <X size={20} />
                            <p className="font-medium text-sm">{error}</p>
                        </div>
                        <button
                            onClick={fetchCampaign}
                            className="mt-4 px-4 py-2 bg-white border border-zinc-300 rounded text-sm font-bold text-zinc-700 hover:bg-zinc-50"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <div className="p-8 flex-1 overflow-y-auto w-full">
                        <div className="flex gap-8 items-start max-w-7xl">
                            <div className="flex-1 min-w-0">
                                <CampaignHeader router={router} campaign={campaign} />

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                    <InfoCard label="Status" value={campaign?.status || "Draft"} />
                                    <InfoCard label="Objective" value={campaign?.objective || "Not specified"} />
                                    <InfoCard label="Budget" value={campaign?.budget ? `${campaign.currency || ''} ${campaign.budget}` : "N/A"} />
                                    <InfoCard label="Channels" value={campaign?.channels?.join(", ") || "None selected"} />
                                </div>

                                <ReferenceImageSection
                                    refImageUrl={refImageUrl}
                                    refImageUploading={refImageUploading}
                                    refImageInputRef={refImageInputRef}
                                    handleReferenceImageUpload={handleReferenceImageUpload}
                                    setRefImageLightbox={setRefImageLightbox}
                                />



                                <CampaignBriefSection
                                    isEditing={isEditing}
                                    briefText={briefText}
                                    setBriefText={setBriefText}
                                    setIsEditing={setIsEditing}
                                    campaign={campaign}
                                    saving={saving}
                                    handleSaveBrief={handleSaveBrief}
                                    retryCampaignBrief={retryCampaignBrief}
                                    retrying={retrying}
                                    campaignId={campaignId}
                                    creatives={creatives}
                                    setCampaign={setCampaign}
                                    setCreatives={setCreatives}
                                    setEditableBriefs={setEditableBriefs}
                                />

                                <CreativeBriefsSection
                                    creatives={creatives}
                                    campaign={campaign}
                                    campaignId={campaignId}
                                    retrying={retrying}
                                    retryCampaignBrief={retryCampaignBrief}
                                    editableBriefs={editableBriefs}
                                    setEditableBriefs={setEditableBriefs}
                                    router={router}
                                    emailPersonalized={emailPersonalized}
                                    setEmailPersonalized={setEmailPersonalized}
                                    generatingEmail={generatingEmail}
                                    setGeneratingEmail={setGeneratingEmail}
                                    generatingBlog={generatingBlog}
                                    setGeneratingBlog={setGeneratingBlog}
                                    targetPlatforms={campaign?.targetPlatforms ?? []}
                                />

                            </div>

                            <PastCreativesSection
                                pastCreatives={pastCreatives}
                                pastCreativesLoading={pastCreativesLoading}
                                router={router}
                                campaignId={campaignId}
                            />
                        </div>

                        {refImageLightbox && refImageUrl && (
                            <ImageLightbox
                                imageUrl={refImageUrl}
                                onClose={() => setRefImageLightbox(false)}
                            />
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

interface SidebarProps {
    readonly router: any;
}

function Sidebar({ router }: SidebarProps) {
    return (
        <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col shrink-0">
            <div className="p-6">
                <button
                    type="button"
                    className="flex items-center gap-2 text-[#4CAF31] font-bold text-xl uppercase tracking-tighter"
                    onClick={() => router.push('/dashboard')}
                >
                    MAR<span className="text-zinc-800">TECH</span>
                </button>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-10 pt-2">
                <ul className="space-y-1">
                    <SidebarItem icon={<Home size={18} />} label="Home" onClick={() => router.push('/dashboard')} />
                    <SidebarItem icon={<ShoppingBag size={18} />} label="Subscribed Product" />
                    <SidebarItem icon={<LayoutGrid size={18} />} label="Marketplace" />
                    <SidebarItem icon={<Send size={18} />} label="Campaign Manager" active onClick={() => router.push('/dashboard')} />
                    <div className="ml-9 space-y-2 pt-2 border-l border-zinc-100 pl-4">
                        <li className="text-sm font-semibold text-[#4CAF31] bg-[#F0F9F6] p-2 rounded-md">Details</li>
                    </div>
                </ul>
            </nav>
        </aside>
    );
}

interface TopBarProps {
    readonly router: any;
    readonly campaign: any;
    readonly session: any;
}

function TopBar({ router, campaign, session }: TopBarProps) {
    return (
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                <button onClick={() => router.push('/dashboard')} className="hover:text-zinc-900 transition-colors">
                    Dashboard
                </button>
                <span>&gt;</span>
                <button onClick={() => router.push('/dashboard')} className="hover:text-zinc-900 transition-colors">
                    Campaign Manager
                </button>
                <span>&gt;</span>
                <span className="text-zinc-900 font-bold max-w-[200px] truncate">
                    {campaign?.name || "Campaign Details"}
                </span>
            </div>
            <BrandAvatar fallback={session.data?.user?.name?.[0]?.toUpperCase() || "U"} />
        </header>
    );
}

interface CampaignHeaderProps {
    readonly router: any;
    readonly campaign: any;
}

function CampaignHeader({ router, campaign }: CampaignHeaderProps) {
    return (
        <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-zinc-200 rounded-full transition-colors bg-zinc-100 text-zinc-600">
                <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                {campaign?.name}
            </h1>
            {campaign?.category && (
                <span className="ml-2 px-2.5 py-1 text-xs font-semibold bg-[#F0F9F6] text-[#2d6b1d] rounded-full border border-[#c6eacc]">
                    {campaign.category}
                </span>
            )}
        </div>
    );
}

interface ReferenceImageSectionProps {
    readonly refImageUrl: string | null;
    readonly refImageUploading: boolean;
    readonly refImageInputRef: React.RefObject<HTMLInputElement | null>;
    readonly handleReferenceImageUpload: (file: File) => Promise<void>;
    readonly setRefImageLightbox: (val: boolean) => void;
}

function ReferenceImageSection({ refImageUrl, refImageUploading, refImageInputRef, handleReferenceImageUpload, setRefImageLightbox }: ReferenceImageSectionProps) {
    return (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ImageIcon className="text-[#4CAF31]" size={18} />
                    <h2 className="text-base font-bold text-zinc-800">Reference Image</h2>
                    <span className="text-xs text-zinc-400 ml-1">— used to guide AI generation</span>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        ref={refImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleReferenceImageUpload(file);
                        }}
                    />
                    <button
                        onClick={() => refImageInputRef.current?.click()}
                        disabled={refImageUploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {refImageUploading
                            ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
                            : <><Upload size={13} /> {refImageUrl ? "Change Image" : "Upload Image"}</>
                        }
                    </button>
                </div>
            </div>

            <div className="p-6">
                {refImageUrl ? (
                    <div className="flex items-start gap-5">
                        <button
                            onClick={() => setRefImageLightbox(true)}
                            className="relative group shrink-0 w-40 h-40 rounded-xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-md transition-shadow"
                            title="Click to view full size"
                        >
                            <img src={refImageUrl} alt="Reference" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <ZoomIn size={22} className="text-white drop-shadow" />
                            </div>
                        </button>
                        <div className="flex flex-col gap-2 pt-1">
                            <p className="text-sm font-medium text-zinc-700">Reference image set</p>
                            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">
                                This image is used by the AI to guide the visual style, composition, and mood of generated creatives.
                            </p>
                            <div className="flex gap-2 mt-1">
                                <button
                                    onClick={() => setRefImageLightbox(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0052CC] bg-[#E5EFFF] hover:bg-[#D5E6FF] rounded-lg transition-colors"
                                >
                                    <ZoomIn size={12} /> View full size
                                </button>
                                <button
                                    onClick={() => refImageInputRef.current?.click()}
                                    disabled={refImageUploading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <Upload size={12} /> Replace
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => refImageInputRef.current?.click()}
                        disabled={refImageUploading}
                        className="w-full flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-zinc-200 rounded-xl hover:border-[#4CAF31] hover:bg-[#F0F9F6] transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {refImageUploading ? (
                            <Loader2 size={28} className="animate-spin text-[#4CAF31]" />
                        ) : (
                            <Upload size={28} className="text-zinc-300 group-hover:text-[#4CAF31] transition-colors" />
                        )}
                        <div className="text-center">
                            <p className="text-sm font-medium text-zinc-500 group-hover:text-zinc-700 transition-colors">
                                {refImageUploading ? "Uploading…" : "Upload a reference image"}
                            </p>
                            <p className="text-xs text-zinc-400 mt-0.5">PNG, JPG, WEBP up to 10MB</p>
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
}

interface CampaignBriefSectionProps {
    readonly isEditing: boolean;
    readonly briefText: string;
    readonly setBriefText: (val: string) => void;
    readonly setIsEditing: (val: boolean) => void;
    readonly campaign: any;
    readonly saving: boolean;
    readonly handleSaveBrief: () => Promise<void>;
    readonly retryCampaignBrief: () => Promise<void>;
    readonly retrying: boolean;
    readonly campaignId: string;
    readonly creatives: any[];
    readonly setCampaign: (val: any) => void;
    readonly setCreatives: (val: any[]) => void;
    readonly setEditableBriefs: (val: any) => void;
}

function CampaignBriefSection({
    isEditing,
    briefText,
    setBriefText,
    setIsEditing,
    campaign,
    saving,
    handleSaveBrief,
    retryCampaignBrief,
    retrying,
    campaignId,
    creatives,
    setCampaign,
    setCreatives,
    setEditableBriefs
}: CampaignBriefSectionProps) {
    const handleRegenerate = async () => {
        if (!confirm("This will regenerate both campaign and creative briefs. Continue?")) return;

        try {
            // Logic moved from inline to keep component clean
            await fetch(`/api/campaigns/${campaignId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignBreif: null }),
            });

            // Delete all existing creatives and recreate per-platform
            await Promise.all(
                creatives.map((c: any) =>
                    fetch(`/api/creatives/${c.id}`, { method: "DELETE" }).catch(() => { })
                )
            );

            // Recreate single IMAGE + VIDEO + EMAIL with primary platform metadata
            const primary = campaign?.targetPlatforms?.[0] ?? { platformName: "", aspectRatio: "1:1", orientation: "square" };

            await Promise.all([
                fetch(`/api/campaigns/${campaignId}/creatives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "IMAGE", promptType: campaign?.promptType || "GUIDED",
                        platformName: primary.platformName || null,
                        aspectRatio: primary.aspectRatio || null,
                        orientation: primary.orientation || null,
                    }),
                }).catch(() => { }),
                fetch(`/api/campaigns/${campaignId}/creatives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "VIDEO", promptType: campaign?.promptType || "GUIDED",
                        platformName: primary.platformName || null,
                        aspectRatio: primary.aspectRatio || null,
                        orientation: primary.orientation || null,
                    }),
                }).catch(() => { }),
                fetch(`/api/campaigns/${campaignId}/creatives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "EMAIL", promptType: campaign?.promptType || "GUIDED" }),
                }).catch(() => { }),
            ]);

            // Invoke agent via main handler
            await retryCampaignBrief();
        } catch (err) {
            console.error("Regenerate error:", err);
            alert("Failed to regenerate. Please try again.");
        }
    };

    return (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-2 text-zinc-800">
                    <FileText className="text-[#4CAF31]" size={20} />
                    <h2 className="text-lg font-bold">Campaign Brief</h2>
                </div>
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                disabled={saving}
                                className="px-4 py-1.5 text-sm font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveBrief}
                                disabled={saving}
                                className="px-4 py-1.5 flex items-center gap-2 text-sm font-bold text-white bg-[#4CAF31] hover:bg-[#3d8e27] rounded transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Brief
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    const raw = campaign?.campaignBreif;
                                    setBriefText(raw?.strategy || (typeof raw === 'object' ? JSON.stringify(raw, null, 2) : raw) || "");
                                    setIsEditing(true);
                                }}
                                className="px-4 py-1.5 flex items-center gap-2 text-sm font-semibold text-[#0052CC] bg-[#E5EFFF] hover:bg-[#D5E6FF] rounded transition-colors"
                            >
                                <Edit2 size={14} /> Edit Brief
                            </button>
                            <button
                                onClick={handleRegenerate}
                                disabled={retrying}
                                className="px-4 py-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded transition-colors disabled:opacity-50"
                            >
                                {retrying ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                                Regenerate All
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="p-6">
                {isEditing ? (
                    <textarea
                        value={briefText}
                        onChange={(e) => setBriefText(e.target.value)}
                        className="w-full min-h-[400px] border border-zinc-200 rounded-lg p-4 text-sm focus:ring-2 focus:ring-[#4CAF31]/20 focus:border-[#4CAF31] outline-none resize-y leading-relaxed text-zinc-700 bg-zinc-50"
                        placeholder="Enter the campaign brief..."
                    />
                ) : (
                    <div className="prose prose-sm max-w-none text-zinc-700 leading-relaxed whitespace-pre-wrap rounded-lg p-4 bg-zinc-50/50 border border-zinc-100 min-h-[200px]">
                        {briefText || (
                            <div className="flex flex-col items-center justify-center py-8 gap-3">
                                <span className="italic text-zinc-400 text-sm">
                                    {retrying ? "Generating brief..." : "No brief generated yet."}
                                </span>
                                {!retrying && (
                                    <button
                                        onClick={retryCampaignBrief}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#4CAF31] text-white text-xs font-bold rounded-lg hover:bg-[#3d8e27] transition-colors"
                                    >
                                        Generate Brief
                                    </button>
                                )}
                                {retrying && <Loader2 size={18} className="animate-spin text-[#4CAF31]" />}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

interface CreativeBriefsSectionProps {
    readonly creatives: any[];
    readonly campaign: any;
    readonly campaignId: string;
    readonly retrying: boolean;
    readonly retryCampaignBrief: () => Promise<void>;
    readonly editableBriefs: Record<string, string>;
    readonly setEditableBriefs: (val: any) => void;
    readonly router: any;
    readonly emailPersonalized: boolean;
    readonly setEmailPersonalized: (val: boolean) => void;
    readonly generatingEmail: boolean;
    readonly setGeneratingEmail: (val: boolean) => void;
    readonly generatingBlog: boolean;
    readonly setGeneratingBlog: (val: boolean) => void;
    readonly targetPlatforms: TargetPlatform[];
}

function CreativeBriefsSection({
    creatives,
    campaign,
    campaignId,
    retrying,
    retryCampaignBrief,
    editableBriefs,
    setEditableBriefs,
    router,
    emailPersonalized,
    setEmailPersonalized,
    generatingEmail,
    setGeneratingEmail,
    generatingBlog,
    setGeneratingBlog,
    targetPlatforms
}: CreativeBriefsSectionProps) {
    // Deduplicate creatives by type — keep the best version of each type
    const byType: Record<string, any> = {};
    creatives.forEach((c: any) => {
        if (c.type === "EMAIL" || c.type === "BLOG") return;
        const current = byType[c.type];
        if (current) {
            const currentScore = (current.creativeBrief ? 2 : 0) + (current.status === "GENERATED" ? 1 : 0);
            const newScore = (c.creativeBrief ? 2 : 0) + (c.status === "GENERATED" ? 1 : 0);
            if (newScore > currentScore) byType[c.type] = c;
        } else {
            byType[c.type] = c;
        }
    });
    const uniqueCreatives = Object.values(byType);
    const allHaveBriefs = uniqueCreatives.every((c: any) => c.creativeBrief);

    return (
        <div className="mt-6 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="text-[#4CAF31]" size={18} />
                    <h2 className="text-base font-bold text-zinc-800">Creative Briefs</h2>
                    <span className="text-xs text-zinc-400 ml-1">— AI-suggested creatives for this campaign</span>
                    {targetPlatforms.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 ml-2" aria-label="Target platforms">
                            {targetPlatforms.map((p) => (
                                <PlatformBadge key={p.platformName} platform={p} />
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs text-amber-500 italic ml-2">
                            No platforms selected — platform-aware brief generation is disabled.
                        </span>
                    )}
                </div>
                {uniqueCreatives.length > 0 && !allHaveBriefs && campaign?.campaignBreif && (
                    <button
                        onClick={retryCampaignBrief}
                        disabled={retrying}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#4CAF31] hover:bg-[#3d8e27] rounded-lg transition-colors disabled:opacity-50 shrink-0"
                    >
                        {retrying ? <Loader2 size={12} className="animate-spin" /> : null}
                        {retrying ? "Generating..." : "Generate Briefs"}
                    </button>
                )}
            </div>
            <div className="divide-y divide-zinc-100">
                {uniqueCreatives.map((c: any) => (
                    <CreativeCard
                        key={c.id}
                        creative={c}
                        campaignId={campaignId}
                        retrying={retrying}
                        editableBriefs={editableBriefs}
                        setEditableBriefs={setEditableBriefs}
                        router={router}
                    />
                ))}

                <EmailCreativeCard
                    creatives={creatives}
                    campaignId={campaignId}
                    retrying={retrying}
                    editableBriefs={editableBriefs}
                    setEditableBriefs={setEditableBriefs}
                    router={router}
                    emailPersonalized={emailPersonalized}
                    setEmailPersonalized={setEmailPersonalized}
                    generatingEmail={generatingEmail}
                    setGeneratingEmail={setGeneratingEmail}
                />

                <BlogCreativeCard
                    creatives={creatives}
                    campaignId={campaignId}
                    generatingBlog={generatingBlog}
                    setGeneratingBlog={setGeneratingBlog}
                    router={router}
                />
            </div>
        </div>
    );
}

interface CreativeCardProps {
    readonly creative: any;
    readonly campaignId: string;
    readonly retrying: boolean;
    readonly editableBriefs: Record<string, string>;
    readonly setEditableBriefs: (val: any) => void;
    readonly router: any;
}

function CreativeCard({ creative: c, campaignId, retrying, editableBriefs, setEditableBriefs, router }: CreativeCardProps) {
    const handleEdit = (brief: string) => {
        const briefParam = encodeURIComponent(brief);
        const basePath = c.type === "VIDEO" ? "/creatives/video" : "/creatives/image";
        router.push(`${basePath}?campaignId=${campaignId}&brief=${briefParam}&creativeId=${c.id}`);
    };

    const createCreativeRecord = async (brief: string) => {
        try {
            const res = await fetch(`/api/campaigns/${campaignId}/creatives`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...c,
                    creativeBrief: brief,
                    id: undefined,
                    createdAt: undefined,
                    updatedAt: undefined
                }),
            });
            if (res.ok) {
                const data = await res.json();
                return data.creative?.id ?? data.id;
            }
        } catch { }
        return c.id;
    };

    const handleGenerate = async (brief: string) => {
        if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
            const previewPath = c.type === "VIDEO"
                ? `/preview/video?campaignId=${campaignId}&creativeId=${c.id}`
                : `/preview/image?campaignId=${campaignId}&creativeId=${c.id}`;
            router.push(previewPath);
            return;
        }

        const targetId = await createCreativeRecord(brief);

        if (c.type === "VIDEO") {
            router.push(`/preview/video?campaignId=${campaignId}&creativeId=${targetId}&generate=true`);
        } else {
            const agentBase = "/api";
            const token = await getAgentToken();
            if (token) {
                fetch(`${agentBase}/agents/image/invoke`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ campaign_id: campaignId, creative_id: targetId, variants: 1 }),
                }).catch(console.warn);
            }
            router.push(`/preview/image?campaignId=${campaignId}&creativeId=${targetId}&batch=true`);
        }
    };

    const handleAction = async (type: 'EDIT' | 'GENERATE') => {
        const brief = editableBriefs[c.id] ?? c.creativeBrief;
        if (brief !== c.creativeBrief) {
            await fetch(`/api/creatives/${c.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ creativeBrief: brief }),
            });
        }

        if (type === 'EDIT') {
            handleEdit(brief);
        } else {
            await handleGenerate(brief);
        }
    };

    return (
        <div className="px-6 py-5 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.type === "VIDEO" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                        {c.type}
                    </span>
                    {c.platformName && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                            {c.platformName}{c.aspectRatio ? ` · ${c.aspectRatio}` : ""}
                        </span>
                    )}
                </div>
            </div>
            {c.creativeBrief || editableBriefs[c.id] ? (
                <textarea
                    value={editableBriefs[c.id] ?? c.creativeBrief ?? ""}
                    onChange={e => setEditableBriefs((prev: any) => ({ ...prev, [c.id]: e.target.value }))}
                    rows={4}
                    className="w-full text-sm text-zinc-700 leading-relaxed border border-zinc-200 rounded-lg p-3 resize-none focus:border-[#4CAF31] outline-none bg-zinc-50/30"
                />
            ) : (
                <div className="flex items-center gap-2 py-3 px-3 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                    {retrying ? (
                        <><Loader2 size={14} className="animate-spin text-[#4CAF31]" /><span className="text-xs text-zinc-400">Generating brief...</span></>
                    ) : (
                        <span className="text-xs text-zinc-400 italic">Brief not yet generated.</span>
                    )}
                </div>
            )}
            <div className="flex gap-2">
                <button onClick={() => handleAction('EDIT')} className="px-4 py-2 text-xs font-bold text-[#0052CC] bg-[#E5EFFF] hover:bg-[#D5E6FF] rounded-lg transition-colors flex items-center gap-1.5">
                    <Edit2 size={12} /> Edit {c.type === "VIDEO" ? "Video" : "Image"} Prompts
                </button>
                <button onClick={() => handleAction('GENERATE')} className="px-4 py-2 text-xs font-bold text-white bg-[#4CAF31] hover:bg-[#3d8e27] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                    <ArrowRight size={12} /> Generate {c.type === "VIDEO" ? "Video" : "Images"}
                </button>
            </div>
        </div>
    );
}

interface EmailCreativeCardProps {
    readonly creatives: any[];
    readonly campaignId: string;
    readonly retrying: boolean;
    readonly editableBriefs: Record<string, string>;
    readonly setEditableBriefs: (val: any) => void;
    readonly router: any;
    readonly emailPersonalized: boolean;
    readonly setEmailPersonalized: (val: boolean) => void;
    readonly generatingEmail: boolean;
    readonly setGeneratingEmail: (val: boolean) => void;
}

function EmailCreativeCard({ creatives, campaignId, retrying, editableBriefs, setEditableBriefs, router, emailPersonalized, setEmailPersonalized, generatingEmail, setGeneratingEmail }: EmailCreativeCardProps) {
    const emailCreative = creatives.find((c: any) => c.type === "EMAIL");
    const hasGenerated = emailCreative?.status === "GENERATED" && emailCreative?.url;
    const briefValue = emailCreative ? (editableBriefs[emailCreative.id] ?? emailCreative.creativeBrief ?? "") : "";
    const hasBrief = emailCreative && (emailCreative.creativeBrief || editableBriefs[emailCreative.id]);

    const handleGenerate = async () => {
        setGeneratingEmail(true);
        try {
            const res = await fetch(`/api/campaigns/${campaignId}/creatives`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "EMAIL",
                    promptType: "GUIDED",
                    ...(emailCreative ? {
                        creativeBrief: emailCreative.creativeBrief,
                        adCopy: emailCreative.adCopy,
                        headlines: emailCreative.headlines,
                        callToAction: emailCreative.callToAction,
                    } : {})
                }),
            });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            const cid = data.creative?.id ?? data.id;

            const msg = emailPersonalized ? "EMAIL_TYPE: PERSONALIZED" : "EMAIL_TYPE: GENERAL";
            const agentBase = "/api";
            const token = await getAgentToken();
            if (token) {
                fetch(`${agentBase}/agents/email/invoke`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ campaign_id: campaignId, creative_id: cid, message: msg }),
                }).catch(console.warn);
            }
            router.push(`/preview/email?campaignId=${campaignId}&creativeId=${cid}`);
        } catch (err) {
            console.error("Email generation error:", err);
            alert("Failed to generate email");
            setGeneratingEmail(false);
        }
    };

    return (
        <div className="px-6 py-5 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">EMAIL</span>
            </div>
            {hasBrief ? (
                <textarea
                    value={briefValue}
                    onChange={e => setEditableBriefs((prev: any) => ({ ...prev, [emailCreative.id]: e.target.value }))}
                    rows={4}
                    className="w-full text-sm text-zinc-700 leading-relaxed border border-zinc-200 rounded-lg p-3 resize-none focus:border-[#4CAF31] outline-none bg-zinc-50/30"
                />
            ) : (
                <div className="flex items-center gap-2 py-3 px-3 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                    <span className="text-xs text-zinc-400 italic">{retrying ? "Generating brief..." : "Brief not yet generated."}</span>
                </div>
            )}
            <div className="flex items-center gap-2">
                {hasGenerated && (
                    <button onClick={() => router.push(`/preview/email?campaignId=${campaignId}&creativeId=${emailCreative.id}`)} className="px-4 py-2 text-xs font-bold text-[#0052CC] bg-[#E5EFFF] hover:bg-[#D5E6FF] rounded-lg transition-colors">
                        View Email
                    </button>
                )}
                <div className="flex bg-zinc-100 rounded-lg p-0.5 gap-0.5">
                    <button onClick={() => setEmailPersonalized(false)} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${emailPersonalized === false ? "bg-white shadow-sm" : "text-zinc-400"}`}>General</button>
                    <button onClick={() => setEmailPersonalized(true)} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${emailPersonalized === true ? "bg-white shadow-sm" : "text-zinc-400"}`}>Personalized</button>
                </div>
                <button disabled={generatingEmail} onClick={handleGenerate} className="px-4 py-2 text-xs font-bold text-white bg-[#4CAF31] hover:bg-[#3d8e27] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50">
                    {generatingEmail ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                    {hasGenerated ? "Regenerate" : "Generate"} Email
                </button>
            </div>
        </div>
    );
}

interface BlogCreativeCardProps {
    readonly creatives: any[];
    readonly campaignId: string;
    readonly generatingBlog: boolean;
    readonly setGeneratingBlog: (val: boolean) => void;
    readonly router: any;
}

function BlogCreativeCard({ creatives, campaignId, generatingBlog, setGeneratingBlog, router }: BlogCreativeCardProps) {
    const blogCreative = creatives.find((c: any) => c.type === "BLOG");
    const blogText = blogCreative?.adCopy ||"AI-generated SEO blog post.";
    const hasGenerated = blogCreative?.status === "GENERATED";

    const handleGenerate = async () => {
        setGeneratingBlog(true);
        try {
            const res = await fetch(`/api/campaigns/${campaignId}/creatives`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "BLOG", promptType: "GUIDED" }),
            });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            router.push(`/preview/blog?campaignId=${campaignId}&creativeId=${data.creative?.id ?? data.id}`);
        } catch (err) {
            console.error("Blog generation error:", err);
            alert("Failed to start blog generation");
            setGeneratingBlog(false);
        }
    };

    return (
        <div className="px-6 py-5 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">BLOG</span>
            </div>
            <div className="flex items-center gap-2 py-3 px-3 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                <div className="text-sm text-zinc-700 leading-relaxed">
                    {blogCreative?.status === "GENERATING"
                        ? "Generating..."
                        : blogText}
                </div>
            </div>
            <div className="flex gap-2">
                {hasGenerated && (
                    <button onClick={() => router.push(`/preview/blog?campaignId=${campaignId}&creativeId=${blogCreative.id}`)} className="px-4 py-2 text-xs font-bold text-[#0052CC] bg-[#E5EFFF] hover:bg-[#D5E6FF] rounded-lg transition-colors">
                        View Blog
                    </button>
                )}
                <button disabled={generatingBlog} onClick={handleGenerate} className="px-4 py-2 text-xs font-bold text-white bg-[#4CAF31] hover:bg-[#3d8e27] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50">
                    {generatingBlog ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                    {hasGenerated ? "Regenerate" : "Generate"} Blog
                </button>
            </div>
        </div>
    );
}

interface PastCreativesSectionProps {
    readonly pastCreatives: any[];
    readonly pastCreativesLoading: boolean;
    readonly router: any;
    readonly campaignId: string;
}

function PastCreativesSection({ pastCreatives, pastCreativesLoading, router, campaignId }: PastCreativesSectionProps) {
    let content: React.ReactNode;

    if (pastCreativesLoading) {
        content = (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#4CAF31]" /></div>
        );
    } else if (pastCreatives.length === 0) {
        content = (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center text-zinc-400">
                <Images size={28} className="text-zinc-200" />
                <p className="text-xs">No generated creatives yet.</p>
            </div>
        );
    } else {
        content = (
            <div className="grid grid-cols-2 gap-2">
                {pastCreatives.map((c: any) => {
                    const isVideoCreative = VIDEO_TYPES.has(c.type);
                    const previewUrl = isVideoCreative
                        ? `/preview/video?campaignId=${campaignId}&creativeId=${c.id}`
                        : `/preview/image?campaignId=${campaignId}&creativeId=${c.id}`;

                    return (
                        <button
                            type="button"
                            key={c.id}
                            className="relative rounded-lg overflow-hidden border border-zinc-100 group"
                            onClick={() => router.push(previewUrl)}
                        >
                            {isVideoCreative ? (
                                <video src={c.signedUrl} className="w-full aspect-square object-cover" muted playsInline>
                                    <track kind="captions" src="data:text/vtt,WEBVTT%0A" srcLang="en" label="English captions" />
                                </video>
                            ) : (
                                <img src={c.signedUrl} alt="Creative" className="w-full aspect-square object-cover" />
                            )}
                            <div className="absolute top-1.5 left-1.5">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/50 text-white uppercase">{c.type}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="w-100 shrink-0 sticky top-8">
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
                    <Images className="text-[#4CAF31]" size={18} />
                    <h2 className="text-sm font-bold text-zinc-800">Past Creatives</h2>
                    {pastCreatives.length > 0 && <span className="ml-auto text-xs text-zinc-400">{pastCreatives.length}</span>}
                </div>
                <div className="p-4">
                    {content}
                </div>
            </div>
        </div>
    );
}

interface ImageLightboxProps {
    readonly imageUrl: string;
    readonly onClose: () => void;
}

function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <button
                type="button"
                className="absolute inset-0 w-full h-full bg-transparent border-none appearance-none cursor-default"
                onClick={onClose}
                onKeyDown={handleKeyDown}
                aria-label="Close lightbox"
            />
            <div className="relative max-w-5xl max-h-full z-10">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-zinc-100 transition-colors"
                    aria-label="Close"
                >
                    <X size={16} />
                </button>
                <img src={imageUrl} alt="Full size reference" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
            </div>
        </div>
    );
}

interface SidebarItemProps {
    readonly icon: React.ReactNode;
    readonly label: string;
    readonly active?: boolean;
    readonly onClick?: () => void;
}

function SidebarItem({ icon, label, active = false, onClick }: SidebarItemProps) {
    const className = `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${active ? 'bg-[#F0F9F6] text-[#4CAF31] border-r-4 border-[#4CAF31] rounded-r-none' : 'text-zinc-500 hover:bg-zinc-50'}`;
    const content = (
        <>
            <span className={active ? "text-[#4CAF31]" : "text-zinc-400"}>{icon}</span>
            <span className="text-sm font-medium">{label}</span>
        </>
    );

    if (onClick) {
        return (
            <li>
                <button type="button" onClick={onClick} className={`w-full text-left ${className}`}>
                    {content}
                </button>
            </li>
        );
    }

    return (
        <li>
            <div className={className}>
                {content}
            </div>
        </li>
    );
}

interface InfoCardProps {
    readonly label: string;
    readonly value: React.ReactNode;
}

function InfoCard({ label, value }: InfoCardProps) {
    return (
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">{label}</span>
            <span className="text-sm font-semibold text-zinc-900 truncate">{value}</span>
        </div>
    );
}