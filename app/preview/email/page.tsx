"use client";

import React, { Suspense, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Home, ShoppingCart, LayoutGrid, Megaphone,
  BarChart3, Loader2, Download, Monitor, Smartphone,
} from "lucide-react";
import BrandAvatar from "@/components/BrandAvatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import AgentUsageBadge from "@/components/usage/AgentUsageBadge";

const EmailEditorPanel = dynamic(
  () => import("@/components/email/EmailEditorPanel"),
  { ssr: false }
);

// ─── Polling constants ────────────────────────────────────────────────────────
const BASE_INTERVAL = 3000;
const MAX_INTERVAL = 10000;
const MAX_POLLS = 60;

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmailCreative {
  id: string;
  type: "EMAIL";
  status: "PENDING" | "GENERATING" | "GENERATED" | "FAILED";
  url: string | null;        // HTML template GCS URL
  textUrl: string | null;    // Plain-text template GCS URL
  subjectLine: string | null;
  preheader: string | null;
  campaignId: string;
  createdAt: string;
  metadata?: {
    subject_line?: string;
    preheader?: string;
    [key: string]: unknown;
  };
}

interface PollStatus {
  isDone: boolean;
  isFailed: boolean;
  hitMax: boolean;
  shouldUseRecentUrl: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toProxiedUrl(url: string): string {
  // Azure blob — proxy as-is
  if (url.includes("blob.core.windows.net")) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  const publicUrl = url.startsWith("gs://")
    ? url.replace("gs://", "https://storage.googleapis.com/")
    : url;
  return `/api/image-proxy?url=${encodeURIComponent(publicUrl)}`;
}

function getSubjectLine(creative: EmailCreative): string {
  
    return (
    creative.subjectLine ??
    (creative as any).headline ??
    creative.metadata?.subject_line ??
    ""
  );
}

function getPreheader(creative: EmailCreative): string {
  return creative.preheader ?? creative.metadata?.preheader ?? "";
}

function replaceUnknownPreviewTokens(value: string): string {
  let result = "";
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf("{{", cursor);
    if (start === -1) return result + value.slice(cursor);

    const end = value.indexOf("}}", start + 2);
    if (end === -1) return result + value.slice(cursor);

    result += value.slice(cursor, start) + "[preview]";
    cursor = end + 2;
  }

  return result;
}

/** Replace remaining {{placeholder}} tokens with preview values for rendering.
 * Static brand values (brand_name, address) are substituted server-side by the agent.
 * This only handles per-recipient merge tags that are intentionally left in the template. */
function substitutePlaceholders(html: string, brandName: string): string {
  const previewHtml = html
    .replaceAll("{{first_name}}", "Alex")
    .replaceAll("{{last_name}}", "Johnson")
    .replaceAll("{{email}}", "alex@example.com")
    .replaceAll("{{unsubscribe_url}}", "#unsubscribe")
    .replaceAll("{{cta_url}}", "#")
    .replaceAll("{{year}}", new Date().getFullYear().toString())
    // Fallback for any brand tokens the agent missed
    .replaceAll("{{brand_name}}", brandName || "Our Brand")
    .replaceAll("{{company_name}}", brandName || "Our Brand");

  return replaceUnknownPreviewTokens(previewHtml);
}

/**
 * Rewrite all <img src> and CSS url() references that point to GCS so they
 * are served through the local /api/image-proxy endpoint.  This is necessary
 * because the sandboxed iframe renders HTML verbatim — direct GCS URLs are
 * blocked by CORS / auth and the logo would be invisible otherwise.
 */
