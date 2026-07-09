
// 1 USD ≈ 94 INR (approximate rate)
const USD_TO_INR = 94;
const formatCost = (usd: number) => `₹${(usd * USD_TO_INR).toFixed(2)}`;
const FRIENDLY_NAMES: Record<string, string> = {
  image_agent: "Image Strategist Agent",
  video_agent: "Video Strategist Agent",
  email_agent: "Email Marketer Agent",
  blog_agent: "Blog Post Writer Agent",
  campaign_strategist: "Campaign Strategist Agent",
  brand_analyzer: "Brand Asset Analyzer Agent",
  image_generation: "AI Image Generation (Imagen)",
  video_generation: "AI Video Generation (Veo)",
  image_outpaint: "AI Image Canvas Extension (Outpaint)",
};

interface UsageSummary {
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: string | number;
  totalRecords: number;
  breakdown?: Record<string, { cost: string | number; inputTokens: number; outputTokens: number }>;
}

interface UsageSummaryCardProps {
  summary: UsageSummary;
}

export default function UsageSummaryCard({ summary }: UsageSummaryCardProps) {
  const costValue =
    typeof summary.totalCostUsd === "string"
      ? parseFloat(summary.totalCostUsd)
      : summary.totalCostUsd;

  const stats = [
    {
      label: "Total Records",
      value: summary.totalRecords.toLocaleString(),
      icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
      label: "Total Tokens",
      value: summary.totalTokens.toLocaleString(),
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
    },
    {
      label: "Input Tokens",
      value: summary.totalInputTokens.toLocaleString(),
      icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
    },
    {
      label: "Output Tokens",
      value: summary.totalOutputTokens.toLocaleString(),
      icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 4l-4 4m0 0l-4-4m4 4V4",
    },
    {
      label: "Estimated Cost",
      value: formatCost(costValue),
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400 mb-4">
        Summary
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0F9F6]">
                <svg
                  className="h-3.5 w-3.5 text-[#4CAF31]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d={stat.icon}
                  />
                </svg>
              </div>
              <span className="text-xs font-medium text-zinc-500">{stat.label}</span>
            </div>
            <span className="text-xl font-bold text-zinc-900">{stat.value}</span>
          </div>
        ))}
      </div>

      {summary.breakdown && Object.keys(summary.breakdown).length > 0 && (
        <div className="mt-8 border-t border-zinc-100 pt-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-4">
            Cost Breakdown by Activity
          </h3>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/50">
            <table className="min-w-full divide-y divide-zinc-200 text-xs">
              <thead className="bg-zinc-50">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold text-zinc-600">Activity / Agent</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold text-zinc-600">Input Tokens</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold text-zinc-600">Output Tokens</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold text-zinc-600">Cost (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {Object.entries(summary.breakdown).map(([agentName, details]) => {
                  const friendlyName = FRIENDLY_NAMES[agentName] ?? agentName;
                  const cost = typeof details.cost === "string" ? parseFloat(details.cost) : details.cost;
                  return (
                    <tr key={agentName} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-zinc-800">{friendlyName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                        {details.inputTokens > 0 ? details.inputTokens.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                        {details.outputTokens > 0 ? details.outputTokens.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-zinc-900">
                        {formatCost(cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
