"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Home, Send, ShoppingBag, LayoutGrid, Users, Box, CreditCard, 
  Settings, ChevronDown, ChevronUp, Check, Bell, Mail, MessageCircle, Loader2, Plus, X
} from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { PlatformSelector } from "@/components/campaigns/PlatformSelector";
import type { TargetPlatform } from "@/lib/platforms";

interface Audience {
  id: string;
  name: string;
  demographics?: { ageRange?: string; gender?: string[]; location?: string[] };
  interests?: string[];
}

interface AudienceDraft {
  name: string;
  demographics: { ageRange: string; gender: string[]; location: string[] };
  interests: string[];
}

function createEmptyAudienceDraft(): AudienceDraft {
  return {
    name: "",
    demographics: { ageRange: "", gender: [], location: [] },
    interests: [],
  };
}

function normalizeAudienceList(data: any): Audience[] {
  return Array.isArray(data) ? data : data?.segments ?? data?.data ?? [];
}

function formatCampaignBrief(brief: unknown): string {
  if (!brief) return "";
  if (typeof brief === "object") {
    const b = brief as Record<string, unknown>;
    const strategy = b.strategy;
    if (typeof strategy === "string") return strategy;
    return JSON.stringify(brief);
  }
  return typeof brief === "string" ? brief : JSON.stringify(brief);
}

async function fetchCampaignPlanData(campaignId: string) {
  const response = await fetch(`/api/campaigns/${campaignId}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });

  if (response.status === 404 || response.status === 403) {
    return { redirect: true as const };
  }

  if (!response.ok) {
    return { redirect: false as const, campaign: null };
  }

  const data = await response.json();
  return { redirect: false as const, campaign: data?.campaign ?? data ?? null };
}

async function saveAudienceDraft(audienceDraft: AudienceDraft): Promise<Audience[]> {
  const brandsRes = await fetch("/api/brands");
  const brandsData = await brandsRes.json();
  const brandsList = Array.isArray(brandsData) ? brandsData : brandsData.brands ?? [];
  const brandId = brandsList[0]?.id;
  if (!brandId) throw new Error("No brand found");

  const res = await fetch(`/api/brands/${brandId}/audiences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audiences: [audienceDraft] }),
  });
  if (!res.ok) throw new Error("Failed to save audience");

  const audRes = await fetch("/api/audiences");
  const audienceData = await audRes.json();
  return normalizeAudienceList(audienceData);
}

function buildAudienceContext(audience: Audience) {
  const parts = [`${audience.name}:`];
  if (audience.demographics?.ageRange) parts.push(`Age ${audience.demographics.ageRange}`);
  if (audience.demographics?.location?.length) parts.push("in " + audience.demographics.location.join(", "));
  if (audience.interests?.length) parts.push("Interests: " + audience.interests.join(", "));
  return parts.join(" ");
}

export default function NewCampaignPlan() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <NewCampaignPlanContent />
    </Suspense>
  );
}

