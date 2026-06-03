"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight } from "lucide-react";

type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

const STATUS_META: Record<CampaignStatus, { label: string; color: string; bg: string; border: string }> = {
    DRAFT:     { label: "Draft",     color: "text-zinc-600",  bg: "bg-zinc-100",   border: "border-zinc-200" },
    ACTIVE:    { label: "Active",    color: "text-[#2d6b1d]", bg: "bg-[#F0F9F6]",  border: "border-[#c6eacc]" },
    PAUSED:    { label: "Paused",    color: "text-amber-700", bg: "bg-amber-50",    border: "border-amber-200" },
    COMPLETED: { label: "Completed", color: "text-blue-700",  bg: "bg-blue-50",     border: "border-blue-200" },
    CANCELLED: { label: "Cancelled", color: "text-red-600",   bg: "bg-red-50",      border: "border-red-200" },
};

const FILTERS: { label: string; value: CampaignStatus | "ALL" }[] = [
    { label: "All",       value: "ALL" },
    { label: "Draft",     value: "DRAFT" },
    { label: "Active",    value: "ACTIVE" },
    { label: "Paused",    value: "PAUSED" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Cancelled", value: "CANCELLED" },
];

export default function CampaignDashboard() {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<CampaignStatus | "ALL">("ALL");

    useEffect(() => {
        fetch("/api/campaigns")
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => {
                const list = data.campaigns ?? data ?? [];
                setCampaigns(Array.isArray(list) ? list : []);
            })
            .catch(() => setCampaigns([]))
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === "ALL"
        ? campaigns
        : campaigns.filter(c => c.status === filter);

    let tableContent: React.ReactNode;
    if (loading) {
        tableContent = (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[#4CAF31]" />
            </div>
        );
    } else if (filtered.length === 0) {
        tableContent = (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                <p className="text-sm font-medium">No campaigns found</p>
                <button
                    onClick={() => router.push("/campaigns")}
                    className="mt-3 text-xs font-bold text-[#4CAF31] hover:underline"
                >
                    Create your first campaign →
                </button>
            </div>
        );
    } else {
        tableContent = (
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
                            <th className="text-left px-6 py-3">Campaign</th>
                            <th className="text-left px-4 py-3">Status</th>
                            <th className="text-left px-4 py-3">Channels</th>
                            <th className="text-left px-4 py-3">Budget</th>
                            <th className="text-left px-4 py-3">Dates</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {filtered.map(c => {
                            const meta = STATUS_META[c.status as CampaignStatus] ?? STATUS_META.DRAFT;
                            return (
                                <tr
                                    key={c.id}
                                    onClick={() => router.push(`/campaigns/${c.id}`)}
                                    className="hover:bg-zinc-50/70 cursor-pointer transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-zinc-900 truncate max-w-[200px]">{c.name}</p>
                                        {c.category && (
                                            <p className="text-xs text-zinc-400 mt-0.5">{c.category}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.bg} ${meta.color} ${meta.border}`}>
                                            {meta.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="text-xs text-zinc-500 truncate max-w-[120px] block">
                                            {c.channels?.slice(0, 3).join(", ") || "—"}
                                            {c.channels?.length > 3 && ` +${c.channels.length - 3}`}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-xs text-zinc-600 font-medium">
                                        {c.budget ? `${c.currency || "USD"} ${c.budget.toLocaleString()}` : "—"}
                                    </td>
                                    <td className="px-4 py-4 text-xs text-zinc-500">
                                        {c.startDate
                                            ? new Date(c.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
                                            : "—"}
                                    </td>
                                    <td className="px-4 py-4">
                                        <ChevronRight size={16} className="text-zinc-300" />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <h2 className="text-base font-bold text-zinc-900">Campaigns</h2>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 px-6 pt-3 pb-1 border-b border-zinc-100 overflow-x-auto">
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                            filter === f.value
                                ? "bg-zinc-900 text-white"
                                : "text-zinc-500 hover:bg-zinc-100"
                        }`}
                    >
                        {f.label}
                        {f.value !== "ALL" && (
                            <span className="ml-1.5 opacity-60">
                                {campaigns.filter(c => c.status === f.value).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {tableContent}
        </div>
    );
}
