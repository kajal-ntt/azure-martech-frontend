import Link from "next/link";
import { headers } from "next/headers";
import { USE_DUMMY_DATA, dummySession } from "@/lib/dummy-data";

type SessionPayload = {
  user?: { name?: string | null; email?: string | null };
  session?: { expiresAt?: string | null };
} | null;

async function getSessionFromBackend(): Promise<SessionPayload> {
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
    return (await response.json()) as SessionPayload;
  } catch (err) {
    console.warn("Backend connection failed. Returning null session dummy.", err);
    return null;
  }
}

export default async function Home() {
  const session = await getSessionFromBackend();

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans selection:bg-[#4CAF31] selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-100 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#4CAF31]">
              MAR<span className="text-zinc-900">TECH</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            {session?.user ? (
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex h-9 items-center justify-center rounded-full bg-[#4CAF31] px-5 text-sm font-medium text-white transition-colors hover:bg-[#3d8e27]"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden bg-[#F0F9F6] py-24 sm:py-32">
          {/* Decorative Grid */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4CAF31 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

          <div className="container relative mx-auto px-6 text-center">
            <div className="mx-auto max-w-3xl">
              <span className="mb-4 inline-block rounded-full bg-[#4CAF31]/10 px-4 py-1.5 text-sm font-medium text-[#4CAF31]">
                Enterprise Marketing Solution
              </span>
              <h1 className="mb-8 text-5xl font-extrabold tracking-tight text-zinc-900 sm:text-7xl">
                Amplify Your Reach. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4CAF31] to-emerald-400">
                  Simplify Your Workflow.
                </span>
              </h1>
              <p className="mb-10 text-lg leading-relaxed text-zinc-600 sm:text-xl">
                The all-in-one platform to design, schedule, and analyze your marketing efforts.
                Built for teams who want to move fast and deliver impact.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {session?.user ? (
                  <Link
                    href="/dashboard"
                    className="group inline-flex h-14 items-center justify-center rounded-full bg-[#4CAF31] px-8 text-base font-bold text-white transition-all hover:bg-[#3d8e27] hover:scale-105 active:scale-95"
                  >
                    Open Dashboard
                    <svg className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/sign-in"
                      className="group inline-flex h-14 items-center justify-center rounded-full bg-[#4CAF31] px-8 text-base font-bold text-white transition-all hover:bg-[#3d8e27] hover:scale-105 active:scale-95"
                    >
                      Get Started Free
                      <svg className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                    {/* <Link
                      href="#"
                      className="inline-flex h-14 items-center justify-center rounded-full border border-zinc-200 bg-white px-8 text-base font-bold text-zinc-900 transition-colors hover:bg-zinc-50"
                    >
                      Book a Demo
                    </Link> */}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features Preview
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">Everything you need to scale</h2>
              <p className="mt-4 text-zinc-600">Powerful tools neatly organized in one intuitive interface.</p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "Unified Dashboard", desc: "Manage all your channels from a single place without switching tabs." },
                { title: "AI-Powered Insights", desc: "Get smart recommendations to optimize your posting schedule." },
                { title: "Team Collaboration", desc: "Review and approve content seamlessly with your entire team." }
              ].map((feature, idx) => (
                <div key={idx} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-8 transition-colors hover:border-[#4CAF31]/30 hover:bg-[#F0F9F6]/50">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-zinc-100">
                    <svg className="h-6 w-6 text-[#4CAF31]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-zinc-900">{feature.title}</h3>
                  <p className="text-zinc-600">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section> */}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-zinc-50 py-12">
        <div className="container mx-auto px-6 text-center text-sm text-zinc-500">
          <p>© {new Date().getFullYear()} MarTech Enterprise. All rights reserved.</p>
          <p className="mt-2">Built with Next.js and Better Auth.</p>
        </div>
      </footer>
    </div>
  );
}
