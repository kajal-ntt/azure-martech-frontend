"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Home, LayoutGrid, ShoppingBag, Send,
    Loader2, RotateCcw, Download, ImageIcon, Video,
} from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function CreativesDashboard() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
            <CreativesDashboardContent />
        </Suspense>
    );
}

function CreativesDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const campaignId = searchParams.get("campaignId");
    const { isPending, isAuthenticated } = useAuthGuard();

    const [creatives, setCreatives] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchSignedUrl = useCallback(async (id: string): Promise<string | null> => {
        try {
            const res = await fetch(`/api/creatives/${id}/signed-url`);
            if (!res.ok) return null;
            const data = await res.json();
            return data.url ?? null;
        } catch { return null; }
    }, []);

    const loadCreatives = useCallback(async () => {
        if (!campaignId) return;
        try {
            const res = await fetch(`/api/campaigns/${campaignId}/creatives`);
            if (!res.ok) return;
            const data = await res.json();
            const list: any[] = data.creatives ?? [];
            const enriched = await Promise.all(list.map(async (c) => ({
                ...c,
                signedUrl: c.url ? await fetchSignedUrl(c.id) : null,
            })));
            setCreatives(enriched);
            const stillPending = enriched.some(c => !c.signedUrl && c.url);
            if (stillPending) pollRef.current = setTimeout(loadCreatives, 4000);
        } catch { }
        finally { setLoading(false); }
    }, [campaignId, fetchSignedUrl]);

    useEffect(() => {
        loadCreatives();
        return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    }, [loadCreatives]);

    if (isPending) return <div className="flex min-h-screen items-center justify-center"><div className="w-6 h-6 border-2 border-[#4CAF31] border-t-transparent rounded-full animate-spin" /></div>;
    if (!isAuthenticated && process.env.NEXT_PUBLIC_USE_MOCK !== "true") return null;

    const handleDownload = async (url: string, id: string, type: string) => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const ext = type === "VIDEO" ? "mp4" : "png";
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `creative-${id.slice(0, 8)}.${ext}`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch { alert("Download failed."); }
    };

    const DONE_STATUSES = new Set(["GENERATED", "UNDER_REVIEW", "APPROVED", "REJECTED"]);
    const images = creatives.filter(c => c.type === "IMAGE" && DONE_STATUSES.has(c.status));
    const videos = creatives.filter(c => c.type === "VIDEO" && DONE_STATUSES.has(c.status));

    return (
        <div className="flex min-h-screen bg-[#F9FAFB] font-sans text-zinc-900">
            {/* SIDEBAR */}
            <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col shrink-0">
                <Link href="/dashboard" className="p-6 text-left">
                    <div className="flex items-center gap-2 text-[#4CAF31] font-bold text-xl uppercase tracking-tighter">
                        MAR<span className="text-zinc-800">TECH</span>
                    </div>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1 leading-none">
                        Marketing . Technology . Solution.
                    </p>
                </Link>
                <nav className="flex-1 px-4 space-y-1">
                    <SidebarItem icon={<Home size={18} />} label="Home" onClick={() => router.push("/dashboard")} />
                    <SidebarItem icon={<ShoppingBag size={18} />} label="Subscribed Product" />
                    <SidebarItem icon={<LayoutGrid size={18} />} label="Marketplace" />
                    <SidebarItem icon={<Send size={18} />} label="Campaign Manager" active onClick={() => router.push("/campaigns")} />
                    <div className="ml-9 pt-1 border-l border-zinc-100 pl-4 space-y-1">
                        <div className="text-xs font-semibold text-[#4CAF31] bg-[#F0F9F6] px-2 py-1.5 rounded-md">Creatives</div>
                        <Link
                            href={`/creatives/image?campaignId=${campaignId}`}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1.5 rounded-md hover:bg-zinc-50"
                        >
                            <ImageIcon size={12} /> Image Creative
                        </Link>
                        <Link
                            href={`/creatives/video?campaignId=${campaignId}`}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1.5 rounded-md hover:bg-zinc-50"
                        >
                            <Video size={12} /> Video Creative
                        </Link>
                    </div>
                </nav>
            </aside>

            {/* MAIN */}
            <main className="flex-1 flex flex-col min-w-0">
                <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8">
                    <div className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                        <button onClick={() => router.push("/dashboard")} className="hover:text-zinc-900">Dashboard</button>
                        <span>&gt;</span>
                        <span className="text-zinc-500">Campaign Manager</span>
                        <span>&gt;</span>
                        <span className="text-zinc-900 font-bold">Creatives</span>
                    </div>
                    <button onClick={loadCreatives} className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
                        <RotateCcw size={12} /> Refresh
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-8 space-y-10">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="animate-spin text-[#4CAF31]" size={32} />
                        </div>
                    ) : (
                        <>
                            {/* Images section */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
                                        <ImageIcon size={16} className="text-[#4CAF31]" /> Generated Images
                                        <span className="text-xs font-normal text-zinc-400">({images.length})</span>
                                    </h2>
                                    <button
                                        onClick={() => router.push(`/creatives/image?campaignId=${campaignId}`)}
                                        className="text-xs font-bold text-[#4CAF31] hover:underline flex items-center gap-1"
                                    >
                                        <ImageIcon size={12} /> Generate New Images
                                    </button>
                                </div>
                                {images.length === 0 ? (
                                    <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-10 text-center">
                                        <p className="text-sm text-zinc-400 mb-3">No images generated yet</p>
                                        <button
                                            onClick={() => router.push(`/creatives/image?campaignId=${campaignId}`)}
                                            className="px-4 py-2 bg-[#4CAF31] text-white text-xs font-bold rounded-lg hover:bg-[#3d8e27]"
                                        >
                                            Generate Images
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {images.map(c => (
                                            <div key={c.id} className="group relative rounded-xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-md transition-shadow bg-white">
                                                {c.signedUrl ? (
                                                    <img src={c.signedUrl} alt="Creative" className="w-full aspect-[3/4] object-cover" />
                                                ) : (
                                                    <div className="w-full aspect-[3/4] bg-zinc-100 flex items-center justify-center">
                                                        <Loader2 size={20} className="animate-spin text-[#4CAF31]" />
                                                    </div>
                                                )}
                                                {c.signedUrl && (
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end justify-between p-3 opacity-0 group-hover:opacity-100">
                                                        <button
                                                            onClick={() => router.push(`/preview/image?campaignId=${campaignId}&creativeId=${c.id}`)}
                                                            className="text-[10px] font-bold text-white bg-[#4CAF31] px-2 py-1 rounded-lg"
                                                        >
                                                            Preview
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(c.signedUrl, c.id, c.type)}
                                                            className="p-1.5 bg-white/90 rounded-lg text-zinc-700 hover:bg-white"
                                                        >
                                                            <Download size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="px-2 py-1.5 border-t border-zinc-100">
                                                    <p className={`text-[10px] font-semibold ${c.status === "GENERATED" ? "text-[#4CAF31]" : "text-zinc-400"}`}>{c.status}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Videos section */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
                                        <Video size={16} className="text-[#4CAF31]" /> Generated Videos
                                        <span className="text-xs font-normal text-zinc-400">({videos.length})</span>
                                    </h2>
                                    <button
                                        onClick={() => router.push(`/creatives/video?campaignId=${campaignId}`)}
                                        className="text-xs font-bold text-[#4CAF31] hover:underline flex items-center gap-1"
                                    >
                                        <Video size={12} /> Generate New Video
                                    </button>
                                </div>
                                {videos.length === 0 ? (
                                    <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-10 text-center">
                                        <p className="text-sm text-zinc-400 mb-3">No videos generated yet</p>
                                        <button
                                            onClick={() => router.push(`/creatives/video?campaignId=${campaignId}`)}
                                            className="px-4 py-2 bg-[#4CAF31] text-white text-xs font-bold rounded-lg hover:bg-[#3d8e27]"
                                        >
                                            Generate Video
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {videos.map(c => (
                                            <div key={c.id} className="group relative rounded-xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-md transition-shadow bg-white">
                                                {c.signedUrl ? (
                                                    <video
                                                        src={c.signedUrl}
                                                        className="w-full aspect-video object-cover"
                                                        muted playsInline
                                                        preload="metadata"
                                                        onMouseEnter={e => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
                                                        onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                                                    />
                                                ) : (
                                                    <div className="w-full aspect-video bg-zinc-100 flex items-center justify-center">
                                                        <Loader2 size={20} className="animate-spin text-[#4CAF31]" />
                                                    </div>
                                                )}
                                                {c.signedUrl && (
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end justify-between p-3 opacity-0 group-hover:opacity-100">
                                                        <button
                                                            onClick={() => router.push(`/preview/video?campaignId=${campaignId}&creativeId=${c.id}`)}
                                                            className="text-[10px] font-bold text-white bg-[#4CAF31] px-2 py-1 rounded-lg"
                                                        >
                                                            Preview
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(c.signedUrl, c.id, c.type)}
                                                            className="p-1.5 bg-white/90 rounded-lg text-zinc-700 hover:bg-white"
                                                        >
                                                            <Download size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="px-2 py-1.5 border-t border-zinc-100">
                                                    <p className={`text-[10px] font-semibold ${c.status === "GENERATED" ? "text-[#4CAF31]" : "text-zinc-400"}`}>{c.status}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

function SidebarItem({ icon, label, active = false, onClick }: any) {
    const className = `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${active ? "bg-[#F0F9F6] text-[#4CAF31]" : "text-zinc-500 hover:bg-zinc-50"}`;

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={`w-full text-left ${className}`}>
                {icon}
                <span className="text-sm font-medium">{label}</span>
            </button>
        );
    }

    return (
        <div className={className}>
            {icon}
            <span className="text-sm font-medium">{label}</span>
        </div>
    );
}
