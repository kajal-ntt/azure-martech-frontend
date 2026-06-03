"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Home, LayoutGrid, ShoppingBag, Send,
  ChevronDown, ChevronUp, Check, Edit2, ArrowRight, ImageIcon, Video, Mail, BookOpen, Loader2
} from "lucide-react";
import BrandAvatar from "@/components/BrandAvatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";

interface Creative {
  id: string;
  type: "IMAGE" | "VIDEO" | "EMAIL" | "BLOG";
  creativeBrief: string | null;
  emailBrief: string | null;
  adCopy: string | null;
  headlines: string[] | null;
  callToAction: string | null;
  guidedBackgroundPrompt: string | null;
  guidedActorsPrompt: string | null;
  guidedGraphicPrompt: string | null;
  guidedTextPrompt: string | null;
  guidedVideoVisualsPrompt: string | null;
  guidedVideoMotionPrompt: string | null;
  guidedVideoFormatPrompt: string | null;
  guidedVideoAudioPrompt: string | null;
  status: string;
}

const CREATIVE_FETCH_OPTIONS = {
  cache: "no-store" as const,
  headers: { "Cache-Control": "no-cache" },
};

const creativeHasBrief = (creative: Creative) => Boolean(creative.creativeBrief);
const allCreativesHaveBriefs = (list: Creative[]) => list.length > 0 && list.every(creativeHasBrief);
const readyBriefCount = (list: Creative[]) => list.filter(creativeHasBrief).length;

async function fetchCreatives(campaignId: string): Promise<Creative[]> {
  const res = await fetch(`/api/campaigns/${campaignId}/creatives`, CREATIVE_FETCH_OPTIONS);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.creatives ?? [];
}

const CREATIVE_TYPES = [
  {
    key: "IMAGE",
    number: "01",
    title: "Image Creation",
    subtitle: "Hero Images · AI-generated · brand-aligned",
    icon: <ImageIcon size={20} />,
    color: "blue",
  },
  {
    key: "VIDEO",
    number: "02",
    title: "Video Creation",
    subtitle: "Short-form video · cinematic · social-ready",
    icon: <Video size={20} />,
    color: "purple",
  },
  {
    key: "EMAIL",
    number: "03",
    title: "Email Creation",
    subtitle: "HTML email template · personalized · responsive",
    icon: <Mail size={20} />,
    color: "orange",
  },
  {
    key: "BLOG",
    number: "04",
    title: "Blog Post",
    subtitle: "SEO-optimized · markdown · campaign-aligned",
    icon: <BookOpen size={20} />,
    color: "amber",
  },
];

const CREATIVE_COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-500",
  purple: "bg-purple-50 text-purple-500",
  amber: "bg-amber-50 text-amber-500",
  orange: "bg-orange-50 text-orange-500",
};

export default function PreviewAllPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <PreviewAllContent />
    </Suspense>
  );
}

function PreviewAllContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const refreshTimestamp = searchParams.get("t"); // Used to force reload
  const { isPending, isAuthenticated } = useAuthGuard();

  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [generatingBlog, setGeneratingBlog] = useState(false);
  const [emailPersonalized, setEmailPersonalized] = useState(false);
  useEffect(() => {
    if (!campaignId && isAuthenticated) {
      router.replace("/campaigns");
    }
  }, [campaignId, isAuthenticated, router]);

  useEffect(() => {
    if (!campaignId) return;
    setLoading(true);
    setPolling(false);

    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (!pollInterval) return;
      clearInterval(pollInterval);
      pollInterval = null;
    };

    const applyCreativeList = (list: Creative[], fromPoll: boolean) => {
      setCreatives(list);

      if (allCreativesHaveBriefs(list)) {
        setLoading(false);
        setPolling(false);
        stopPolling();
        if (fromPoll) console.log("[PreviewAll] All briefs loaded, stopping poll");
        return;
      }

      setLoading(false);
      setPolling(true);
      if (fromPoll) {
        console.log("[PreviewAll] Polling... briefs ready:", readyBriefCount(list), "of", list.length);
      }
    };

    const pollCreatives = async () => {
      if (cancelled) {
        stopPolling();
        return;
      }

      try {
        const list = await fetchCreatives(campaignId);
        applyCreativeList(list, true);
      } catch (err) {
        console.error("[PreviewAll] Polling error:", err);
      }
    };

    const validateCampaign = async () => {
      const res = await fetch(`/api/campaigns/${campaignId}`, CREATIVE_FETCH_OPTIONS);
      if (res.status === 404 || res.status === 403) {
        router.replace("/campaigns");
        return false;
      }
      return res.ok;
    };

    const initialize = async () => {
      try {
        const isValid = await validateCampaign();
        if (!isValid || cancelled) return;

        pollInterval = setInterval(() => {
          void pollCreatives();
        }, 3000);

        const initialList = await fetchCreatives(campaignId);
        applyCreativeList(initialList, false);
      } catch {
        router.replace("/campaigns");
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [campaignId, refreshTimestamp ?? "", router]);

  if (isPending) return <div className="flex min-h-screen items-center justify-center"><div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

  const getCreativeByType = (type: string) =>
    creatives.find(c => c.type === type);

  const handleEdit = (type: string, creativeId: string) => {
    if (type === "IMAGE") {
      router.push(`/creatives/image?campaignId=${campaignId}&creativeId=${creativeId}`);
    } else if (type === "VIDEO") {
      router.push(`/creatives/video?campaignId=${campaignId}&creativeId=${creativeId}`);
    } else if (type === "EMAIL") {
      router.push(`/creatives/email?campaignId=${campaignId}&creativeId=${creativeId}`);
    }
  };

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
        <nav className="flex-1 px-4 space-y-6">
          <section>
            <p className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Overview</p>
            <ul className="space-y-1">
              <SidebarItem icon={<Home size={18} />} label="Home" onClick={() => router.push("/dashboard")} />
              <SidebarItem icon={<ShoppingBag size={18} />} label="Subscribed Product" />
              <SidebarItem icon={<LayoutGrid size={18} />} label="Marketplace" />
            </ul>
          </section>
          <section>
            <p className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Martech</p>
            <ul className="space-y-1">
              <SidebarItem icon={<Send size={18} />} label="Campaign Manager" active />
              <div className="ml-9 border-l border-zinc-100 pl-4 space-y-2 pt-1">
                <li className="text-sm font-semibold text-[#4CAF31] bg-[#F0F9F6] p-2 rounded-md">Design</li>
              </div>
            </ul>
          </section>
        </nav>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-zinc-100 flex items-center justify-between px-8 bg-white">
          <div className="text-xs font-medium text-zinc-500">
            Campaign Manager &gt; <span className="text-zinc-900 font-bold">New Campaign</span>
          </div>
          <BrandAvatar />
        </header>

        <div className="p-12 max-w-5xl mx-auto w-full overflow-y-auto">
          {/* STEPPER */}
          <div className="relative flex justify-between items-center mb-16 max-w-2xl mx-auto">
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#4CAF31] -z-10 -translate-y-1/2" />
            <StepItem label="Brief" status="completed" />
            <StepItem label="Plan" status="completed" />
            <StepItem label="Design" status="active" />
          </div>

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-zinc-800 mb-1">Campaign Creative Design</h2>
            <p className="text-zinc-500 text-sm">Select a creative type to view its brief and edit the guided prompts before generating.</p>
            {polling && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                AI is generating creative briefs... This takes about 30–60 seconds. The page will update automatically.
              </div>
            )}
          </div>

          {/* Creative Type Buttons */}
          <div className="relative pl-12 space-y-6">
            <div className="absolute left-[23px] top-10 bottom-10 w-[1px] border-l border-dashed border-[#4CAF31]" />

            {CREATIVE_TYPES.map((ct) => {
              const creative = getCreativeByType(ct.key);
              const isOpen = expandedType === ct.key;
              const hasBrief = !!creative?.creativeBrief;
              const iconClass = CREATIVE_COLOR_CLASSES[ct.color] ?? CREATIVE_COLOR_CLASSES.orange;
              const showPending = !loading && !creative;

              return (
                <div key={ct.key} className="relative group">
                  {/* Number bubble */}
                  <div className={`absolute -left-[54px] top-0 w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-all
                    ${isOpen ? "bg-[#4CAF31] text-white shadow-md" : "bg-white border-2 border-[#4CAF31] text-[#4CAF31]"}`}>
                    {ct.number}
                  </div>

                  <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm transition-all hover:shadow-md overflow-hidden">
                    {/* Clickable header button */}
                    <button
                      onClick={() => setExpandedType(isOpen ? null : ct.key)}
                      className="w-full flex items-center justify-between p-7 text-left group/btn"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}>
                          {ct.icon}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-zinc-800">{ct.title}</h3>
                          <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mt-0.5">{ct.subtitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {hasBrief && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#F0F9F6] text-[#4CAF31] border border-[#c6eacc]">
                            Brief Ready
                          </span>
                        )}
                        {showPending && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-400">
                            Pending
                          </span>
                        )}
                        {isOpen
                          ? <ChevronUp size={20} className="text-zinc-300" />
                          : <ChevronDown size={20} className="text-zinc-300 group-hover/btn:text-zinc-500" />
                        }
                      </div>
                    </button>

                    {/* Expanded brief panel */}
                    {isOpen && creative && (
                      <div className="px-7 pb-7 border-t border-zinc-50 pt-5 space-y-5">

                        {/* Brief — read only, edit via guided prompts */}
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                            Creative Brief
                          </p>
                          <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-sm text-zinc-700 leading-relaxed">
                            {creative.creativeBrief || (
                              <span className="italic text-zinc-400">No brief generated yet.</span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 pt-2">
                          {/* Edit Guided Prompts - only for IMAGE and VIDEO */}
                          {ct.key !== "EMAIL" && ct.key !== "BLOG" && (
                            <button
                              onClick={() => handleEdit(ct.key, creative.id)}
                              className="flex items-center gap-2 px-5 py-2.5 border border-zinc-200 bg-white text-zinc-700 text-sm font-bold rounded-xl hover:bg-zinc-50 transition-colors"
                              title="Edit prompts and choose number of variants"
                            >
                              <Edit2 size={14} />
                              Edit Guided Prompts
                            </button>
                          )}

                          {/* General / Personalized toggle — EMAIL only */}
                          {ct.key === "EMAIL" && (
                            <div className="flex bg-zinc-100 rounded-lg p-0.5 gap-0.5">
                              <button
                                onClick={() => setEmailPersonalized(false)}
                                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md transition-all ${emailPersonalized ? "text-zinc-400 hover:text-zinc-600" : "bg-white text-zinc-800 shadow-sm"}`}
                              >General</button>
                              <button
                                onClick={() => setEmailPersonalized(true)}
                                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md transition-all ${emailPersonalized ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-400 hover:text-zinc-600"}`}
                              >Personalized</button>
                            </div>
                          )}

                          {/* Generate */}
                          <button
                            disabled={ct.key === "BLOG" && generatingBlog}
                            onClick={async () => {
                              const token = await import("@/lib/auth-client").then(m => m.getAgentToken());
                              const agentBase = "/api";
                              if (!token) return;

                              if (ct.key === "IMAGE") {
                                fetch(`${agentBase}/agents/image/invoke`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                                  body: JSON.stringify({ campaign_id: campaignId, creative_id: creative.id, variants: 1 }),
                                }).catch(() => {});
                                router.push(`/preview/image?campaignId=${campaignId}&creativeId=${creative.id}`);
                              } else if (ct.key === "VIDEO") {
                                router.push(`/preview/video?campaignId=${campaignId}&creativeId=${creative.id}&generate=true`);
                              } else if (ct.key === "EMAIL") {
                                const emailTypeMessage = emailPersonalized
                                  ? "EMAIL_TYPE: PERSONALIZED — insert merge tags {{first_name}}, {{last_name}} verbatim as raw template placeholders. Do NOT replace them with sample names."
                                  : "EMAIL_TYPE: GENERAL — no merge tags, use real values everywhere.";
                                fetch(`${agentBase}/agents/email/invoke`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                                  body: JSON.stringify({ campaign_id: campaignId, creative_id: creative.id, message: emailTypeMessage }),
                                }).catch(() => {});
                                router.push(`/preview/email?campaignId=${campaignId}&creativeId=${creative.id}`);
                              } else if (ct.key === "BLOG") {
                                setGeneratingBlog(true);
                                try {
                                  const createRes = await fetch(`/api/campaigns/${campaignId}/creatives`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ type: "BLOG", promptType: "GUIDED" }),
                                  });
                                  if (!createRes.ok) throw new Error("Failed to create BLOG creative");
                                  const createData = await createRes.json();
                                  const blogCreativeId = createData.creative?.id ?? createData.id ?? creative.id;
                                  router.push(`/preview/blog?campaignId=${campaignId}&creativeId=${blogCreativeId}`);
                                } catch {
                                  alert("Failed to start blog generation. Please try again.");
                                  setGeneratingBlog(false);
                                }
                              }
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#4CAF31] text-white text-sm font-bold rounded-xl hover:bg-[#3d8e27] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {ct.key === "BLOG" && generatingBlog
                              ? <><Loader2 size={14} className="animate-spin" /> Starting...</>
                              : <><ArrowRight size={14} /> Generate</>
                            }
                          </button>
                        </div>
                      </div>
                    )}

                    {/* No creative yet */}
                    {isOpen && !creative && !loading && (
                      <div className="px-7 pb-7 border-t border-zinc-50 pt-5">
                        <p className="text-sm text-zinc-400 italic">
                          No creative record found. Run the campaign strategist first to generate briefs.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="h-20 bg-white border-t border-zinc-100 flex items-center justify-between px-12 mt-auto">
          <button
            onClick={() => router.push(campaignId ? `/plan?campaignId=${campaignId}&fromDesign=true` : "/campaigns")}
            className="px-8 py-2.5 border border-zinc-200 rounded-md text-sm font-bold text-zinc-500 bg-[#F9FBFA] hover:bg-zinc-50 transition-colors"
          >
            ← Back to Plan
          </button>
          <button
            onClick={() => router.push(campaignId ? `/campaigns/${campaignId}` : "/dashboard")}
            className="px-10 py-2.5 bg-[#4CAF31] rounded-md text-sm font-bold text-white hover:bg-[#3d8e27] shadow-sm transition-all"
          >
            Go to Campaign →
          </button>
        </footer>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, onClick }: { readonly icon: React.ReactNode; readonly label: string; readonly active?: boolean; readonly onClick?: () => void }) {
  const className = `flex items-center gap-3 px-3 py-2.5 rounded-md transition-all
        ${active ? "bg-[#F0F9F6] text-[#4CAF31] border-r-4 border-[#4CAF31] rounded-r-none" : "text-zinc-500 hover:bg-zinc-50"}`;
  const content = (
    <>
      <span className={active ? "text-[#4CAF31]" : "text-zinc-400"}>{icon}</span>
      <span className="text-[13px] font-semibold">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`w-full text-left ${className}`}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

function StepItem({ label, status }: { readonly label: string; readonly status: "completed" | "active" | "pending" }) {
  let indicatorClass = "bg-white border-4 border-zinc-100";
  if (status === "completed") {
    indicatorClass = "bg-[#4CAF31]";
  } else if (status === "active") {
    indicatorClass = "bg-white border-4 border-[#C8E6C9]";
  }
  const activeDotClass = status === "active" ? "bg-[#4CAF31]" : "bg-zinc-200";

  return (
    <div className="flex flex-col items-center gap-2 relative bg-[#FDFDFD] px-8">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 z-10 ${indicatorClass}`}>
        {status === "completed"
          ? <Check size={16} className="text-white" />
          : <div className={`w-2 h-2 rounded-full ${activeDotClass}`} />
        }
      </div>
      <span className={`text-sm font-bold ${status === "pending" ? "text-zinc-400" : "text-zinc-900"}`}>{label}</span>
    </div>
  );
}
