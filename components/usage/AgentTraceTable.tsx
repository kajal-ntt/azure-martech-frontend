
// 1 USD ≈ 94 INR
const USD_TO_INR = 94;
const formatCost = (usd: number) => `₹${(usd * USD_TO_INR).toFixed(2)}`;

export interface AgentTrace {
  id: string;
  agentName: string;
  campaignId?: string | null;
  creativeId?: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCostUsd: string | number;
  status: string;
  errorMessage?: string | null;
  executionTimeMs: number;
  createdAt: string;
  brandId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface AgentTraceTableProps {
  traces: AgentTrace[];
}

function StatusBadge({ status }: { status: string }) {
  const isSuccess = status === "success";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isSuccess
          ? "bg-green-50 text-green-700 ring-1 ring-green-600/20"
          : "bg-red-50 text-red-700 ring-1 ring-red-600/20"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isSuccess ? "bg-green-500" : "bg-red-500"}`}
        aria-hidden="true"
      />
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function truncateId(id: string | null | undefined) {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export default function AgentTraceTable({ traces }: AgentTraceTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            {[
              "Date / Time",
              "Agent Name",
              "Campaign ID",
              "Creative Type",
              "Input Tokens",
              "Output Tokens",
              "Total Cost (INR)",
              "Status",
            ].map((col) => (
              <th
                key={col}
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {traces.map((trace) => {
            const cost =
              typeof trace.totalCostUsd === "string"
                ? parseFloat(trace.totalCostUsd)
                : trace.totalCostUsd;

            // Derive creative type from agent name (most reliable) or metadata fallback
            const AGENT_TYPE_MAP: Record<string, string> = {
              image_agent: "Image",
              video_agent: "Video",
              email_agent: "Email",
              blog_agent:  "Blog",
            };
            const creativeType =
              AGENT_TYPE_MAP[trace.agentName] ??
              (trace.metadata as Record<string, unknown> | null)?.creativeType as string | undefined;

            return (
              <tr key={trace.id} className="hover:bg-zinc-50 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                  {formatDate(trace.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900">
                  {trace.agentName}
                </td>
                <td
                  className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500"
                  title={trace.campaignId ?? undefined}
                >
                  {truncateId(trace.campaignId)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                  {creativeType ?? (trace.creativeId ? "—" : "—")}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-zinc-700">
                  {trace.inputTokens.toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-zinc-700">
                  {trace.outputTokens.toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-zinc-700">
                  {formatCost(cost)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={trace.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