function proxyImagesInHtml(html: string): string {
  // Match src="..." and src='...' attributes whose value is a GCS URL
  return html.replaceAll(
    /(src=["'])(gs:\/\/[^"']+|https:\/\/storage\.googleapis\.com\/[^"']+)(["'])/gi,
    (_match, prefix, url, suffix) => {
      // Normalise gs:// → https://storage.googleapis.com/
      const publicUrl = url.startsWith("gs://")
        ? url.replace("gs://", "https://storage.googleapis.com/")
        : url;
      return `${prefix}/api/image-proxy?url=${encodeURIComponent(publicUrl)}${suffix}`;
    }
  );
}

function getPollStatus(data: EmailCreative | null, pollCount: number): PollStatus {
  const isDone = data?.status === "GENERATED";
  const wasRecentlyUpdated = Boolean(
    data?.createdAt && (Date.now() - new Date(data.createdAt).getTime()) < 120000
  );

  return {
    isDone,
    isFailed: data?.status === "FAILED",
    hitMax: pollCount >= MAX_POLLS,
    shouldUseRecentUrl: !isDone && wasRecentlyUpdated && Boolean(data?.url),
  };
}

function getTextTemplateUrl(data: EmailCreative): string {
  if (data.textUrl) return data.textUrl;
  return data.url!.replace(/\.html$/, ".txt");
}

async function fetchCampaignEmailCreatives(campaignId: string, creativeId: string): Promise<EmailCreative[]> {
  const response = await fetch(`/api/campaigns/${campaignId}/creatives`, { cache: "no-store" });
  if (!response.ok) return [];

  const data = await response.json();
  const all: EmailCreative[] = data.creatives ?? [];
  return all.filter(
    (creative: any) => creative.type === "EMAIL" && creative.id !== creativeId && creative.status === "GENERATED" && creative.url
  );
}

function getPollingDelay(count: number): number {
  return count < 10
    ? BASE_INTERVAL
    : Math.min(BASE_INTERVAL * (count - 10 + 1), MAX_INTERVAL);
}

function downloadContent(
  activeTab: "html" | "text",
  textContent: string | null,
  htmlContent: string | null,
  creativeId: string | null
) {
  if (activeTab === "text" && textContent) {
    const blob = new Blob([textContent], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `email-text-${creativeId?.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (htmlContent && creativeId) {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `email-${creativeId.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

function AuthLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function SubjectPreheaderBar({
  isReady,
  activeTab,
  subjectLine,
  preheader,
}: Readonly<{
  isReady: boolean;
  activeTab: "html" | "text";
  subjectLine: string;
  preheader: string;
}>) {
  if (!isReady || activeTab !== "html" || (!subjectLine && !preheader)) return null;

  return (
    <div className="mb-6 bg-white border border-zinc-200 rounded-2xl px-6 py-4 shadow-sm">
      {subjectLine && (
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest w-20 shrink-0">
            Subject
          </span>
          <span className="text-sm font-semibold text-zinc-800">{subjectLine}</span>
        </div>
      )}
      {preheader && (
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest w-20 shrink-0">
            Preheader
          </span>
          <span className="text-sm text-zinc-500">{preheader}</span>
        </div>
      )}
    </div>
  );
}

function EmailPreviewToggles({
  isReady,
  hasTextTemplate,
  activeTab,
  previewMode,
  setActiveTab,
  setPreviewMode,
}: Readonly<{
  isReady: boolean;
  hasTextTemplate: boolean;
  activeTab: "html" | "text";
  previewMode: "desktop" | "mobile";
  setActiveTab: (tab: "html" | "text") => void;
  setPreviewMode: (mode: "desktop" | "mobile") => void;
}>) {
  return (
    <div className="flex items-center gap-3">
      {isReady && hasTextTemplate && (
        <div className="flex bg-white rounded-xl p-1 border border-zinc-200 shadow-sm">
          <button
            onClick={() => setActiveTab("html")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "html" ? "bg-[#4CAF31] text-white shadow-md" : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            HTML Email
          </button>
          <button
            onClick={() => setActiveTab("text")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "text" ? "bg-[#4CAF31] text-white shadow-md" : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Text Template
          </button>
        </div>
      )}

      {(!isReady || activeTab === "html") && (
        <div className="flex bg-white rounded-xl p-1 border border-zinc-200 shadow-sm">
          <button
            onClick={() => setPreviewMode("desktop")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              previewMode === "desktop" ? "bg-[#4CAF31] text-white shadow-md" : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <Monitor size={14} />
            Desktop
          </button>
          <button
            onClick={() => setPreviewMode("mobile")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              previewMode === "mobile" ? "bg-[#4CAF31] text-white shadow-md" : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <Smartphone size={14} />
            Mobile
          </button>
        </div>
      )}
    </div>
  );
}

function EmailPreviewFrame({
  isPolling,
  loadingHtml,
  isFailed,
  error,
  isReady,
  activeTab,
  htmlContent,
  textContent,
  iframeWidth,
  onBack,
}: Readonly<{
  isPolling: boolean;
  loadingHtml: boolean;
  isFailed: boolean;
  error: string | null;
  isReady: boolean;
  activeTab: "html" | "text";
  htmlContent: string | null;
  textContent: string | null;
  iframeWidth: number;
  onBack: () => void;
}>) {
  if ((isPolling || loadingHtml) && !isFailed) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden flex flex-col items-center justify-center gap-4" style={{ width: iframeWidth, height: 600 }}>
        <div className="w-full px-8 space-y-3">
          <div className="animate-pulse bg-zinc-200 rounded h-4 w-3/4 mx-auto" />
          <div className="animate-pulse bg-zinc-200 rounded h-4 w-full" />
          <div className="animate-pulse bg-zinc-200 rounded h-4 w-5/6 mx-auto" />
          <div className="animate-pulse bg-zinc-200 rounded h-32 w-full mt-4" />
          <div className="animate-pulse bg-zinc-200 rounded h-4 w-full" />
          <div className="animate-pulse bg-zinc-200 rounded h-4 w-4/5 mx-auto" />
          <div className="animate-pulse bg-zinc-200 rounded h-4 w-full" />
          <div className="animate-pulse bg-zinc-200 rounded h-4 w-2/3 mx-auto" />
        </div>
        <div className="flex flex-col items-center gap-2 mt-2">
          <Loader2 size={28} className="animate-spin text-[#4CAF31]" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            Generating Email...
          </p>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl shadow-xl flex flex-col items-center justify-center gap-3" style={{ width: iframeWidth, height: 600 }}>
        <p className="text-sm font-semibold text-red-500">Email generation failed.</p>
        <button onClick={onBack} className="text-xs text-zinc-500 underline hover:text-zinc-700">
          Back to Campaign
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl shadow-xl flex flex-col items-center justify-center gap-3" style={{ width: iframeWidth, height: 600 }}>
        <p className="text-sm font-semibold text-red-500">{error}</p>
      </div>
    );
  }

  if (!isReady) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden" style={{ width: iframeWidth }}>
    {htmlContent ? (
        <iframe
          title="Email Preview"
          sandbox="allow-same-origin allow-scripts"
          srcDoc={htmlContent ?? ""}
          style={{ width: "100%", height: 600, border: "none", display: "block", overflowY: "auto" }}
        />
      ) : (
        <div className="p-6 font-mono text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap overflow-y-auto bg-zinc-50" style={{ height: 600 }}>
          <div className="mb-4 pb-3 border-b border-zinc-200 flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Plain Text / WhatsApp Template
            </span>
          </div>
          {textContent}
        </div>
      )}
    </div>
  );
}

function FooterStatus({
  isPolling,
  isReady,
  isFailed,
}: Readonly<{
  isPolling: boolean;
  isReady: boolean;
  isFailed: boolean;
}>) {
  if (isPolling && !isFailed) {
    return (
      <>
        <Loader2 size={18} className="animate-spin text-[#4CAF31]" />
        <span className="text-sm font-semibold text-zinc-500">Generating Email...</span>
      </>
    );
  }

  if (isReady) {
    return (
      <>
        <span className="h-2.5 w-2.5 rounded-full bg-[#4CAF31] inline-block" />
        <span className="text-sm font-semibold text-zinc-700">Email Generated</span>
      </>
    );
  }

  if (isFailed) {
    return (
      <>
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
        <span className="text-sm font-semibold text-red-500">Generation Failed</span>
      </>
    );
  }

  return null;
}

// ─── Page component ───────────────────────────────────────────────────────────
export default function EmailPreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <EmailPreviewContent />
    </Suspense>
  );
}

function EmailPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const creativeId = searchParams.get("creativeId");
  const { isPending, isAuthenticated } = useAuthGuard();

  // Creative state
  const [creative, setCreative] = useState<EmailCreative | null>(null);
  const [pastEmails, setPastEmails] = useState<EmailCreative[]>([]);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"html" | "text">("html");
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentUsage, setAgentUsage] = useState<{
    totalTokens: number; inputTokens: number; outputTokens: number; executionTimeMs: number;
  } | null>(null);
  const brandNameRef = useRef<string>("");

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);

  // Preview mode: desktop (600px) or mobile (375px)
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const iframeWidth = previewMode === "desktop" ? 600 : 375;

  // Ref to track polling cancellation
  const cancelledRef = useRef(false);
  const pollCountRef = useRef(0);

  // ── Fetch brand name for placeholder substitution ─────────────────────────
  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/campaigns/${campaignId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const camp = data?.campaign ?? data;
        const name = camp?.brand?.name ?? camp?.brandName ?? "";
        if (name) {
          brandNameRef.current = name;
          // Re-substitute if HTML already loaded
          setHtmlContent(prev => prev ? substitutePlaceholders(prev, name) : prev);
        }
      })
      .catch(() => {});
  }, [campaignId]);

  // ── Fetch HTML via proxy ──────────────────────────────────────────────────
  const fetchHtml = useCallback(async (url: string) => {
    setLoadingHtml(true);
    try {
      const proxied = toProxiedUrl(url);
      const res = await fetch(proxied, { cache: "no-store" });
      if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
      const text = await res.text();
      const proxiedHtml = proxyImagesInHtml(text);
      setHtmlContent(substitutePlaceholders(proxiedHtml, brandNameRef.current));
    } catch (err) {
      console.error("[email-preview] fetchHtml error:", err);
      setError("Failed to load email HTML.");
    } finally {
      setLoadingHtml(false);
    }
  }, []);

  // ── Fetch plain-text template via proxy ───────────────────────────────────
  const fetchText = useCallback(async (url: string) => {
    try {
      const proxied = toProxiedUrl(url);
      const res = await fetch(proxied, { cache: "no-store" });
      if (!res.ok) return;
      const text = await res.text();
      setTextContent(text);
    } catch {
      // Non-fatal — text template is optional
    }
  }, []);

  // ── Fetch creative record ─────────────────────────────────────────────────
  const fetchCreative = useCallback(async (): Promise<EmailCreative | null> => {
    if (!creativeId) return null;
    try {
      const res = await fetch(`/api/creatives/${creativeId}`, { cache: "no-store" });
      if (!res.ok) return null;
      const json = await res.json();
      // Backend wraps in { success, creative } — unwrap if needed
      const data: EmailCreative = json.creative ?? json;
      setCreative(data);

      // Also fetch all EMAIL creatives for this campaign to populate past sidebar
      if (campaignId) {
        fetchCampaignEmailCreatives(campaignId, creativeId)
          .then(setPastEmails)
          .catch(() => {});
      }

      return data;
    } catch (err) {
      console.error("[email-preview] fetchCreative error:", err);
      return null;
    }
  }, [creativeId, campaignId]);

  // ── Polling effect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!creativeId) return;
    // Reset content when switching creatives
    setHtmlContent(null);
    setTextContent(null);
    setActiveTab("html");
    setError(null);
    cancelledRef.current = false;
    pollCountRef.current = 0;

    const poll = async () => {
      if (cancelledRef.current) return;

      const data = await fetchCreative();
      pollCountRef.current += 1;
      const { isDone, isFailed, hitMax, shouldUseRecentUrl } = getPollStatus(data, pollCountRef.current);

     if (isDone && data) {
  // ✅ If HTML URL exists → use iframe
  if (data.url) {
    fetchHtml(data.url);
    fetchText(getTextTemplateUrl(data));
  } 
  // ✅ ELSE fallback to adCopy (YOUR CASE)
  else if ((data as any).adCopy) {
    setHtmlContent(null);
    setTextContent((data as any).adCopy);
  }

  return;
}
      if (isFailed || hitMax) return;

      setTimeout(poll, getPollingDelay(pollCountRef.current));
    };

    poll();

    return () => {
      cancelledRef.current = true;
    };
  }, [campaignId, creativeId, fetchCreative, fetchHtml, fetchText]);

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = () => downloadContent(activeTab, textContent, htmlContent, creativeId);

  // ── Handle editor save ────────────────────────────────────────────────────
  const handleEditorSave = useCallback(async (html: string) => {
    if (!creativeId || !campaignId) throw new Error("Missing creative or campaign ID");

    const blob = new Blob([html], { type: "text/html" });
    const formData = new FormData();
    formData.append("image", blob, "email-edited.html");

    const res = await fetch(`/api/creatives/${creativeId}/save-as-new`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Save failed with status ${res.status}`);
    }

    const response = await res.json();
    
    // Backend returns { success: true, creative: {...} }
    const newCreative = response.creative ?? response;
    
    if (!newCreative?.id) {
      throw new Error("No creative ID returned from server");
    }
    
    // Close editor before redirecting for better UX
    setEditorOpen(false);
    
    router.push(`/preview/email?campaignId=${campaignId}&creativeId=${newCreative.id}`);
  }, [creativeId, campaignId, router]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isPolling =
    creative === null ||
    creative.status === "PENDING" ||
    creative.status === "GENERATING";

  const isFailed = creative?.status === "FAILED";
  const isReady = creative?.status === "GENERATED";  const hasTextTemplate = textContent !== null;

  const subjectLine = creative ? getSubjectLine(creative) : "";
  const preheader = creative ? getPreheader(creative) : "";

  const goBackToCampaign = () => router.push(campaignId ? `/campaigns/${campaignId}` : "/dashboard");

  if (isPending) return <AuthLoadingState />;
  if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans text-zinc-900">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
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
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 px-2">
              Overview
            </h3>
            <div className="space-y-1">
              <NavItem icon={<Home size={18} />} label="Home" onClick={() => router.push("/dashboard")} />
              <NavItem icon={<ShoppingCart size={18} />} label="Subscribed Product" />
              <NavItem icon={<LayoutGrid size={18} />} label="Marketplace" />
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 px-2">
              Martech
            </h3>
            <div className="space-y-1">
              <NavItem
                icon={<Megaphone size={18} />}
                label="Campaign Manager"
                active
                onClick={() => router.push(campaignId ? `/campaigns/${campaignId}` : "/dashboard")}
              />
              <div className="ml-4 border-l border-zinc-100 mt-1">
                <div className="py-2 px-6 text-sm font-semibold text-[#4CAF31] bg-[#F1F8F1] rounded-r-md border-r-4 border-[#4CAF31]">
                  Email Preview
                </div>
              </div>
              <NavItem icon={<BarChart3 size={18} />} label="Analytics & Reports" />
            </div>
          </div>
        </nav>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Header / breadcrumb */}
        <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-8 bg-white sticky top-0 z-20">
          <div className="text-sm flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Dashboard
            </button>
            <span className="text-zinc-300">&gt;</span>
            <button
              onClick={() => router.push(campaignId ? `/campaigns/${campaignId}` : "/dashboard")}
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Campaign Manager
            </button>
            <span className="text-zinc-300">&gt;</span>
            <span className="text-zinc-800 font-bold">Email Preview</span>
          </div>
          <BrandAvatar size="sm" />
        </header>

        {/* Flex row wrapper for split layout */}
        <div className="flex flex-1 min-w-0 transition-all duration-300">
          
          {/* Preview area — compresses when editor is open */}
          <div className={`flex flex-col transition-all duration-300 ${
            editorOpen ? "w-[40%]" : "w-full"
          }`}>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-8 pb-32">

          <SubjectPreheaderBar
            isReady={isReady}
            activeTab={activeTab}
            subjectLine={subjectLine}
            preheader={preheader}
          />

          {/* Page title + toggles */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Email Preview</h1>

            <EmailPreviewToggles
              isReady={isReady}
              hasTextTemplate={hasTextTemplate}
              activeTab={activeTab}
              previewMode={previewMode}
              setActiveTab={setActiveTab}
              setPreviewMode={setPreviewMode}
            />
          </div>

          {/* ── iframe / skeleton area ─────────────────────────────────── */}
          <div className="flex justify-center">
            <EmailPreviewFrame
              isPolling={isPolling}
              loadingHtml={loadingHtml}
              isFailed={Boolean(isFailed)}
              error={error}
              isReady={isReady}
              activeTab={activeTab}
              htmlContent={htmlContent}
              textContent={textContent}
              iframeWidth={iframeWidth}
              onBack={goBackToCampaign}
            />
          </div>
        </div>
          </div>

          {/* Editor panel — slides in from right */}
          <div className={`transition-all duration-300 overflow-hidden h-full ${
            editorOpen ? "w-[60%]" : "w-0"
          }`}>
            {editorOpen && htmlContent && (
              <EmailEditorPanel
                htmlContent={htmlContent}
                onSave={handleEditorSave}
                onClose={() => setEditorOpen(false)}
              />
            )}
          </div>
        </div>

        {/* ── STICKY BOTTOM BAR ─────────────────────────────────────────── */}
        <footer className="h-24 border-t border-zinc-200 bg-white/80 backdrop-blur-md sticky bottom-0 z-20 flex items-center justify-between px-12">

          {/* Left: status indicator */}
          <div className="flex items-center gap-3">
            <FooterStatus isPolling={isPolling} isReady={isReady} isFailed={Boolean(isFailed)} />
            {agentUsage && isReady && (
              <AgentUsageBadge
                totalTokens={agentUsage.totalTokens}
                inputTokens={agentUsage.inputTokens}
                outputTokens={agentUsage.outputTokens}
                executionTimeMs={agentUsage.executionTimeMs}
              />
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={goBackToCampaign}
              className="px-6 py-3 border border-zinc-200 bg-white text-zinc-700 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-all"
            >
              Back to Campaign
            </button>

            {/* Edit Email button */}
            {isReady && (
              <button
                onClick={() => setEditorOpen(true)}
                className="px-6 py-3 border-2 border-[#4CAF31] bg-white text-[#4CAF31] rounded-2xl font-bold text-sm hover:bg-[#F1F8F1] transition-all"
              >
                Edit Email
              </button>
            )}

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={!isReady}
              className="px-8 py-3.5 bg-[#4CAF31] text-white rounded-2xl font-bold text-sm hover:bg-[#3d8e27] transition-all shadow-xl shadow-[#4CAF31]/30 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              {activeTab === "text" ? "Download Text" : "Download HTML"}
            </button>
          </div>
        </footer>
      </main>

      {/* RIGHT SIDEBAR — past emails */}
      {pastEmails.length > 0 && !editorOpen && (
        <aside className="w-56 border-l border-zinc-200 bg-white flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto">
          <div className="px-4 py-4 border-b border-zinc-100">
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Past Emails</h3>
          </div>
          <div className="flex flex-col gap-3 p-3">
            {pastEmails.map((c) => (
              <Link
                key={c.id}
                href={`/preview/email?campaignId=${campaignId}&creativeId=${c.id}`}
                className="group rounded-xl border border-zinc-200 hover:border-[#4CAF31] transition-all shadow-sm hover:shadow-md overflow-hidden"
              >
                <div className="bg-zinc-50 px-3 py-3 space-y-1">
                  <p className="text-[11px] font-bold text-zinc-700 truncate">
                    {(c as any).subjectLine ?? (c as any).headlines?.[0] ?? (c as any).adCopy?.slice(0, 40) ?? "Email"}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="px-3 py-2 bg-white border-t border-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold text-[#4CAF31]">View →</span>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

// ─── NavItem helper ───────────────────────────────────────────────────────────
function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly active?: boolean;
  readonly onClick?: () => void;
}) {
  const className = `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
    active
      ? "text-[#4CAF31] bg-[#F1F8F1]"
      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
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