function NewCampaignPlanContent() {
  const [openSection, setOpenSection] = useState<number | null>(1);
  const searchParams = useSearchParams();
  const router = useRouter();
  const campaignId = searchParams.get("campaignId");
  const refreshTimestamp = searchParams.get("t"); // Used to force reload
  const { isPending, isAuthenticated } = useAuthGuard();

  // Audience state
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [selectedAudienceIds, setSelectedAudienceIds] = useState<string[]>([]);
  const [loadingAudiences, setLoadingAudiences] = useState(false);

  // New audience builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [isSavingAudience, setIsSavingAudience] = useState(false);
  const [audienceError, setAudienceError] = useState("");

  // Content mix state
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImageError, setReferenceImageError] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [audienceDraft, setAudienceDraft] = useState({
    ...createEmptyAudienceDraft(),
  });
  const [newInterest, setNewInterest] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const [campaignName, setCampaignName] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("");
  const [campaignGoLiveDate, setCampaignGoLiveDate] = useState("");
  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [targetPlatforms, setTargetPlatforms] = useState<TargetPlatform[]>([]);

  // Clear form when coming back from design page
  useEffect(() => {
    const fromDesign = searchParams.get("fromDesign");
    if (fromDesign === "true") {
      // Clear the interactive form fields
      setSelectedAudienceIds([]);
      setReferenceImage(null);
      setReferenceImageError("");
      setShowBuilder(false);
      setAudienceDraft(createEmptyAudienceDraft());
      setNewInterest("");
      setNewLocation("");
      
      // Remove the fromDesign param from URL
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("fromDesign");
      router.replace(`/plan?${newParams.toString()}`);
    }
  }, [searchParams, router]);

  // Redirect if no campaignId in URL
  useEffect(() => {
    if (!campaignId && isAuthenticated) {
      router.replace("/campaigns");
    }
  }, [campaignId, isAuthenticated, router]);

  // Fetch campaign data - reload when campaignId changes or when returning from brief
  useEffect(() => {
    if (!campaignId) return;
    
    // Force reload by setting loading state
    setLoadingCampaign(true);
    
    fetchCampaignPlanData(campaignId)
      .then(result => {
        if (result.redirect) {
          router.replace("/campaigns");
          return;
        }

        const camp = result.campaign;
        if (!camp) return;
        
        // Update campaign name
        setCampaignName(camp.name ?? "");
        
        // Update campaign objective/brief - always use latest from database
        const brief = camp.campaignBreif;
        const strategy = formatCampaignBrief(brief);
        if (strategy) {
          setCampaignObjective(strategy);
        } else {
          setCampaignObjective("");
        }
        
        // Update go-live date
        if (camp.startDate) {
          setCampaignGoLiveDate(new Date(camp.startDate).toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric"
          }));
        }
        
        if (camp.targetPlatforms) {
          setTargetPlatforms(camp.targetPlatforms);
        }
      })
      .catch((err) => {
        console.error("[Plan] Error loading campaign:", err);
        router.replace("/campaigns");
      })
      .finally(() => setLoadingCampaign(false));
  }, [campaignId, refreshTimestamp ?? "", router]); // Use empty string as fallback to keep array size consistent

  // Poll for campaign brief if it's missing (agent might still be generating)
  useEffect(() => {
    if (!campaignId || loadingCampaign || campaignObjective) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" }
        });
        if (res.ok) {
          const data = await res.json();
          const camp = data?.campaign ?? data;
          const brief = camp?.campaignBreif;
          
          if (brief) {
            const strategy = formatCampaignBrief(brief);
            setCampaignObjective(strategy);
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error("[Plan] Polling error:", err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [campaignId, loadingCampaign, campaignObjective]);

  // Fetch existing audiences
  useEffect(() => {
    setLoadingAudiences(true);
    fetch("/api/audiences")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const list: Audience[] = normalizeAudienceList(data);
        setAudiences(list);
      })
      .catch(() => {})
      .finally(() => setLoadingAudiences(false));
  }, []);

  if (isPending) return <div className="flex min-h-screen items-center justify-center"><div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

  const selectedAudiences = audiences.filter(a => selectedAudienceIds.includes(a.id));

  const toggleAudience = (audienceId: string) => {
    setSelectedAudienceIds(prev => 
      prev.includes(audienceId) 
        ? prev.filter(id => id !== audienceId)
        : [...prev, audienceId]
    );
  };

  const saveNewAudience = async () => {
    if (!audienceDraft.name.trim()) return;
    setAudienceError("");
    setIsSavingAudience(true);
    try {
      const list = await saveAudienceDraft(audienceDraft);
      setAudiences(list);

      // Auto-select the new one
      const newAud = list.find((a: Audience) => a.name === audienceDraft.name);
      if (newAud) setSelectedAudienceIds(prev => [...prev, newAud.id]);

      // Reset builder
      setAudienceDraft(createEmptyAudienceDraft());
      setNewInterest("");
      setNewLocation("");
      setShowBuilder(false);
    } catch (err: any) {
      setAudienceError(err.message ?? "Failed to save audience");
    } finally {
      setIsSavingAudience(false);
    }
  };

