"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Home,
    LayoutGrid,
    Send,
    ChevronDown,
    Calendar,
    Loader2,
    Users,
    Package,
    CreditCard,
    Settings,
    Sparkles
} from "lucide-react";
import { authClient, getAgentToken } from "@/lib/auth-client";
import BrandAvatar from "@/components/BrandAvatar";

const CHANNELS = ["Instagram", "Facebook", "Twitter", "LinkedIn", "Email", "Message", "TikTok", "WhatsApp"];
const CURRENCIES = ["USD", "EUR", "GBP", "MYR", "SGD", "AED", "INR"];
const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", MYR: "RM", SGD: "S$", AED: "د.إ", INR: "₹",
};

const PLACEHOLDER_CREATIVE_TYPES = ["IMAGE", "VIDEO", "EMAIL", "BLOG"] as const;
const CAMPAIGN_BRIEF_MESSAGE = "FIRST RUN: Only fill campaignBreif, keyMessages, targetGoals, and category. Do NOT fill any creative fields (creativeBrief, adCopy, headlines, callToAction, guidedBackgroundPrompt, guidedActorsPrompt, guidedGraphicPrompt, guidedTextPrompt, guidedVideoVisualsPrompt, guidedVideoMotionPrompt, guidedVideoFormatPrompt, guidedVideoAudioPrompt, emailBrief). Leave all creative fields empty â€” they will be filled in a second run after the user selects audience and channels.";

type CampaignFormData = {
    name: string;
    description: string;
    category: string;
    channels: string[];
    objective: string;
    budget: string;
    currency: string;
    timezone: string;
    startDate: string;
    endDate: string;
    promptType: "GUIDED" | "ADVANCED";
    tags: string[];
};

class CampaignConflictError extends Error {}

function parseCampaignStartDate(startDate: string): string | undefined {
    if (!startDate) return undefined;

    const parts = startDate.split("/");
    if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const parsedDate = new Date(`${yyyy}-${mm}-${dd}`);
        return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.toISOString();
    }

    const parsedDate = new Date(startDate);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.toISOString();
}

function buildCampaignPayload(formData: CampaignFormData) {
    return {
        name: formData.name,
        category: formData.category,
        channels: [],
        aspectRatio: [],
        objective: formData.objective || formData.description || undefined,
        budget: formData.budget ? Number.parseFloat(formData.budget) : undefined,
        currency: formData.currency,
        timezone: formData.timezone,
        startDate: parseCampaignStartDate(formData.startDate),
        promptType: formData.promptType,
        tags: formData.tags,
    };
}

async function upsertCampaign(existingCampaignId: string | null, formData: CampaignFormData): Promise<string> {
    const isEditing = Boolean(existingCampaignId);
    const response = await fetch(
        isEditing ? `/api/campaigns/${existingCampaignId}` : "/api/campaigns",
        {
            method: isEditing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildCampaignPayload(formData)),
        }
    );

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const message = errData.error || (isEditing ? "Failed to update campaign" : "Failed to create campaign");
        if (response.status === 409) {
            throw new CampaignConflictError(message);
        }
        throw new Error(message);
    }

    if (isEditing) return existingCampaignId as string;

    const campaign = await response.json();
    return campaign.id;
}

async function createPlaceholderCreatives(campaignId: string) {
    await Promise.all(
        PLACEHOLDER_CREATIVE_TYPES.map((type) =>
            fetch(`/api/campaigns/${campaignId}/creatives`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, promptType: "GUIDED" }),
            }).catch(() => {})
        )
    );
}

async function clearCampaignBrief(campaignId: string) {
    await fetch(`/api/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignBreif: null }),
    }).catch(() => {});
}

async function prepareCampaignBrief(campaignId: string, isEditing: boolean) {
    if (isEditing) {
        await clearCampaignBrief(campaignId);
        return;
    }

    await createPlaceholderCreatives(campaignId);
}

async function invokeCampaignBriefAgent(campaignId: string) {
    const token = await getAgentToken();
    if (!token) return;

    const agentBase = "/api";
    await fetch(`${agentBase}/agents/campaign/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
            campaign_id: campaignId,
            message: CAMPAIGN_BRIEF_MESSAGE,
        }),
    }).catch(() => {});
}

