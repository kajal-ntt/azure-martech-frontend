"use client";

import React, { Suspense, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Home, ShoppingCart, LayoutGrid, Megaphone,
  BarChart3, Loader2, Download, Copy, Check,
  ArrowLeft, RefreshCw,
} from "lucide-react";
import BrandAvatar from "@/components/BrandAvatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { getAgentToken } from "@/lib/auth-client";
import AgentUsageBadge from "@/components/usage/AgentUsageBadge";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BlogData {
  title: string;
  content_markdown: string;
  summary: string;
  tags: string[];
  notes?: string;
}

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MarkdownLink({ href, children }: any) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function MarkdownImage({ src, alt }: any) {
  if (!src || typeof src !== "string") return null;

  let proxiedSrc = src;
  if (src.startsWith("gs://")) {
    const httpsUrl = src.replace("gs://", "https://storage.googleapis.com/");
    proxiedSrc = `/api/image-proxy?url=${encodeURIComponent(httpsUrl)}`;
    console.log(`[blog-preview] Proxying gs:// URL: ${src} -> ${proxiedSrc}`);
  } else if (src.startsWith("https://storage.googleapis.com/") || src.startsWith("https://storage.cloud.google.com/")) {
    proxiedSrc = `/api/image-proxy?url=${encodeURIComponent(src)}`;
    console.log(`[blog-preview] Proxying GCS HTTPS URL: ${src}`);
  } else {
    console.log(`[blog-preview] Using direct URL: ${src}`);
  }

  return (
    <img
      src={proxiedSrc}
      alt={alt ?? ""}
      className="rounded-xl shadow-md my-4 max-w-full"
      onError={(e) => {
        console.error(`[blog-preview] Failed to load image: ${src} (proxied: ${proxiedSrc})`);
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

const MARKDOWN_COMPONENTS = {
  a: MarkdownLink,
  img: MarkdownImage,
};

// ─── Page component ───────────────────────────────────────────────────────────
export default function BlogPreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <BlogPreviewContent />
    </Suspense>
  );
}

function BlogPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const creativeId = searchParams.get("creativeId");
  const { isPending, isAuthenticated } = useAuthGuard();

  const [blog, setBlog] = useState<BlogData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cancelledRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const [agentUsage, setAgentUsage] = useState<{
    totalTokens: number; inputTokens: number; outputTokens: number; executionTimeMs: number;
  } | null>(null);

  // ── Fetch existing blog creative ──────────────────────────────────────────
  const fetchBlogCreative = useCallback(async () => {
    if (!creativeId) return;
    try {
      const res = await fetch(`/api/creatives/${creativeId}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const creative = json.creative ?? json;

      // Blog content is stored in the creative's metadata or url field
      if (creative.blogData) {
        setBlog(creative.blogData);
        return;
      }

      // Try to parse from metadata
      if (creative.metadata?.blog) {
        setBlog(creative.metadata.blog);
        return;
      }

      // If the creative has a url pointing to a .md file, fetch it via proxy
      if (creative.url && creative.status === "GENERATED") {
        try {
          // The agent saves markdown to GCS at gs://[bucket]/[campaign_id]/creatives/blogs/[creative_id].md
          // Convert gs:// to https://storage.googleapis.com/ then route through the backend proxy
          // (direct browser fetches to GCS fail due to CORS + auth)
          const publicUrl = creative.url.startsWith("gs://")
            ? creative.url.replace("gs://", "https://storage.googleapis.com/")
            : creative.url;

          const proxied = `/api/image-proxy?url=${encodeURIComponent(publicUrl)}`;
          const dataRes = await fetch(proxied, { cache: "no-store" });
          if (dataRes.ok) {
            const markdown = await dataRes.text();
            // Extract title from headlines, summary from adCopy (as per agent's save pattern)
            setBlog({
              title: creative.headlines?.[0] ?? "Blog Post",
              content_markdown: markdown,
              summary: creative.adCopy ?? "",
              tags: creative.tags ?? [],
              notes: creative.notes,
            });
            return;
          }
        } catch (err) {
          console.error("[blog-preview] Failed to fetch markdown via proxy:", err);
        }
      }
    } catch (err) {
      console.error("[blog-preview] fetchBlogCreative error:", err);
    }
  }, [creativeId]);

  // ── Generate blog ─────────────────────────────────────────────────────────
  const generateBlog = useCallback(async () => {
    if (!campaignId || !creativeId) return;
    setGenerating(true);
    setError(null);
    setBlog(null);

    try {
      const token = await getAgentToken();
      const res = await fetch("/api/agents/blog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          creative_id: creativeId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail ?? errData.error ?? `Agent returned ${res.status}`);
      }

      const result = await res.json();
      // Response schema: { status: "success", execution_time: 15.42, data: { status, campaign_id, creative_id, title, content_markdown, summary, tags, notes } }
      const data = result.data ?? result;

      // Capture token usage if present
      if (result.usage) {
        setAgentUsage({
          totalTokens: result.usage.totalTokens ?? 0,
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
          executionTimeMs: result.usage.executionTimeMs ?? 0,
        });
      }

      if (data.content_markdown) {
        // Agent has already:
        // 1. Generated the markdown blog post
        // 2. Uploaded it to GCS at gs://[bucket]/[campaign_id]/creatives/blogs/[creative_id].md
        // 3. Updated the creative record with url, status=GENERATED, headlines=[title], adCopy=summary
        setBlog({
          title: data.title ?? "Blog Post",
          content_markdown: data.content_markdown,
          summary: data.summary ?? "",
          tags: data.tags ?? [],
          notes: data.notes,
        });
      } else if (data.text) {
        // Fallback: agent returned plain text
        setBlog({
          title: "Blog Post",
          content_markdown: data.text,
          summary: "",
          tags: [],
        });
      } else {
        throw new Error("No blog content returned from agent.");
      }
    } catch (err: any) {
      console.error("[blog-preview] generateBlog error:", err);
      setError(err.message ?? "Failed to generate blog post.");
    } finally {
      setGenerating(false);
    }
  }, [campaignId, creativeId]);

  // ── On mount: try to load existing, then auto-generate if empty ───────────
  useEffect(() => {
    // Prevent duplicate initialization
    if (hasInitializedRef.current) return;
    
    cancelledRef.current = false;

    const init = async () => {
      if (!creativeId) return;
      
      hasInitializedRef.current = true;
      
      // Try to load existing blog data first
      try {
        const res = await fetch(`/api/creatives/${creativeId}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const creative = json.creative ?? json;
          
          // Check if blog already generated (status=GENERATED and has url)
          if (creative.status === "GENERATED" && creative.url) {
            await fetchBlogCreative();
            return;
          }
          
          // Check mock data structure
          if (creative.blogData?.content_markdown) {
            setBlog(creative.blogData);
            return;
          }
          if (creative.metadata?.blog?.content_markdown) {
            setBlog(creative.metadata.blog);
            return;
          }
        }
      } catch { /* ignore */ }

      // Auto-generate on first load if not already generated
      generateBlog();
    };

    init();

    return () => {
      cancelledRef.current = true;
    };
  }, [creativeId]); // Removed generateBlog and fetchBlogCreative from dependencies

  // ── Copy markdown ─────────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!blog) return;
    await navigator.clipboard.writeText(blog.content_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Download markdown ─────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!blog) return;
    const blob = new Blob([blog.content_markdown], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `blog-${(blog.title ?? "post").toLowerCase().replaceAll(/\s+/g, "-").slice(0, 40)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

  const isReady = !!blog && !generating;

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
                  Blog Preview
                </div>
              </div>
              <NavItem icon={<BarChart3 size={18} />} label="Analytics & Reports" />
            </div>
          </div>
        </nav>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Header */}
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
            <span className="text-zinc-800 font-bold">Blog Preview</span>
          </div>
          <BrandAvatar size="sm" />
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-8 pb-32">

          {/* Title row */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Blog Post</h1>
            <div className="flex items-center gap-3">
              {agentUsage && (
                <AgentUsageBadge
                  totalTokens={agentUsage.totalTokens}
                  inputTokens={agentUsage.inputTokens}
                  outputTokens={agentUsage.outputTokens}
                  executionTimeMs={agentUsage.executionTimeMs}
                />
              )}
              {isReady && (
                <button
                  onClick={() => { setAgentUsage(null); generateBlog(); }}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all shadow-sm disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  Regenerate
                </button>
              )}
            </div>
          </div>

          {/* ── Generating skeleton ──────────────────────────────────────── */}
          {generating && (
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-10 flex flex-col items-center gap-4">
              <div className="w-full space-y-3 max-w-2xl mx-auto">
                <div className="animate-pulse bg-zinc-200 rounded h-6 w-2/3" />
                <div className="animate-pulse bg-zinc-200 rounded h-4 w-full mt-4" />
                <div className="animate-pulse bg-zinc-200 rounded h-4 w-5/6" />
                <div className="animate-pulse bg-zinc-200 rounded h-4 w-full" />
                <div className="animate-pulse bg-zinc-200 rounded h-4 w-4/5" />
                <div className="animate-pulse bg-zinc-200 rounded h-4 w-full mt-4" />
                <div className="animate-pulse bg-zinc-200 rounded h-4 w-3/4" />
                <div className="animate-pulse bg-zinc-200 rounded h-4 w-full" />
              </div>
              <div className="flex flex-col items-center gap-2 mt-4">
                <Loader2 size={28} className="animate-spin text-[#4CAF31]" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Generating Blog Post...
                </p>
              </div>
            </div>
          )}

          {/* ── Error state ──────────────────────────────────────────────── */}
          {error && !generating && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center gap-3">
              <p className="text-sm font-semibold text-red-600">{error}</p>
              <button
                onClick={generateBlog}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#4CAF31] rounded-xl hover:bg-[#3d8e27] transition-colors"
              >
                <RefreshCw size={14} />
                Try Again
              </button>
            </div>
          )}

          {/* ── Blog content ─────────────────────────────────────────────── */}
          {isReady && (
            <div className="space-y-6">
              {/* Meta: tags + summary */}
              {(blog.tags.length > 0 || blog.summary) && (
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-3">
                  {blog.summary && (
                    <p className="text-sm text-zinc-600 leading-relaxed italic">{blog.summary}</p>
                  )}
                  {blog.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {blog.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-0.5 text-xs font-semibold bg-[#F0F9F6] text-[#2d6b1d] rounded-full border border-[#c6eacc]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {blog.notes && (
                    <p className="text-xs text-zinc-400 border-t border-zinc-100 pt-3">{blog.notes}</p>
                  )}
                </div>
              )}

              {/* Rendered markdown */}
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-zinc-100 bg-zinc-50/50">
                  <h2 className="text-xl font-bold text-zinc-900">{blog.title}</h2>
                </div>
                <div
                  className="px-8 py-6 prose prose-zinc prose-sm max-w-none
                    prose-headings:font-bold prose-headings:text-zinc-900
                    prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                    prose-p:text-zinc-700 prose-p:leading-relaxed
                    prose-a:text-[#4CAF31] prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-zinc-900
                    prose-code:bg-zinc-100 prose-code:px-1 prose-code:rounded prose-code:text-sm
                    prose-blockquote:border-l-4 prose-blockquote:border-[#4CAF31] prose-blockquote:pl-4 prose-blockquote:text-zinc-500
                    prose-ul:list-disc prose-ol:list-decimal
                    prose-img:rounded-xl prose-img:shadow-md prose-img:my-4
                    prose-hr:border-zinc-200"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={MARKDOWN_COMPONENTS}
                  >
                    {blog.content_markdown}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── STICKY BOTTOM BAR ─────────────────────────────────────────── */}
        <footer className="h-24 border-t border-zinc-200 bg-white/80 backdrop-blur-md sticky bottom-0 z-20 flex items-center justify-between px-12">

          {/* Left: status */}
          <div className="flex items-center gap-3">
            {generating && (
              <>
                <Loader2 size={18} className="animate-spin text-[#4CAF31]" />
                <span className="text-sm font-semibold text-zinc-500">Generating Blog Post...</span>
              </>
            )}
            {isReady && (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-[#4CAF31] inline-block" />
                <span className="text-sm font-semibold text-zinc-700">Blog Post Generated</span>
              </>
            )}
            {error && !generating && (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
                <span className="text-sm font-semibold text-red-500">Generation Failed</span>
              </>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(campaignId ? `/campaigns/${campaignId}` : "/dashboard")}
              className="px-6 py-3 border border-zinc-200 bg-white text-zinc-700 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-all flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to Campaign
            </button>

            <button
              onClick={handleCopy}
              disabled={!isReady}
              className="px-6 py-3 border border-zinc-200 bg-white text-zinc-700 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? <Check size={16} className="text-[#4CAF31]" /> : <Copy size={16} />}
              {copied ? "Copied!" : "Copy Markdown"}
            </button>

            <button
              onClick={handleDownload}
              disabled={!isReady}
              className="px-8 py-3.5 bg-[#4CAF31] text-white rounded-2xl font-bold text-sm hover:bg-[#3d8e27] transition-all shadow-xl shadow-[#4CAF31]/30 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              Download .md
            </button>
          </div>
        </footer>
      </main>
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