function renderObjectiveContent(loading: boolean, objective: string) {
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-[#4CAF31]" />
        <span className="text-gray-400 italic">Loading campaign...</span>
      </div>
    );
  }
  if (objective) {
    return objective;
  }
  return (
    <div className="flex items-center gap-2">
      <Loader2 size={14} className="animate-spin text-[#4CAF31]" />
      <span className="text-gray-400 italic">Generating brief... This may take a moment.</span>
    </div>
  );
}

function renderAudienceContent(
  loading: boolean,
  audiences: Audience[],
  selectedIds: string[],
  onToggle: (id: string) => void,
  onEmptyClick: () => void
) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
        <Loader2 size={14} className="animate-spin" /> Loading audiences...
      </div>
    );
  }
  if (audiences.length === 0) {
    return (
      <div className="p-4 border border-dashed border-gray-200 rounded-lg text-sm text-gray-400 text-center">
        <span>No audiences found.</span>
        <button
          onClick={onEmptyClick}
          className="ml-1 text-[#4CAF31] font-semibold hover:underline"
        >
          Create one in Brand settings.
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {audiences.map(audience => (
        <button
          type="button"
          key={audience.id}
          onClick={() => onToggle(audience.id)}
          className={`w-full text-left flex items-start gap-3 p-4 border rounded-lg transition-all ${
            selectedIds.includes(audience.id)
              ? "border-[#4CAF31] bg-[#F0F9F1]"
              : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <div className={`w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
            selectedIds.includes(audience.id) ? "border-[#4CAF31] bg-[#4CAF31]" : "border-gray-300"
          }`}>
            {selectedIds.includes(audience.id) && <Check size={10} className="text-white" strokeWidth={3} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800">{audience.name}</p>
            {audience.demographics?.ageRange && (
              <p className="text-xs text-gray-400 mt-0.5">
                Age {audience.demographics.ageRange}
                {audience.demographics.location?.length ? ` · ${audience.demographics.location.slice(0, 2).join(", ")}` : ""}
              </p>
            )}
            {audience.interests && audience.interests.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {audience.interests.slice(0, 4).map((interest) => (
                  <span key={interest} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded-full">
                    {interest}
                  </span>
                ))}
                {audience.interests.length > 4 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-[10px] rounded-full">
                    +{audience.interests.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="p-6">
          <div className="text-[#4CAF31] font-black text-xl tracking-tighter italic uppercase">
            MAR<span className="text-gray-800">TECH</span>
          </div>
          <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-tight">
            Marketing . Technology . Solution
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-8 mt-4">
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">Overview</h4>
            <SidebarItem icon={<Home size={18} />} label="Home" />
            <SidebarItem icon={<ShoppingBag size={18} />} label="Subscribed Product" />
            <SidebarItem icon={<LayoutGrid size={18} />} label="Marketplace" />
          </div>

          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">Martech</h4>
            <SidebarItem icon={<Send size={18} />} label="Campaign Manager" active />
            <div className="ml-8 mt-2 space-y-2 border-l border-gray-100 pl-4">
              <div className="text-sm font-bold text-[#4CAF31] bg-[#F0F9F1] p-2 rounded-md">Create</div>
              <SidebarSubItem label="Optimizers" hasArrow />
              <SidebarSubItem label="Optimize Journey" />
              <SidebarSubItem label="Optimize Time" />
              <SidebarSubItem label="Analyzer Best Practice" />
            </div>
            <SidebarItem icon={<LayoutGrid size={18} />} label="Analytics & Reports" />
          </div>

          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">Others</h4>
            <SidebarItem icon={<Users size={18} />} label="Users" />
            <SidebarItem icon={<Box size={18} />} label="Assets" />
            <SidebarItem icon={<CreditCard size={18} />} label="Payment" />
            <SidebarItem icon={<Settings size={18} />} label="Settings" />
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8">
          <div className="text-xs font-medium text-gray-400">
            Campaign Manager &gt; <span className="text-gray-900 font-bold">New Campaign</span>
          </div>
          <div className="w-8 h-8 rounded border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs bg-blue-50">
            B
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 max-w-5xl mx-auto w-full">
          <h1 className="text-2xl font-semibold text-gray-800 mb-1">Campaign plan · at a glance</h1>
          <p className="text-gray-500 text-sm mb-12">Hover any field to edit. The AI will re-balance downstream steps as you change things.</p>

          {/* STEPPER */}
          <div className="relative flex justify-between items-center mb-16 max-w-3xl mx-auto">
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gray-100 -z-10 -translate-y-1/2"></div>
            <div className="absolute top-1/2 left-0 w-1/2 h-[2px] bg-[#4CAF31] -z-10 -translate-y-1/2 transition-all"></div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 bg-[#4CAF31] rounded-full flex items-center justify-center text-white">
                <Check size={14} strokeWidth={4} />
              </div>
              <span className="text-sm font-bold text-gray-900">Brief</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-3 h-3 bg-[#4CAF31] rounded-full ring-8 ring-[#F0F9F1]"></div>
              <span className="text-sm font-bold text-gray-900 mt-1">Plan</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span className="text-sm font-bold text-gray-400">Design</span>
            </div>
          </div>

          {/* TIMELINE ACCORDION */}
          <div className="relative pl-10">
            {/* Dashed Vertical Line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-[1px] border-l-2 border-dashed border-gray-200"></div>

            {/* SECTION 01 - SUMMARY */}
            <TimelineSection 
              number="01" 
              title="Summary" 
              subtitle="This sets the context for everything that follows — including your AI-generated creative."
              isOpen={openSection === 1}
              onClick={() => setOpenSection(openSection === 1 ? null : 1)}
            >
              <div className="space-y-6 pt-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Campaign Name</p>
                  <div className="w-full p-3 border border-gray-100 rounded-lg text-sm text-gray-700 bg-white hover:border-[#4CAF31] cursor-text transition-colors">
                    {loadingCampaign ? <span className="text-gray-300 italic">Loading...</span> : campaignName || <span className="text-gray-300 italic">Not set</span>}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Objective</p>
                  <div className="w-full p-3 border border-gray-100 rounded-lg text-sm text-gray-700 bg-white hover:border-[#4CAF31] cursor-text transition-colors min-h-[60px] leading-relaxed">
                    {renderObjectiveContent(loadingCampaign, campaignObjective)}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Go Live Date</p>
                  <div className="w-full p-3 border border-gray-100 rounded-lg text-sm text-gray-700 bg-white hover:border-[#4CAF31] cursor-text transition-colors">
                    {campaignGoLiveDate ? <span className="font-bold">{campaignGoLiveDate}</span> : <span className="text-gray-300 italic">Not set</span>}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Channels</p>
                  <div className="flex flex-wrap gap-3">
                    <ChannelChip icon={<span className="text-pink-500 text-xs font-bold">IG</span>} label="Instagram" />
                    <ChannelChip icon={<MessageCircle className="text-green-500" size={14} />} label="WhatsApp" />
                    <ChannelChip icon={<Mail className="text-orange-400" size={14} />} label="Email" />
                    <ChannelChip icon={<Bell className="text-yellow-500" size={14} />} label="Push" />
                  </div>
                </div>
              </div>
            </TimelineSection>

            {/* SECTION 02 - AUDIENCE */}
            <TimelineSection 
              number="02" 
              title="Audience & Timeline" 
              isOpen={openSection === 2}
              onClick={() => setOpenSection(openSection === 2 ? null : 2)}
            >
              <div className="space-y-6 pt-6">
                {/* Audience Selection */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Target Audiences</p>
                  <p className="text-xs text-gray-400 mb-3">Select one or more target audiences for this campaign.</p>
                  {renderAudienceContent(loadingAudiences, audiences, selectedAudienceIds, toggleAudience, () => router.push("/brands"))}
                </div>

                {/* Selected audiences summary */}
                {selectedAudiences.length > 0 && (
                  <div className="p-4 bg-[#F0F9F1] border border-[#4CAF31]/20 rounded-lg">
                    <p className="text-xs font-bold text-[#4CAF31] uppercase tracking-widest mb-2">
                      {selectedAudiences.length} {selectedAudiences.length === 1 ? "Audience" : "Audiences"} Selected
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedAudiences.map(audience => (
                        <div key={audience.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#4CAF31]/30 rounded-lg">
                          <span className="text-sm font-semibold text-gray-800">{audience.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAudience(audience.id);
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create new audience */}
                <div>
                  <button
                    onClick={() => setShowBuilder(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#4CAF31] hover:underline"
                  >
                    <Plus size={12} /> {showBuilder ? "Cancel" : "Create new audience"}
                  </button>

                  {showBuilder && (
                    <div className="mt-4 border border-dashed border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50/50">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New Audience</p>
                      {audienceError && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                          {audienceError}
                        </p>
                      )}

                      {/* Name */}
                      <div className="space-y-1.5">
                        <label htmlFor="audience-name" className="text-xs font-bold text-gray-500 uppercase">Audience Name</label>
                        <input
                          id="audience-name"
                          placeholder="e.g. Young Professionals"
                          className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 ring-[#4CAF31]"
                          value={audienceDraft.name}
                          onChange={e => setAudienceDraft({ ...audienceDraft, name: e.target.value })}
                        />
                      </div>

                      {/* Age + Gender */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label htmlFor="audience-age-range" className="text-xs text-gray-400">Age Range</label>
                          <select
                            id="audience-age-range"
                            className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none bg-white"
                            value={audienceDraft.demographics.ageRange}
                            onChange={e => setAudienceDraft({ ...audienceDraft, demographics: { ...audienceDraft.demographics, ageRange: e.target.value } })}
                          >
                            <option value="">Select</option>
                            {["13-17","18-24","25-34","35-44","45-54","55-64","65+"].map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <fieldset className="space-y-1.5">
                          <legend className="text-xs text-gray-400">Gender</legend>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {["Male","Female","All"].map(g => (
                              <button
                                key={g} type="button"
                                onClick={() => {
                                  const cur = audienceDraft.demographics.gender;
                                  setAudienceDraft({ ...audienceDraft, demographics: { ...audienceDraft.demographics, gender: cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g] } });
                                }}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${audienceDraft.demographics.gender.includes(g) ? "bg-[#4CAF31] text-white border-[#4CAF31]" : "bg-white text-gray-600 border-gray-200"}`}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      </div>

                      {/* Location */}
                      <div className="space-y-1.5">
                        <label htmlFor="audience-location" className="text-xs text-gray-400">Location</label>
                        <div className="flex gap-2">
                          <input
                            id="audience-location"
                            className="flex-1 border border-gray-200 rounded-lg p-2.5 text-sm outline-none"
                            placeholder="e.g. India, UK"
                            value={newLocation}
                            onChange={e => setNewLocation(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && newLocation.trim()) { setAudienceDraft({ ...audienceDraft, demographics: { ...audienceDraft.demographics, location: [...audienceDraft.demographics.location, newLocation.trim()] } }); setNewLocation(""); } }}
                          />
                          <button type="button" onClick={() => { if (newLocation.trim()) { setAudienceDraft({ ...audienceDraft, demographics: { ...audienceDraft.demographics, location: [...audienceDraft.demographics.location, newLocation.trim()] } }); setNewLocation(""); } }} className="p-2.5 bg-gray-100 rounded-lg hover:bg-gray-200">
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {audienceDraft.demographics.location.map((l, i) => (
                            <span key={l} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs border border-gray-200">
                              {l}
                              <button
                                type="button"
                                onClick={() => setAudienceDraft({ ...audienceDraft, demographics: { ...audienceDraft.demographics, location: audienceDraft.demographics.location.filter((_, idx) => idx !== i) } })}
                                className="text-gray-500 hover:text-red-500"
                                aria-label={`Remove ${l}`}
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Interests */}
                      <div className="space-y-1.5">
                        <label htmlFor="audience-interest" className="text-xs text-gray-400">Interests</label>
                        <div className="flex gap-2">
                          <input
                            id="audience-interest"
                            className="flex-1 border border-gray-200 rounded-lg p-2.5 text-sm outline-none"
                            placeholder="e.g. fitness, tech"
                            value={newInterest}
                            onChange={e => setNewInterest(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && newInterest.trim()) { setAudienceDraft({ ...audienceDraft, interests: [...audienceDraft.interests, newInterest.trim().toLowerCase()] }); setNewInterest(""); } }}
                          />
                          <button type="button" onClick={() => { if (newInterest.trim()) { setAudienceDraft({ ...audienceDraft, interests: [...audienceDraft.interests, newInterest.trim().toLowerCase()] }); setNewInterest(""); } }} className="p-2.5 bg-gray-100 rounded-lg hover:bg-gray-200">
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {audienceDraft.interests.map((int, i) => (
                            <span key={int} className="flex items-center gap-1 bg-[#F0F9F1] text-[#2d6b1d] px-2.5 py-0.5 rounded-full text-xs border border-[#c6eacc]">
                              {int}
                              <button
                                type="button"
                                onClick={() => setAudienceDraft({ ...audienceDraft, interests: audienceDraft.interests.filter((_, idx) => idx !== i) })}
                                className="text-[#2d6b1d] hover:text-red-500"
                                aria-label={`Remove ${int}`}
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!audienceDraft.name.trim() || isSavingAudience}
                        onClick={saveNewAudience}
                        className="flex items-center gap-2 px-4 py-2 bg-[#4CAF31] text-white text-xs font-bold rounded-lg hover:bg-[#3d8e27] disabled:opacity-50 transition-colors"
                      >
                        {isSavingAudience ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        Save Audience
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </TimelineSection>

            {/* SECTION 03 - CONTENT */}
            <TimelineSection 
              number="03" 
              title="Content Mix" 
              isOpen={openSection === 3}
              onClick={() => setOpenSection(openSection === 3 ? null : 3)}
            >
              <div className="space-y-6 pt-6">

                {/* Target Platforms */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Target Platforms</p>
                  <p className="text-xs text-gray-400 mb-3">— select platforms for platform-aware generation</p>
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6">
                    <PlatformSelector
                        selected={targetPlatforms}
                        onChange={setTargetPlatforms}
                    />
                  </div>
                </div>

                {/* Reference Image */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Reference Image</p>
                  <p className="text-xs text-gray-400 mb-3">Upload a reference image to guide the visual style of generated creatives.</p>
                  <div className="relative">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full text-left border-2 border-dashed rounded-xl p-6 transition-all flex items-center gap-4 ${
                      referenceImage ? "border-[#4CAF31]/40 bg-[#F0F9F1]" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {referenceImage ? (
                        <img
                          src={URL.createObjectURL(referenceImage)}
                          alt="preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <svg className="text-gray-300 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {referenceImage ? (
                        <>
                          <p className="text-sm font-semibold text-gray-800 truncate">{referenceImage.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{(referenceImage.size / 1024).toFixed(1)} KB</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-gray-600">Click to upload reference image</p>
                          <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP — max 10MB</p>
                        </>
                      )}
                    </div>
                  </button>
                    {referenceImage && (
                      <button
                        type="button"
                        onClick={() => { setReferenceImage(null); setReferenceImageError(""); }}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Remove reference image"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <input
                    id="reference-image"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith("image/")) {
                        setReferenceImageError("Only image files are allowed.");
                        e.target.value = "";
                        return;
                      }
                      if (file.size > 10 * 1024 * 1024) {
                        setReferenceImageError("File must be under 10MB.");
                        e.target.value = "";
                        return;
                      }
                      setReferenceImageError("");
                      setReferenceImage(file);
                    }}
                  />
                  {referenceImageError && <p className="text-xs text-red-500 mt-1">{referenceImageError}</p>}
                </div>

              </div>
            </TimelineSection>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="h-20 bg-white border-t border-gray-100 flex items-center justify-between px-8 gap-4 mt-auto">
          <button 
            onClick={() => router.push(`/campaigns?campaignId=${campaignId}`)}
            className="px-10 py-2.5 border border-gray-200 text-gray-600 rounded-md text-sm font-bold bg-[#F9FBFA] hover:bg-gray-50 transition-colors"
          >
            ← Back to Brief
          </button>
          <div className="flex items-center gap-4">
            <button className="px-10 py-2.5 border border-gray-200 text-gray-600 rounded-md text-sm font-bold bg-[#F9FBFA] hover:bg-gray-50 transition-colors">
              Save Draft
            </button>
            <button 
              onClick={async () => {
                if (!campaignId) return;
                
                // Confirm regeneration if creative briefs already exist
                const hasExistingBriefs = await fetch(`/api/campaigns/${campaignId}/creatives`)
                  .then(r => r.ok ? r.json() : null)
                  .then(data => {
                    const creatives = data?.creatives ?? [];
                    return creatives.some((c: any) => c.creativeBrief);
                  })
                  .catch(() => false);
                
                if (hasExistingBriefs) {
                  const confirmed = globalThis.confirm(
                    "This will regenerate all creative briefs based on your selected audience and channels. Existing briefs will be replaced. Continue?"
                  );
                  if (!confirmed) return;
                }
                
                // Save selected audience (first one if multiple selected) + channels to campaign
                // Note: Campaign model currently supports single audienceId
                // If multiple audiences selected, we save the first one
                await fetch(`/api/campaigns/${campaignId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...(selectedAudienceIds.length > 0 ? { audienceId: selectedAudienceIds[0] } : {}),
                    targetPlatforms,
                  }),
                }).catch(() => {});
                
                // Upload reference image if provided
                if (referenceImage) {
                  const fd = new FormData();
                  fd.append("referenceImage", referenceImage);
                  await fetch(`/api/campaigns/${campaignId}/reference-image`, {
                    method: "POST",
                    body: fd,
                  }).catch(() => {});
                }
                
                // Delete old creatives and re-create per-platform placeholders
                try {
                  const creativesRes = await fetch(`/api/campaigns/${campaignId}/creatives`);
                  if (creativesRes.ok) {
                    const data = await creativesRes.json();
                    const existingCreatives = data?.creatives ?? [];
                    
                    // Soft-delete all existing creatives
                    await Promise.all(
                      existingCreatives.map((c: any) =>
                        fetch(`/api/creatives/${c.id}`, { method: "DELETE" }).catch(() => {})
                      )
                    );
                  }
                } catch (err) {
                  console.error("Error clearing old creatives:", err);
                }

                // Create one IMAGE + one VIDEO + one EMAIL creative
                // Use the first selected platform as the primary aspect ratio;
                // other platform variants are generated on-demand via adapt-image.
                const primaryPlatform = targetPlatforms.length > 0
                  ? targetPlatforms[0]
                  : { platformName: "", aspectRatio: "1:1", orientation: "square" as const };

                await Promise.all([
                  fetch(`/api/campaigns/${campaignId}/creatives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "IMAGE",
                      promptType: "GUIDED",
                      platformName: primaryPlatform.platformName || null,
                      aspectRatio: primaryPlatform.aspectRatio || null,
                      orientation: primaryPlatform.orientation || null,
                    }),
                  }).catch(() => {}),
                  fetch(`/api/campaigns/${campaignId}/creatives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "VIDEO",
                      promptType: "GUIDED",
                      platformName: primaryPlatform.platformName || null,
                      aspectRatio: primaryPlatform.aspectRatio || null,
                      orientation: primaryPlatform.orientation || null,
                    }),
                  }).catch(() => {}),
                  fetch(`/api/campaigns/${campaignId}/creatives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "EMAIL", promptType: "GUIDED" }),
                  }).catch(() => {}),
                ]);
                
                // Run 2 — creative briefs with full audience + channel context
                try {
                  const { getAgentToken } = await import("@/lib/auth-client");
                  const token = await getAgentToken();
                  const agentBase = "/api";
                  if (token) {
                    // Build audience context from all selected audiences
                    const audienceContext = selectedAudiences.map(buildAudienceContext).join(" | ");
                    
                    // Fire and forget - agent will regenerate all creative briefs
                    fetch(`${agentBase}/agents/campaign/invoke`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                      body: JSON.stringify({
                        campaign_id: campaignId,
                        message: `SECOND RUN: Audience and channels are now set. Target audiences: ${audienceContext || "General audience"}. Fill ALL creative fields for every creative (creativeBrief, adCopy, headlines, callToAction, all guided prompts). You MUST overwrite existing creative briefs to incorporate the audience demographics, interests, and channel context. Do NOT change campaignBreif, keyMessages, or targetGoals — those are already set.`,
                      }),
                    }).catch(() => {});
                  }
                } catch {}
                
                // Navigate to preview page with timestamp to force reload
                router.push(`/previewall?campaignId=${campaignId}&t=${Date.now()}`);
              }}
              className="px-10 py-2.5 bg-[#4CAF31] text-white rounded-md text-sm font-bold hover:bg-[#439b2a] transition-colors shadow-sm shadow-[#4CAF31]/20"
            >
              Save & Next
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* Helper Components */

function SidebarItem({ icon, label, active = false }: { readonly icon: React.ReactNode; readonly label: string; readonly active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${active ? 'bg-[#F0F9F1] text-[#4CAF31] border-r-4 border-[#4CAF31] rounded-r-none' : 'text-gray-500 hover:bg-gray-50'}`}>
      <span className={active ? "text-[#4CAF31]" : "text-gray-400"}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function SidebarSubItem({ label, hasArrow = false }: { readonly label: string; readonly hasArrow?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-[#4CAF31]">
      {label}
      {hasArrow && <ChevronDown size={14} />}
    </div>
  );
}

interface TimelineSectionProps {
  readonly number: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
  readonly isOpen: boolean;
  readonly onClick: () => void;
}

function TimelineSection({ number, title, subtitle, children, isOpen, onClick }: TimelineSectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 font-bold text-sm transition-colors ${isOpen ? 'bg-[#4CAF31] text-white' : 'bg-white border-2 border-gray-100 text-gray-400'}`}>
          {number}
        </div>
        <div className="flex-1">
          <button
            type="button"
            className="w-full text-left flex items-center justify-between py-2 group"
            onClick={onClick}
          >
            <div>
              <h3 className="text-lg font-bold text-gray-800">{title}</h3>
              {isOpen && subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
            </div>
            {isOpen ? <ChevronUp size={20} className="text-gray-300" /> : <ChevronDown size={20} className="text-gray-300 group-hover:text-gray-500" />}
          </button>
          {isOpen && children}
          <div className="h-[1px] bg-gray-100 w-full mt-4"></div>
        </div>
      </div>
    </div>
  );
}

function ChannelChip({ icon, label }: { readonly icon: React.ReactNode; readonly label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border border-gray-100 rounded-lg bg-white text-xs font-bold text-gray-700 shadow-sm transition-all hover:border-gray-200">
      {icon}
      {label}
    </div>
  );
}