async function campaignBriefExists(campaignId: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/campaigns/${campaignId}`);
        if (!response.ok) return false;

        const data = await response.json();
        return Boolean((data.campaign ?? data).campaignBreif);
    } catch {
        return false;
    }
}

async function waitForCampaignBrief(campaignId: string, maxAttempts = 10, delayMs = 3000): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (await campaignBriefExists(campaignId)) return;
        if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}

function buildPlanRoute(campaignId: string): string {
    return `/plan?campaignId=${campaignId}&t=${Date.now()}`;
}

export default function NewCampaignPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
            <NewCampaignContent />
        </Suspense>
    );
}

function NewCampaignContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const existingCampaignId = searchParams.get("campaignId"); // Check if editing existing campaign
    const session = authClient.useSession();

    // --- State Management ---
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingBrands, setIsCheckingBrands] = useState(true);
    const [stage, setStage] = useState<"form" | "analyzing" | "brief">("form");
    const [nameError, setNameError] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        description: "", // Added for UI
        category: "Lead generation",
        channels: ["Instagram", "Facebook", "Twitter"] as string[],
        objective: "",
        budget: "",
        currency: "INR",
        timezone: "Asia/Kolkata",
        startDate: "",
        endDate: "",
        promptType: "GUIDED" as "GUIDED" | "ADVANCED",
        tags: [] as string[],
    });

    // --- Load existing campaign data if campaignId is in URL ---
    useEffect(() => {
        if (!existingCampaignId) return;
        
        console.log("[Brief] Loading existing campaign:", existingCampaignId);
        
        fetch(`/api/campaigns/${existingCampaignId}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                const camp = data?.campaign ?? data;
                
                console.log("[Brief] Loaded campaign data:", camp);
                
                // Populate form with existing data
                setFormData({
                    name: camp.name || "",
                    description: camp.objective || "",
                    category: camp.category || "Lead generation",
                    channels: camp.channels || ["Instagram", "Facebook", "Twitter"],
                    objective: camp.objective || "",
                    budget: camp.budget ? String(camp.budget) : "",
                    currency: camp.currency || "INR",
                    timezone: camp.timezone || "Asia/Kolkata",
                    startDate: camp.startDate ? new Date(camp.startDate).toISOString().split('T')[0] : "",
                    endDate: camp.endDate ? new Date(camp.endDate).toISOString().split('T')[0] : "",
                    promptType: camp.promptType || "GUIDED",
                    tags: camp.tags || [],
                });
            })
            .catch(err => console.error("[Brief] Error loading campaign:", err));
    }, [existingCampaignId]);

    // --- Original Logic (Brand Check) ---
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
            setIsCheckingBrands(false);
            return;
        }
        if (!session.isPending && !session.data) {
            router.replace("/sign-in");
            return;
        }
        if (session.data) {
            fetch("/api/brands")
                .then((res) => res.json())
                .then((brands) => {
                    if (Array.isArray(brands) && brands.length === 0) {
                        router.replace("/brands");
                    } else {
                        setIsCheckingBrands(false);
                    }
                })
                .catch(() => setIsCheckingBrands(false));
        } else if (!session.isPending) {
            setIsCheckingBrands(false);
        }
    }, [session.data, session.isPending, router]);

    // --- Original Logic (Handle Save & Next) ---
    const handleSaveAndNext = async () => {
        // If editing, confirm regeneration since it will replace the existing brief
        if (existingCampaignId) {
            const confirmed = globalThis.confirm(
                "This will regenerate the campaign brief based on your updated details. The existing brief will be replaced. Continue?"
            );
            if (!confirmed) return;
        }
        
        setIsSubmitting(true);
        try {
            // If campaignId exists (editing), update the campaign; otherwise create new
            const isEditing = !!existingCampaignId;
            const campaignRes = await fetch(
                isEditing ? `/api/campaigns/${existingCampaignId}` : "/api/campaigns",
                {
                    method: isEditing ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formData.name,
                        category: formData.category,
                        channels: [],          // channels selected in Plan step
                        aspectRatio: [],       // derived from channels in Plan step
                        objective: formData.objective || formData.description || undefined,
                        budget: formData.budget ? Number.parseFloat(formData.budget) : undefined,
                        currency: formData.currency,
                        timezone: formData.timezone,
                        startDate: parseCampaignStartDate(formData.startDate),
                        promptType: formData.promptType,
                        tags: formData.tags,
                    }),
                }
            );
            if (!campaignRes.ok) {
                const errData = await campaignRes.json().catch(() => ({}));
                const msg = errData.error || (isEditing ? "Failed to update campaign" : "Failed to create campaign");
                if (campaignRes.status === 409) {
                    setNameError(msg);
                    setIsSubmitting(false);
                    return;
                }
                throw new Error(msg);
            }
            const campaign = await campaignRes.json();
            const newCampaignId = isEditing ? existingCampaignId : campaign.id;

            if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
                router.push(`/campaigns/${newCampaignId}`);
                return;
            }

            await prepareCampaignBrief(newCampaignId, isEditing);
            await invokeCampaignBriefAgent(newCampaignId);

            await waitForCampaignBrief(newCampaignId);
            setIsSubmitting(false);
            router.push(buildPlanRoute(newCampaignId));
        } catch (error) {
            console.error(error);
            setStage("form");
            setIsSubmitting(false);
        }
    };

    if (session.isPending || isCheckingBrands) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#4CAF31]" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-zinc-900">
            {/* SIDEBAR */}
            <aside className="w-64 bg-white border-r border-zinc-100 flex flex-col shrink-0">
                <div className="p-6">
                    <div className="flex items-center gap-2 text-[#4CAF31] font-bold text-xl uppercase tracking-tighter">
                        MAR<span className="text-zinc-800">TECH</span>
                    </div>
                    <p className="text-[9px] text-zinc-400 font-medium uppercase tracking-wider mt-0.5">
                        Marketing . Technology . Solution.
                    </p>
                </div>

                <nav className="flex-1 px-4 space-y-6 overflow-y-auto">
                    <div>
                        <p className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Overview</p>
                        <ul className="space-y-1">
                            <SidebarItem icon={<Home size={18} />} label="Home" onClick={() => router.push('/dashboard')} />
                            <SidebarItem icon={<Package size={18} />} label="Subscribed Product" />
                            <SidebarItem icon={<LayoutGrid size={18} />} label="Marketplace" />
                        </ul>
                    </div>
                    <div>
                        <p className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Martech</p>
                        <ul className="space-y-1">
                            <SidebarItem icon={<Send size={18} />} label="Campaign Manager" active />
                            <div className="ml-4 border-l-2 border-[#E8F5E9]">
                                <li className="text-sm font-semibold text-zinc-800 bg-[#E8F5E9] py-2 px-4 rounded-r-md">Create</li>
                                <SidebarSubItem label="Optimizers" hasArrow />
                                <SidebarSubItem label="Optimize Journey" />
                                <SidebarSubItem label="Optimize Time" />
                            </div>
                        </ul>
                    </div>
                    <div>
                        <p className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Others</p>
                        <ul className="space-y-1">
                            <SidebarItem icon={<Users size={18} />} label="Users" />
                            <SidebarItem icon={<Package size={18} />} label="Assets" />
                            <SidebarItem icon={<CreditCard size={18} />} label="Payment" />
                            <SidebarItem icon={<Settings size={18} />} label="Settings" />
                        </ul>
                    </div>
                </nav>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col min-w-0">
                <header className="h-16 border-b border-zinc-100 flex items-center justify-between px-8 bg-white">
                    <div className="text-xs font-medium text-zinc-400">
                        Campaign Manager &gt; <span className="text-zinc-900 font-bold">{existingCampaignId ? "Edit Campaign" : "New Campaign"}</span>
                    </div>
                    <BrandAvatar />
                </header>

                <div className="p-12 max-w-5xl mx-auto w-full overflow-y-auto">
                    {/* PROGRESS STEPPER */}
                    <div className="relative flex justify-between items-start mb-12 max-w-2xl mx-auto">
                        {/* Background line */}
                        <div className="absolute top-2 left-0 w-full h-[2px] bg-zinc-100 -z-10" />
                        {/* Completed line — Brief to Plan (0% width on brief page) */}
                        <div className="absolute top-2 left-0 w-0 h-[2px] bg-[#4CAF31] -z-10 transition-all duration-500" />
                        <StepItem label="Brief" active />
                        <StepItem label="Plan" />
                        <StepItem label="Design" />
                    </div>

                    <div className="bg-white rounded-xl">
                        <h2 className="text-2xl font-serif text-zinc-800 mb-1">{existingCampaignId ? "Edit Campaign Details" : "Campaign Details"}</h2>
                        <p className="text-zinc-500 text-sm mb-8">{existingCampaignId ? "Update your campaign details and regenerate the plan." : "Let's start with the basics. Define what this campaign is, what it stands for, and when it goes live."}</p>

                        <div className="border border-zinc-100 rounded-xl p-8 space-y-8 shadow-sm">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-bold text-zinc-800 whitespace-nowrap">Campaign Details</h3>
                                <div className="h-[1px] w-full bg-zinc-100" />
                            </div>
                            <p className="text-xs text-zinc-400 -mt-6">This sets the context for everything that follows — including your AI-generated strategy.</p>

                            {/* Campaign Description */}
                            <div className="space-y-2">
                                <label htmlFor="campaign-description" className="text-xs font-bold text-zinc-600 uppercase tracking-tight">Campaign Description</label>
                                <textarea 
                                    id="campaign-description"
                                    rows={3}
                                    placeholder="What is this campaign about? Summarize in 2-3 sentences"
                                    className="w-full border border-zinc-200 rounded-lg p-4 text-sm focus:ring-1 ring-[#4CAF31] outline-none placeholder:text-zinc-300"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* Campaign Name */}
                                <div className="space-y-2">
                                    <label htmlFor="campaign-name" className="text-xs font-bold text-zinc-600 uppercase tracking-tight">Campaign Name</label>
                                    <input 
                                        id="campaign-name"
                                        type="text"
                                        placeholder="e.g. New Year wishes 2026 . Summer Sale . Product Launch"
                                        className={`w-full border rounded-lg p-3 text-sm focus:ring-1 outline-none ${nameError ? "border-red-400 ring-red-200" : "border-zinc-200 ring-[#4CAF31]"}`}
                                        value={formData.name}
                                        onChange={(e) => { setFormData({...formData, name: e.target.value}); setNameError(""); }}
                                    />
                                    {nameError && <p className="text-xs text-red-500">{nameError}</p>}
                                </div>

                                {/* Go Live Date */}
                                <div className="space-y-2">
                                    <label htmlFor="campaign-go-live-date" className="text-xs font-bold text-zinc-600 uppercase tracking-tight">Go Live Date</label>
                                    <div className="relative">
                                        <input 
                                            id="campaign-go-live-date"
                                            type="date"
                                            className="w-full border border-zinc-200 rounded-lg p-3 text-sm outline-none pr-10 focus:ring-1 ring-[#4CAF31]"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                                        />
                                        <Calendar className="absolute right-3 top-3 text-zinc-300 pointer-events-none" size={18} />
                                    </div>
                                </div>
                            </div>

                            {/* Suggestion Chips */}
                            <div className="flex flex-wrap gap-2">
                                <SuggestionChip label="New Year Special Offers for loyal customers" onClick={() => setFormData({...formData, name: "New Year Special Offers for loyal customers"})} />
                                <SuggestionChip label="Exclusive Holiday Discounts for email subscribers" onClick={() => setFormData({...formData, name: "Exclusive Holiday Discounts for email subscribers"})} />
                                <SuggestionChip label="Valentine's Day Promotion" onClick={() => setFormData({...formData, name: "Valentine's Day Promotion"})} />
                            </div>

                            <div className="flex justify-end pt-4">
                                <button 
                                    onClick={handleSaveAndNext}
                                    disabled={isSubmitting || !formData.name}
                                    className="bg-[#4CAF31] text-white px-8 py-3 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-[#3d8e27] transition-all shadow-md disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            {existingCampaignId ? "Regenerating Brief..." : "Generating Brief..."}
                                        </>
                                    ) : (
                                        <>{existingCampaignId ? "Regenerate Plan" : "Generate Plan"} <Sparkles size={16} /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <footer className="h-20 bg-white border-t border-zinc-100 flex items-center justify-between px-12 gap-4 mt-auto">
                    <button 
                        onClick={() => router.push("/dashboard")}
                        className="px-10 py-2.5 border border-zinc-200 rounded-md text-sm font-bold text-zinc-500 hover:bg-zinc-50 bg-[#F9FBFA]"
                    >
                        ← Go to Dashboard
                    </button>
                    <div className="flex items-center gap-4">
                        <button className="px-10 py-2.5 border border-zinc-200 rounded-md text-sm font-bold text-zinc-500 hover:bg-zinc-50 bg-[#F9FBFA]">
                            Save Draft
                        </button>
                        <button 
                            onClick={handleSaveAndNext}
                            disabled={isSubmitting || !formData.name}
                            className="px-10 py-2.5 bg-[#4CAF31] rounded-md text-sm font-bold text-white hover:bg-[#3d8e27] disabled:opacity-50"
                        >
                            Save & Next
                        </button>
                    </div>
                </footer>

                {/* ANALYZING MODAL */}
                {stage === "analyzing" && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4 shadow-2xl">
                            <Loader2 className="h-10 w-10 animate-spin text-[#4CAF31]" />
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-zinc-900 mb-2">Building Your Brief</h3>
                                <p className="text-sm text-zinc-500">Our AI is analyzing your goals to generate a tailored strategy.</p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// --- Internal UI Components ---

function SidebarItem({ icon, label, active = false, onClick }: Readonly<{ icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }>) {
    const className = `flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${active ? 'text-[#4CAF31]' : 'text-zinc-500 hover:bg-zinc-50'}`;
    const content = (
        <>
            <span className={active ? "text-[#4CAF31]" : "text-zinc-400"}>{icon}</span>
            <span className="text-[13px] font-semibold">{label}</span>
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

function SidebarSubItem({ label, hasArrow = false }: Readonly<{ label: string; hasArrow?: boolean }>) {
    return (
        <li className="flex items-center justify-between py-2 px-4 text-[13px] font-medium text-zinc-600 hover:text-[#4CAF31]">
            {label}
            {hasArrow && <ChevronDown size={14} />}
        </li>
    );
}

function StepItem({ label, active = false, completed = false }: Readonly<{ label: string; active?: boolean; completed?: boolean }>) {
    let indicatorClass = 'bg-zinc-300 border-white';
    if (completed) {
        indicatorClass = 'bg-[#4CAF31] border-[#4CAF31]';
    } else if (active) {
        indicatorClass = 'bg-[#4CAF31] border-[#E8F5E9]';
    }

    return (
        <div className="flex flex-col items-center gap-2 relative bg-[#FDFDFD] px-6">
            <div className={`w-4 h-4 rounded-full border-4 transition-all flex items-center justify-center ${indicatorClass}`}>
                {completed && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
            </div>
            <span className={`text-sm font-bold ${active || completed ? 'text-zinc-900' : 'text-zinc-400'}`}>{label}</span>
        </div>
    );
}

function SuggestionChip({ label, onClick }: Readonly<{ label: string; onClick: () => void }>) {
    return (
        <button onClick={onClick} className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-100 bg-white hover:border-[#4CAF31]/30 hover:bg-zinc-50 transition-all shadow-sm">
            <Sparkles size={12} className="text-[#4CAF31]" />
            <span className="text-[11px] font-medium text-zinc-600">{label}</span>
        </button>
    );
}

