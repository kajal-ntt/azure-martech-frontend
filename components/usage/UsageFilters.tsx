"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface Campaign {
  id: string;
  name: string;
}

interface Creative {
  id: string;
  type?: string;
  campaignId?: string;
}

export default function UsageFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);

  const campaignId = searchParams.get("campaignId") ?? "";
  const creativeId = searchParams.get("creativeId") ?? "";
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";

  // Fetch campaigns on mount
  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => {
        // Backend returns { success: true, campaigns: [...] }
        const list = data?.campaigns ?? data;
        if (Array.isArray(list)) setCampaigns(list);
      })
      .catch(() => {});
  }, []);

  // Fetch creatives when campaign changes
  useEffect(() => {
    if (!campaignId) {
      setCreatives([]);
      return;
    }
    // Correct endpoint: /api/campaigns/:campaignId/creatives
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/creatives`)
      .then((r) => r.json())
      .then((data) => {
        // Backend returns { success: true, creatives: [...] }
        const list = data?.creatives ?? data;
        if (Array.isArray(list)) setCreatives(list);
      })
      .catch(() => {});
  }, [campaignId]);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      // Reset to page 1 whenever a filter changes
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-400">Filters</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Campaign filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-campaign" className="text-xs font-medium text-zinc-600">
            Campaign
          </label>
          <select
            id="filter-campaign"
            value={campaignId}
            onChange={(e) =>
              updateParams({ campaignId: e.target.value, creativeId: "" })
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#4CAF31] focus:outline-none focus:ring-1 focus:ring-[#4CAF31]"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Creative filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-creative" className="text-xs font-medium text-zinc-600">
            Creative
          </label>
          <select
            id="filter-creative"
            value={creativeId}
            onChange={(e) => updateParams({ creativeId: e.target.value })}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#4CAF31] focus:outline-none focus:ring-1 focus:ring-[#4CAF31]"
          >
            <option value="">All creatives</option>
            {creatives.map((c) => (
              <option key={c.id} value={c.id}>
                {c.type ? `${c.type} — ${c.id.slice(0, 8)}` : c.id.slice(0, 12)}
              </option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-start-date" className="text-xs font-medium text-zinc-600">
            Start Date
          </label>
          <input
            id="filter-start-date"
            type="date"
            value={startDate}
            onChange={(e) => updateParams({ startDate: e.target.value })}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#4CAF31] focus:outline-none focus:ring-1 focus:ring-[#4CAF31]"
          />
        </div>

        {/* End date */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-end-date" className="text-xs font-medium text-zinc-600">
            End Date
          </label>
          <input
            id="filter-end-date"
            type="date"
            value={endDate}
            onChange={(e) => updateParams({ endDate: e.target.value })}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#4CAF31] focus:outline-none focus:ring-1 focus:ring-[#4CAF31]"
          />
        </div>
      </div>

      {/* Clear filters */}
      {(campaignId || creativeId || startDate || endDate) && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() =>
              updateParams({
                campaignId: "",
                creativeId: "",
                startDate: "",
                endDate: "",
              })
            }
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
