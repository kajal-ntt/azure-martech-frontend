import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/app/dashboard/sign-out-button";
import BrandAvatar from "@/components/BrandAvatar";
import UsageSummaryCard from "@/components/usage/UsageSummaryCard";
import AgentTraceTable, { AgentTrace } from "@/components/usage/AgentTraceTable";
import UsageFilters from "@/components/usage/UsageFilters";
import PaginationControls from "@/components/usage/PaginationControls";
import EmptyState from "@/components/usage/EmptyState";
import { USE_DUMMY_DATA, dummySession } from "@/lib/dummy-data";

type SessionPayload = {
  user: { id: string; name: string; email: string };
  session: { token: string; expiresAt: string };
};

interface AgentTracesResponse {
  success: boolean;
  traces: AgentTrace[];
  summary: {
    totalRecords: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCostUsd: string | number;
    breakdown?: Record<string, { cost: string | number; inputTokens: number; outputTokens: number }>;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

async function getSessionFromBackend(): Promise<SessionPayload | null> {
  const cookie = (await headers()).get("cookie") ?? "";

  if (USE_DUMMY_DATA) {
    return dummySession;
  }

  const authURL = process.env.AUTH_BACKEND_URL?.replace(/\/$/, "");
  try {
    const response = await fetch(`${authURL}/api/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as SessionPayload | null;
  } catch (err) {
    console.warn("Backend connection failed. Returning null session.", err);
    return null;
  }
}

async function getAgentTraces(
  cookie: string,
  params: Record<string, string>
): Promise<AgentTracesResponse> {
  const backendURL = process.env.AUTH_BACKEND_URL?.replace(/\/$/, "");
  const url = new URL(`${backendURL}/api/agent-traces`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { cookie },
      cache: "no-store",
    });
    if (!res.ok) {
      return emptyResponse(Number(params.page ?? "1"));
    }
    return (await res.json()) as AgentTracesResponse;
  } catch {
    return emptyResponse(Number(params.page ?? "1"));
  }
}

function emptyResponse(page: number): AgentTracesResponse {
  return {
    success: true,
    traces: [],
    summary: {
      totalRecords: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCostUsd: "0",
      breakdown: {},
    },
    pagination: { page, pageSize: 20, totalPages: 0 },
  };
}

const navItems = [
  {
    name: "Overview",
    href: "/dashboard",
    active: false,
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    name: "Usage",
    href: "/dashboard/usage",
    active: true,
    icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
];

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function UsageDashboardPage({ searchParams }: PageProps) {
  const session = await getSessionFromBackend();
  if (!session) redirect("/sign-in");

  const resolvedParams = await searchParams;
  const page = Math.max(1, Number(resolvedParams.page ?? "1"));
  const filterParams: Record<string, string> = {
    page: String(page),
    pageSize: "20",
  };
  if (resolvedParams.campaignId) filterParams.campaignId = resolvedParams.campaignId;
  if (resolvedParams.creativeId) filterParams.creativeId = resolvedParams.creativeId;
  if (resolvedParams.startDate) filterParams.startDate = resolvedParams.startDate;
  if (resolvedParams.endDate) filterParams.endDate = resolvedParams.endDate;

  const cookie = (await headers()).get("cookie") ?? "";
  const data = await getAgentTraces(cookie, filterParams);

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : session.user.email.substring(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans text-zinc-900 overflow-x-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="fixed bottom-0 left-0 top-0 hidden w-64 flex-col border-r border-zinc-200 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <Link href="/" className="text-xl font-bold text-[#4CAF31]">
            MAR<span className="text-zinc-900">TECH</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                item.active
                  ? "bg-[#F0F9F6] text-[#2d6b1d]"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <svg
                className={`h-5 w-5 shrink-0 ${item.active ? "text-[#4CAF31]" : "text-zinc-400"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={item.icon}
                />
              </svg>
              {item.name}
            </Link>
          ))}
          <Link
            href="/brands"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <svg
              className="h-5 w-5 shrink-0 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            Brand Settings
          </Link>
        </nav>

        <div className="border-t border-zinc-200 p-4">
          <SignOutButton />
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 md:ml-64 overflow-x-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-sm sm:px-8">
          <h1 className="text-lg font-bold text-zinc-900 sm:text-xl">Usage</h1>
          <div className="flex items-center gap-3">
            <button className="text-zinc-400 hover:text-zinc-600" aria-label="Notifications">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="hidden text-right text-sm sm:block">
                <div className="font-medium text-zinc-900">{session.user.name || "User"}</div>
                <div className="text-xs text-zinc-500">{session.user.email}</div>
              </div>
              <BrandAvatar fallback={initials} />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 sm:p-8 space-y-6">
          <div>
            <p className="text-zinc-500 text-sm">
              Monitor token usage and estimated costs across all your agent invocations.
            </p>
          </div>

          {/* Summary card */}
          <UsageSummaryCard summary={data.summary} />

          {/* Filters (client component) */}
          <UsageFilters />

          {/* Table or empty state */}
          {data.traces.length === 0 ? (
            <EmptyState />
          ) : (
            <AgentTraceTable traces={data.traces} />
          )}

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <PaginationControls
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
            />
          )}
        </div>
      </main>
    </div>
  );
}
