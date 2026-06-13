"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient, getAgentToken } from "@/lib/auth-client";
import {
    CheckCircle2,
    Loader2,
    Sparkles,
    Plus,
    X,
    UploadCloud,
    FileText
} from "lucide-react";

export default function BrandOnboardingPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-white">
                    <Loader2 className="h-8 w-8 animate-spin text-[#4CAF31]" />
                </div>
            }
        >
            <BrandOnboardingContent />
        </Suspense>
    );
}

function BrandOnboardingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editBrandId = searchParams.get("edit");
    const session = authClient.useSession();

    const [isSubmitting, setIsSubmitting] = useState(false);
    // stage: "form" | "analyzing" | "brief" | "done"
    const [stage, setStage] = useState<"form" | "analyzing" | "brief">("form");
    const [brandId, setBrandId] = useState<string>("");
    const [brandBrief, setBrandBrief] = useState<any>(null);
    const [briefText, setBriefText] = useState("");
    const [briefTimedOut, setBriefTimedOut] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [isEditingBrief, setIsEditingBrief] = useState(false);
    const [isSavingBrief, setIsSavingBrief] = useState(false);
    const [saveError, setSaveError] = useState("");

    const [formData, setFormData] = useState({
        // Brand
        name: "",
        adminEmail: "",
        website: "",
        phone: "",
        phoneCountryCode: "+91",
        industry: "",
        companyInfo: "",
        companyOrigin: "",
        termsAccepted: false,
        marketingConsent: false,
        // BrandKit
        toneOfVoice: "Professional",
        guidelines: "",
        styleGuide: "", // Style guide as plain text
        colors: ["#4CAF31", "#333333", "#F0F9F6"],
        fonts: [] as { name: string; weight: number }[],
        // Audiences — array, each submitted as a separate Audience record
        audiences: [] as {
            name: string;
            demographics: { ageRange: string; gender: string[]; location: string[] };
            interests: string[];
            personas: object[]; // AI-generated
        }[],
    });

    // Draft audience being built before it's added to the list
    const emptyDraft = {
        name: "",
        demographics: { ageRange: "", gender: [] as string[], location: [] as string[] },
        interests: [] as string[],
        personas: [] as object[],
    };
    const [draft, setDraft] = useState(emptyDraft);

    const [newFontName, setNewFontName] = useState("");
    const [newInterest, setNewInterest] = useState("");
    const [newLocation, setNewLocation] = useState("");

    // ── Audience handlers (operate on draft) ─────────────────────────────────
    const addAudience = () => {
        if (!draft.name.trim()) return;
        setFormData({ ...formData, audiences: [...formData.audiences, draft] });
        setDraft(emptyDraft);
        setNewInterest("");
        setNewLocation("");
    };
    const removeAudience = (i: number) => {
        setFormData({ ...formData, audiences: formData.audiences.filter((_, idx) => idx !== i) });
    };
    const addInterest = () => {
        const v = newInterest.trim().toLowerCase();
        if (v && !draft.interests.includes(v)) {
            setDraft({ ...draft, interests: [...draft.interests, v] });
            setNewInterest("");
        }
    };
    const removeInterest = (i: number) => {
        setDraft({ ...draft, interests: draft.interests.filter((_, idx) => idx !== i) });
    };
    const addLocation = () => {
        const v = newLocation.trim();
        if (v && !draft.demographics.location.includes(v)) {
            setDraft({ ...draft, demographics: { ...draft.demographics, location: [...draft.demographics.location, v] } });
            setNewLocation("");
        }
    };
    const removeLocation = (i: number) => {
        setDraft({ ...draft, demographics: { ...draft.demographics, location: draft.demographics.location.filter((_, idx) => idx !== i) } });
    };
    const toggleGender = (g: string) => {
        const cur = draft.demographics.gender;
        setDraft({ ...draft, demographics: { ...draft.demographics, gender: cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g] } });
    };

    const [files, setFiles] = useState<{
        logo: File | null;
        fonts: File[];
    }>({ logo: null, fonts: [] });
    const [logoError, setLogoError] = useState("");
    const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

    // Auth / Brand Check
    const [isCheckingBrands, setIsCheckingBrands] = useState(true);

    useEffect(() => {
        // In mock mode, skip auth and brand check entirely
        if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
            setIsCheckingBrands(false);
            return;
        }
        if (session.data) {
            fetch("/api/brands")
                .then(res => res.json())
                .then(brands => {
                    // Skip redirect if we're in edit mode
                    if (editBrandId) {
                        setIsCheckingBrands(false);
                        return;
                    }
                    // Only redirect if we're still on the form stage (not after submission)
                    if (Array.isArray(brands) && brands.length > 0 && stage === "form") {
                        router.replace("/dashboard");
                    } else {
                        setIsCheckingBrands(false);
                    }
                })
                .catch(err => {
                    console.error("Error fetching brands:", err);
                    setIsCheckingBrands(false);
                });
        } else if (!session.isPending) {
            router.replace("/sign-in");
            setIsCheckingBrands(false);
        }
    }, [session.data, session.isPending, router, editBrandId]);

    // Pre-fill form when editing an existing brand
    useEffect(() => {
        if (!editBrandId || !session.data || isCheckingBrands) return;
        // Fetch brand details, kit, and logo URL in parallel
        Promise.all([
            fetch("/api/brands").then(r => r.ok ? r.json() : null),
            fetch(`/api/brands/${editBrandId}/kit`).then(r => r.ok ? r.json() : null),
            fetch(`/api/brands/${editBrandId}/logo-url`).then(r => r.ok ? r.json() : null),
        ]).then(([brandsData, kitData, logoData]) => {
            const brands = Array.isArray(brandsData) ? brandsData : (brandsData?.brands ?? []);
            const brand = brands.find((b: any) => b.id === editBrandId) ?? brands[0];
            const kit = kitData?.brandKit ?? kitData;

            if (logoData?.url) {
                const raw = logoData.url as string;
                const proxied = `/api/image-proxy?url=${encodeURIComponent(raw)}`;
                setExistingLogoUrl(proxied);
            }

            setFormData(prev => ({
                ...prev,
                name: brand?.name || prev.name,
                adminEmail: brand?.adminEmail || prev.adminEmail,
                website: brand?.website || prev.website,
                phone: brand?.phone || prev.phone,
                phoneCountryCode: brand?.phoneCountryCode || prev.phoneCountryCode,
                industry: brand?.industry || prev.industry,
                companyInfo: brand?.companyInfo || prev.companyInfo,
                companyOrigin: brand?.companyOrigin || prev.companyOrigin,
                toneOfVoice: kit?.toneOfVoice || prev.toneOfVoice,
                guidelines: kit?.guidelines || prev.guidelines,
                styleGuide: kit?.styleGuide || brand?.companyGuidelines || prev.styleGuide,
                colors: [
                    kit?.primaryColor || prev.colors[0],
                    kit?.secondaryColor || prev.colors[1],
                    kit?.accentColor || prev.colors[2],
                ],
                fonts: Array.isArray(kit?.fonts) && kit.fonts.length > 0 ? kit.fonts : prev.fonts,
            }));
            setBrandId(editBrandId);
        }).catch(() => { });
    }, [editBrandId, session.data, isCheckingBrands]);

    if (session.isPending || isCheckingBrands) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#4CAF31]" />
            </div>
        );
    }
    if (!session.data && process.env.NEXT_PUBLIC_USE_MOCK !== "true") {
        return null;
    }

    const handleFileUpload = (type: keyof typeof files, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            if (type === "logo") {
                const file = e.target.files[0];
                const allowed = ["image/jpeg", "image/png", "image/svg+xml", "image/webp", "image/gif"];
                if (!allowed.includes(file.type)) {
                    setLogoError("Only image files are allowed (JPG, PNG, SVG, WEBP).");
                    e.target.value = "";
                    return;
                }
                setLogoError("");
                setFiles({ ...files, logo: file });
            } else {
                setFiles({ ...files, [type]: [...(files[type] as File[]), ...Array.from(e.target.files)] });
            }
        }
    };

    const addFont = () => {
        if (newFontName.trim()) {
            setFormData({ ...formData, fonts: [...formData.fonts, { name: newFontName.trim(), weight: 400 }] });
            setNewFontName("");
        }
    };
    const removeFont = (index: number) => {
        setFormData({ ...formData, fonts: formData.fonts.filter((_, i) => i !== index) });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveError("");
        setIsSubmitting(true);
        setStage("analyzing");

        const agentBase = "/api";

        try {
            let currentBrandId = brandId || editBrandId;

            if (currentBrandId) {
                // ── UPDATE existing brand ──────────────────────────────────
                const brandRes = await fetch(`/api/brands/${currentBrandId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formData.name,
                        adminEmail: formData.adminEmail,
                        website: formData.website,
                        phone: formData.phone,
                        phoneCountryCode: formData.phoneCountryCode,
                        industry: formData.industry,
                        companyInfo: formData.companyInfo,
                        companyOrigin: formData.companyOrigin,
                        toneOfVoice: formData.toneOfVoice,
                        styleGuide: formData.styleGuide,
                        termsAccepted: formData.termsAccepted,
                        marketingConsent: formData.marketingConsent,
                    }),
                });
                if (!brandRes.ok) throw new Error("Failed to update brand profile");
            } else {
                // ── CREATE new brand ───────────────────────────────────────
                const brandRes = await fetch("/api/brands", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formData.name,
                        adminEmail: formData.adminEmail,
                        website: formData.website,
                        phone: formData.phone,
                        phoneCountryCode: formData.phoneCountryCode,
                        industry: formData.industry,
                        companyInfo: formData.companyInfo,
                        companyOrigin: formData.companyOrigin,
                        toneOfVoice: formData.toneOfVoice,
                        styleGuide: formData.styleGuide,
                        termsAccepted: formData.termsAccepted,
                        marketingConsent: formData.marketingConsent,
                    }),
                });
                if (!brandRes.ok) throw new Error(`Brand API failed: ${brandRes.status}`);
                const brand = await brandRes.json();
                currentBrandId = brand.id;
                setBrandId(currentBrandId!);
            }

            // ── Step 2: POST /api/brands/:id/audiences ────────────────────
            if (formData.audiences.length > 0) {
                const audienceRes = await fetch(`/api/brands/${currentBrandId}/audiences`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ audiences: formData.audiences }),
                });
                if (!audienceRes.ok) throw new Error("Failed to create audience segments");
            }

            // ── Step 3: POST /api/brands/:id/kit ──────────────────────────
            // Only POST (multipart) if new files are being uploaded.
            // For text-only updates (colors, fonts, guidelines) use PUT.
            const hasNewFiles = !!files.logo || files.fonts.length > 0;

            if (hasNewFiles) {
                const kitDataToSend = {
                    colors: formData.colors,
                    fonts: formData.fonts,
                    guidelines: formData.guidelines,
                };
                const kit = new FormData();
                kit.append("data", JSON.stringify(kitDataToSend));
                if (files.logo) kit.append("logo", files.logo);
                files.fonts.forEach(f => kit.append("fonts", f));

                const kitRes = await fetch(`/api/brands/${currentBrandId}/kit`, {
                    method: "POST",
                    body: kit,
                });
                if (!kitRes.ok) throw new Error("Failed to upload brand kit");

                await kitRes.json().catch(() => null);
            } else {
                // No new files — just update the text fields via PUT
                const kitRes = await fetch(`/api/brands/${currentBrandId}/kit`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        colors: formData.colors,
                        fonts: formData.fonts,
                        guidelines: formData.guidelines,
                    }),
                });
                // PUT may not exist on all backends — treat 404/405 as non-fatal
                if (!kitRes.ok && kitRes.status !== 404 && kitRes.status !== 405) {
                    throw new Error("Failed to update brand kit");
                }
            }

            // In mock mode, skip agent invoke and go straight to brief stage
            if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
                setBrandBrief({ strategy: "Mock brand brief — AI analysis skipped in mock mode.", themes: ["mock"], hooks: ["test"] });
                setBriefText("Mock brand brief — AI analysis skipped in mock mode.");
                setStage("brief");
                return;
            }

            // ── Step 4: Invoke AI brand analysis ──────────────────────────
            const token = await getAgentToken();
            console.log("AGENT TOKEN:", token);
            if (!token) throw new Error("Could not get auth token");

            const agentRes = await fetch(`${agentBase}/agents/brand/invoke`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ 
                    brand_id: currentBrandId,
                 }),
            });
            console.log("AGENT RESPONSE:", agentRes);
            if (!agentRes.ok) throw new Error("Failed to invoke AI agent");

            const agentData = await agentRes.json();

            console.log("AGENT DATA", agentData);

            const saveBriefRes = await fetch(
                `/api/brands/${currentBrandId}/kit/brief`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        brandBrief: agentData.data.brand_brief,
                    }),
                }
            );

            console.log("SAVE BRIEF STATUS", saveBriefRes.status);

            const saveBriefData = await saveBriefRes.json();

            console.log("SAVE BRIEF RESPONSE", saveBriefData);

            // Move to analyzing stage — lock the form
            // Poll for brand brief
            let attempts = 0;
            const maxAttempts = 10;
            const pollBrief = async () => {
                try {
                    const kitRes = await fetch(`/api/brands/${currentBrandId}/kit`);
                    if (kitRes.ok) {
                        const data = await kitRes.json();
                        const brief = data.brandKit?.brandBrief;
                        if (brief) {
                            setBrandBrief(brief);
                            const strategy = typeof brief === "object" ? (brief.strategy ?? JSON.stringify(brief, null, 2)) : String(brief);
                            setBriefText(strategy);
                            setStage("brief");
                            return;
                        }
                    }
                } catch { }
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(pollBrief, 3000);
                } else {
                    setBriefTimedOut(true);
                    setStage("brief");
                }
            };
            setTimeout(pollBrief, 2000);
        } catch (error) {
            console.error(error);
            setSaveError("Error saving brand profile. Please try again.");
            setStage("form"); // revert back to form on error
        } finally {
            setIsSubmitting(false);
        }
    };

    const retryBrandBrief = async () => {
        if (!brandId) return;
        setIsRetrying(true);
        setBriefTimedOut(false);
        setStage("analyzing");

        try {
            const agentBase = "/api";
            const token = await getAgentToken();
            if (token) {
                await fetch(`${agentBase}/agents/brand/invoke`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ brand_id: brandId }),
                });
            }
        } catch { }

        // Resume polling
        let attempts = 0;
        const maxAttempts = 30;
        const poll = async () => {
            try {
                const kitRes = await fetch(`/api/brands/${brandId}/kit`);
                if (kitRes.ok) {
                    const data = await kitRes.json();
                    const brief = data.brandKit?.brandBrief;
                    if (brief) {
                        setBrandBrief(brief);
                        const strategy = typeof brief === "object" ? (brief.strategy ?? JSON.stringify(brief, null, 2)) : String(brief);
                        setBriefText(strategy);
                        setBriefTimedOut(false);
                        setStage("brief");
                        setIsRetrying(false);
                        return;
                    }
                }
            } catch { }
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(poll, 5000);
            } else {
                setBriefTimedOut(true);
                setStage("brief");
                setIsRetrying(false);
            }
        };
        setTimeout(poll, 5000);
    };


    return (
        <div className="flex min-h-screen w-full flex-col bg-white md:flex-row">
            {/* LEFT SECTION */}
            <section className="relative hidden w-full flex-col justify-start bg-[#F0F9F6] p-12 md:flex md:w-1/3 lg:p-20 overflow-hidden">
                <div className="mb-8 z-10">
                    <h2 className="text-4xl font-bold text-[#4CAF31]">MAR<span className="text-[#333]">TECH</span></h2>
                    <p className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">Marketing . Technology . Solution.</p>
                </div>
                <div className="max-w-md z-10">
                    <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-zinc-900">Your Brand, <br />Powered by AI.</h1>
                    <p className="mb-10 text-zinc-600">Complete your profile to let our AI agents understand your brand DNA and start generating high-converting content.</p>
                    <ul className="space-y-3">
                        {["AI Brand Identity", "Auto-styled Campaigns", "Target Audience Sync"].map((text, i) => (
                            <li key={i} className="flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-sm w-fit border border-zinc-100 text-sm font-medium text-zinc-700">
                                <CheckCircle2 className="h-4 w-4 text-[#4CAF31]" /> {text}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* RIGHT SECTION: FORM */}
            <section className="flex w-full items-center justify-center p-6 md:w-2/3 overflow-y-auto">
                <div className="w-full max-w-2xl py-10">
                    {stage === "form" ? (
                        <form onSubmit={handleSubmit} className="space-y-10 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-bold text-zinc-900">Brand Configuration</h2>
                                <p className="text-zinc-500">Tell us about your company and visual identity.</p>
                            </div>
                            {saveError && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                    {saveError}
                                </div>
                            )}

                            {/* ─── BASIC INFO ────────────────────────────────────────────── */}
                            <div className="space-y-6">
                                <h3 className="text-xl font-semibold border-b pb-2 text-zinc-800">1. Company Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label htmlFor="company-name" className="text-xs font-bold text-zinc-500 uppercase">Company Name</label>
                                        <input id="company-name" required className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900 placeholder:text-zinc-500"
                                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label htmlFor="industry-name" className="text-xs font-bold text-zinc-500 uppercase">Industry</label>
                                        <input id="industry-name" className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900 placeholder:text-zinc-500"
                                            value={formData.industry} onChange={e => setFormData({ ...formData, industry: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label htmlFor="emailID" className="text-xs font-bold text-zinc-500 uppercase">Admin Email</label>
                                        <input id="emailID" required type="email" className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900 placeholder:text-zinc-500"
                                            value={formData.adminEmail} onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label htmlFor="website" className="text-xs font-bold text-zinc-500 uppercase">Website</label>
                                        <input id="website" type="url" placeholder="https://" className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900 placeholder:text-zinc-500"
                                            value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5 col-span-1">
                                        <label htmlFor="phoneCountryCode" className="text-xs font-bold text-zinc-500 uppercase">Country Code</label>
                                        <select
                                            id="phoneCountryCode"
                                            className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900"
                                            value={formData.phoneCountryCode}
                                            onChange={e => setFormData({ ...formData, phoneCountryCode: e.target.value, phone: "" })}
                                        >
                                            {[
                                                { code: "+91", label: "+91 India" },
                                                { code: "+1", label: "+1 USA/Canada" },
                                                { code: "+44", label: "+44 UK" },
                                                { code: "+60", label: "+60 Malaysia" },
                                                { code: "+65", label: "+65 Singapore" },
                                                { code: "+971", label: "+971 UAE" },
                                                { code: "+61", label: "+61 Australia" },
                                            ].map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5 col-span-2">
                                        <label htmlFor="phoneNumber" className="text-xs font-bold text-zinc-500 uppercase">Phone Number</label>
                                        <input
                                            id="phoneNumber"
                                            type="tel"
                                            placeholder={formData.phoneCountryCode === "+91" ? "10-digit number (6–9 start)" : "Phone number"}
                                            className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900 placeholder:text-zinc-500"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
                                        />
                                        {formData.phone && formData.phoneCountryCode === "+91" && !/^[6-9][0-9]{9}$/.test(formData.phone) && (
                                            <p className="text-xs text-red-500 mt-1">Must be a valid 10-digit Indian number starting with 6–9</p>
                                        )}
                                        {formData.phone && formData.phoneCountryCode !== "+91" && formData.phone.length < 7 && (
                                            <p className="text-xs text-red-500 mt-1">Phone number seems too short</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="companyInfo" className="text-xs font-bold text-zinc-500 uppercase">Company Description (AI Context)</label>
                                    <textarea id="companyInfo" rows={3} placeholder="Describe your brand mission and what makes you unique..." className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900 placeholder:text-zinc-500"
                                        value={formData.companyInfo} onChange={e => setFormData({ ...formData, companyInfo: e.target.value })} />
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="origin" className="text-xs font-bold text-zinc-500 uppercase">Company Origin / Founding Story</label>
                                    <textarea id="origin" rows={3} placeholder="How did your company start? What's the story behind the brand..." className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900 placeholder:text-zinc-500"
                                        value={formData.companyOrigin} onChange={e => setFormData({ ...formData, companyOrigin: e.target.value })} />
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="toneOfVoice" className="text-xs font-bold text-zinc-500 uppercase">Tone of Voice</label>
                                    <input id="toneOfVoice" placeholder="e.g. Friendly, Professional, Bold..." className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900 placeholder:text-zinc-500"
                                        value={formData.toneOfVoice} onChange={e => setFormData({ ...formData, toneOfVoice: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xl font-semibold border-b pb-2 text-zinc-800">2. Brand Identity</h3>

                                {/* Style Guide — plain text */}
                                <div className="space-y-1.5">
                                    <label htmlFor="styleGuide" className="text-xs font-bold text-zinc-500 uppercase">Style Guide</label>
                                    <textarea id="styleGuide" rows={5} placeholder="Paste your brand style guide, tone guidelines, dos & don'ts..." className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900 placeholder:text-zinc-500 resize-y"
                                        value={formData.styleGuide} onChange={e => setFormData({ ...formData, styleGuide: e.target.value })} />
                                </div>




                                {/* Fonts */}
                                <div className="space-y-1.5">
                                    <label htmlFor="FontName" className="text-xs font-bold text-zinc-500 uppercase">Brand Fonts</label>
                                    <div className="flex gap-2">
                                        <input id="FontName" className="flex-1 rounded-xl border border-zinc-200 p-3 text-sm focus:border-[#4CAF31] outline-none bg-zinc-50/30 text-zinc-900 placeholder:text-zinc-500"
                                            value={newFontName} onChange={e => setNewFontName(e.target.value)} placeholder="e.g. Montserrat, Lato" />
                                        <button type="button" onClick={addFont} className="p-3 bg-zinc-100 rounded-xl hover:bg-zinc-200 text-zinc-900"><Plus className="h-4 w-4" /></button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {formData.fonts.map((f, i) => (
                                            <span key={i} className="flex items-center gap-1 bg-zinc-100 text-zinc-700 px-3 py-1 rounded-full text-xs font-medium border border-zinc-200">
                                                {f.name} <X className="h-3 w-3 cursor-pointer ml-1" onClick={() => removeFont(i)} />
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Font Files */}
                                <div className="space-y-1.5">
                                    <label id="font-upload" className="text-xs font-bold text-zinc-500 uppercase">Font Files (Optional)</label>
                                    <p className="text-[10px] text-zinc-400">Upload .ttf or .otf files if you want to use custom fonts</p>
                                    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 p-4 bg-zinc-50/50">
                                        <label className="cursor-pointer flex items-center justify-center gap-2 bg-white border border-zinc-200 px-4 py-2 rounded-lg text-xs font-bold text-zinc-900 shadow-sm hover:bg-zinc-50 w-full mb-1">
                                            <UploadCloud className="w-4 h-4" /> Upload Fonts (TTF/OTF)
                                            <input id="font-upload" type="file" hidden multiple accept=".ttf,.otf,.woff,.woff2" onChange={e => handleFileUpload("fonts", e)} />
                                        </label>
                                        {files.fonts.length > 0 && (
                                            <div className="text-xs text-zinc-500 w-full max-h-24 overflow-y-auto">
                                                {files.fonts.map((f, i) => <div key={i} className="truncate">{f.name}</div>)}
                                            </div>
                                        )}
                                    </div>
                                </div>




                            </div>


                            {/* ─── BRAND KIT / IDENTITY ────────────────────────────────────────────── */}


                            {/* Colors */}
                            <div className="space-y-4">

                                <h4 className="text-xs font-bold text-zinc-500 uppercase">Preferred Colors (Manual Override)</h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[{ label: "Primary", index: 0 }, { label: "Secondary", index: 1 }, { label: "Accent", index: 2 }].map(color => (
                                        <div key={color.index} className="flex flex-col gap-1.5">


                                            <label
                                                htmlFor={`color-${color.index}`}
                                                className="text-[10px] uppercase font-bold text-zinc-500 ml-1"
                                            >
                                                {color.label}
                                            </label>

                                            <div className="flex items-center gap-3 p-2 border border-zinc-200 rounded-xl bg-zinc-50/30 w-full">

                                                <input
                                                    id={`color-${color.index}`}
                                                    type="color"
                                                    className="h-8 w-8 rounded cursor-pointer shrink-0 border-0 p-0"
                                                    value={formData.colors[color.index]}
                                                    onChange={e => {
                                                        const newColors = [...formData.colors];
                                                        newColors[color.index] = e.target.value.toUpperCase();
                                                        setFormData({ ...formData, colors: newColors });
                                                    }}
                                                />


                                                <input
                                                    type="text"
                                                    aria-label={`${color.label} hex code`}
                                                    className="w-full bg-transparent text-sm font-mono uppercase text-zinc-900 outline-none"
                                                    value={formData.colors[color.index]}
                                                    onChange={e => {
                                                        const newColors = [...formData.colors];
                                                        newColors[color.index] = e.target.value.toUpperCase();
                                                        setFormData({ ...formData, colors: newColors });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ─── ASSET UPLOADS ────────────────────────────────────────────── */}
                            <div className="space-y-6">
                                <h3 className="text-xl font-semibold border-b pb-2 text-zinc-800">4. Asset Uploads</h3>

                                {/* Logo */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Brand Logo</label>
                                    {existingLogoUrl && !files.logo && (
                                        <div className="flex items-center gap-3 mb-2">
                                            <img src={existingLogoUrl} alt="Current logo" className="h-12 w-12 rounded-lg object-contain border border-zinc-200 bg-white p-1" />
                                            <span className="text-xs text-zinc-500">Current logo — upload a new one to replace</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-4 rounded-xl border border-dashed border-zinc-300 p-4 bg-zinc-50/50">
                                        <label className="cursor-pointer bg-white border border-zinc-200 px-4 py-2 rounded-lg text-xs font-bold text-zinc-900 shadow-sm hover:bg-zinc-50">
                                            {existingLogoUrl ? "Replace Logo" : "Choose Logo"}
                                            <input type="file" hidden accept="image/jpeg,image/png,image/svg+xml,image/webp" onChange={e => handleFileUpload("logo", e)} />
                                        </label>
                                        <span className="text-xs text-zinc-500 truncate">{files.logo ? files.logo.name : "No file..."}</span>
                                    </div>
                                    {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
                                </div>




                            </div>

                            {/* ─── CONSENT & TERMS ────────────────────────────────────────────── */}
                            <div className="space-y-4 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#4CAF31] focus:ring-[#4CAF31]"
                                        checked={formData.termsAccepted} onChange={e => setFormData({ ...formData, termsAccepted: e.target.checked })} required />
                                    <span className="text-sm text-zinc-600">I agree to the <span className="font-semibold text-zinc-800">Terms of Service</span> and <span className="font-semibold text-zinc-800">Privacy Policy</span>.</span>
                                </label>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#4CAF31] focus:ring-[#4CAF31]"
                                        checked={formData.marketingConsent} onChange={e => setFormData({ ...formData, marketingConsent: e.target.checked })} />
                                    <span className="text-sm text-zinc-600">I consent to receiving marketing communications.</span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !formData.termsAccepted}
                                className="group flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#4CAF31] font-bold text-white transition-all hover:bg-[#3d8e27] shadow-lg disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="animate-spin" />
                                        AI is analyzing assets...
                                    </>
                                ) : (
                                    <>
                                        Complete Onboarding
                                        <Sparkles className="h-4 w-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : null}

                    {/* Analyzing modal — overlays the form */}
                    {stage === "analyzing" && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                            <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
                                <div className="h-16 w-16 rounded-full bg-[#4CAF31]/10 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-[#4CAF31]" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-zinc-900 mb-2">AI is Analyzing Your Brand</h3>
                                    <p className="text-sm text-zinc-500">Our AI agents are building your brand identity, extracting colors, tone of voice, and generating your brand brief. This may take a minute.</p>
                                </div>
                                <div className="flex gap-1.5">
                                    {[0, 1, 2].map(i => (
                                        <div key={i} className="h-2 w-2 rounded-full bg-[#4CAF31] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {stage === "brief" ? (
                        /* ── Brand Brief review ── */
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-bold text-zinc-900">Your Brand Brief</h2>
                                <p className="text-zinc-500 mt-1">Review the AI-generated brand strategy. You can edit it before going to your dashboard.</p>
                            </div>

                            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                                    <div className="flex items-center gap-2 text-zinc-800">
                                        <FileText className="text-[#4CAF31]" size={20} />
                                        <h3 className="text-lg font-bold">Brand Strategy</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isEditingBrief ? (
                                            <button
                                                onClick={() => setIsEditingBrief(true)}
                                                className="px-4 py-1.5 flex items-center gap-2 text-sm font-semibold text-[#0052CC] bg-[#E5EFFF] hover:bg-[#D5E6FF] rounded transition-colors"
                                            >
                                                Edit Brief
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setIsEditingBrief(false);
                                                        const strategy = brandBrief && typeof brandBrief === "object" ? (brandBrief.strategy ?? "") : String(brandBrief ?? "");
                                                        setBriefText(strategy);
                                                    }}
                                                    disabled={isSavingBrief}
                                                    className="px-4 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded transition-colors disabled:opacity-50"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        setIsSavingBrief(true);
                                                        try {
                                                            const updatedBrief = brandBrief && typeof brandBrief === "object"
                                                                ? { ...brandBrief, strategy: briefText }
                                                                : { strategy: briefText };
                                                            const res = await fetch(`/api/brands/${brandId}/kit/brief`, {
                                                                method: "PUT",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({ brandBrief: updatedBrief }),
                                                            });
                                                            if (!res.ok) throw new Error("Failed to save");
                                                            setBrandBrief(updatedBrief);
                                                            setIsEditingBrief(false);
                                                        } catch {
                                                            setSaveError("Failed to save brief. Please try again.");
                                                        } finally {
                                                            setIsSavingBrief(false);
                                                        }
                                                    }}
                                                    disabled={isSavingBrief}
                                                    className="px-4 py-1.5 flex items-center gap-2 text-sm font-bold text-white bg-[#4CAF31] hover:bg-[#3d8e27] rounded transition-colors disabled:opacity-50 shadow-sm"
                                                >
                                                    {isSavingBrief ? <Loader2 size={14} className="animate-spin" /> : null}
                                                    Save Brief
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="p-6">
                                    {isEditingBrief ? (
                                        <textarea
                                            value={briefText}
                                            onChange={e => setBriefText(e.target.value)}
                                            className="w-full min-h-[300px] border border-zinc-200 rounded-lg p-4 text-sm focus:ring-2 focus:ring-[#4CAF31]/20 focus:border-[#4CAF31] outline-none resize-y leading-relaxed text-zinc-700 bg-zinc-50"
                                        />
                                    ) : briefTimedOut ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-zinc-400">
                                            <p className="text-sm font-medium text-zinc-600">Brief generation timed out or failed.</p>
                                            <p className="text-xs text-zinc-400">The AI agent may have encountered an issue. Click retry to try again.</p>
                                            <button
                                                onClick={retryBrandBrief}
                                                disabled={isRetrying}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-[#4CAF31] text-white text-sm font-bold rounded-xl hover:bg-[#3d8e27] disabled:opacity-50 transition-colors"
                                            >
                                                {isRetrying ? <Loader2 size={14} className="animate-spin" /> : null}
                                                {isRetrying ? "Retrying..." : "Retry Generation"}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="prose prose-sm max-w-none text-zinc-700 leading-relaxed whitespace-pre-wrap rounded-lg p-4 bg-zinc-50/50 border border-zinc-100 min-h-[200px]">
                                            {briefText || <span className="italic text-zinc-400">AI is still generating your brief...</span>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Link
                                    href="/dashboard"
                                    className="px-8 py-3 bg-[#4CAF31] text-white font-bold text-sm rounded-xl hover:bg-[#3d8e27] transition-colors shadow-lg shadow-[#4CAF31]/20 flex items-center gap-2"
                                >
                                    <Sparkles className="h-4 w-4" /> Go to Dashboard
                                </Link>
                            </div>
                        </div>
                    ) : null}
                </div>
            </section>
        </div>
    );
}
