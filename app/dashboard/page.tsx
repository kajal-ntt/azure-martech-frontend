import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/app/dashboard/sign-out-button";
import { USE_DUMMY_DATA, dummySession } from "@/lib/dummy-data";
import CampaignDashboard from "@/app/dashboard/campaign-dashboard";
import CreativeGallery from "@/app/dashboard/creative-gallery";
import BrandAvatar from "@/components/BrandAvatar";

type SessionPayload = {
  user: { id: string; name: string; email: string };
  session: { token: string; expiresAt: string };
};

async function getSessionFromBackend(): Promise<SessionPayload | null> {
  const cookie = (await headers()).get("cookie") ?? "";

  if (USE_DUMMY_DATA) {
    return dummySession;
  }

  const authURL = (process.env.AUTH_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
  try {
    const response = await fetch(`${authURL}/api/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as SessionPayload | null;
  } catch (err) {
    console.warn("Backend connection failed. Returning null session dummy.", err);
    return null;
  }
}


const stats = [
  { label: "Total Campaigns", value: "12", delta: "+3 this month", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" },
  { label: "Active Brands", value: "4", delta: "+1 this month", icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { label: "Total Reach", value: "106K", delta: "+18% vs last month", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { label: "AI Assets Generated", value: "348", delta: "+52 this week", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
];


const navItems = [
  { name: "Overview", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", active: true },
  { name: "Usage", href: "/dashboard/usage", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", active: false },
];


export default async function DashboardPage() {
  const session = await getSessionFromBackend();
  if (!session) redirect("/sign-in");

  let needsRedirect = false;

  if (!USE_DUMMY_DATA) {
  // Verify if the user has completed brand onboarding
  const backendURL = (process.env.AUTH_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
  const cookieHeader = (await headers()).get("cookie") ?? "";
  try {
    const brandsRes = await fetch(`${backendURL}/api/brands`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (brandsRes.ok) {
      const brands = await brandsRes.json();
      if (!Array.isArray(brands) || brands.length === 0) {
        needsRedirect = true;
      }
    }
  } catch (err) {
    console.warn("Failed to check brands, allowing dashboard load:", err);
  }
  }

  if (needsRedirect) {
    redirect("/brands");
  }

  const initials = session.user.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)
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
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${item.active
                ? "bg-[#F0F9F6] text-[#2d6b1d]"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
            >
              <svg className={`h-5 w-5 shrink-0 ${item.active ? "text-[#4CAF31]" : "text-zinc-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
              </svg>
              {item.name}
            </Link>
          ))}
          <Link
            href="/brands"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <svg className="h-5 w-5 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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
          <h1 className="text-lg font-bold text-zinc-900 sm:text-xl">Overview</h1>

          <div className="flex items-center gap-3">

            {/* Notifications */}
            <button className="text-zinc-400 hover:text-zinc-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {/* Avatar */}
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
        <div className="p-4 sm:p-8 space-y-8">

          {/* Welcome + Primary CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="mt-1 text-zinc-500">Here&apos;s what&apos;s happening with your brands today.</p>
            </div>
            <Link
              href="/campaigns"
              className="flex w-fit items-center gap-2 rounded-xl bg-[#4CAF31] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#4CAF31]/20 hover:bg-[#3d8e27] transition-all hover:scale-[1.02] active:scale-100"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create Campaign
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">{stat.label}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9F6]">
                    <svg className="h-4 w-4 text-[#4CAF31]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-zinc-900">{stat.value}</div>
                <div className="mt-1 text-xs font-medium text-[#4CAF31]">{stat.delta}</div>
              </div>
            ))}
          </div>

          {/* Campaign Dashboard */}
          <CreativeGallery />
          <CampaignDashboard />

        </div>
      </main>
    </div>
  );
}
