"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
//import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { USE_DUMMY_DATA } from "@/lib/dummy-data";

const FEATURE_ITEMS = [
  "Unified Social Media Dashboard",
  "Smart AI Post Suggestions",
  "Engagement Analytics",
  "One-click Publishing",
];

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  // const session = authClient.useSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/dashboard";

  // const userLabel = useMemo(() => {
  //   const user = session.data?.user;
  //   if (!user) return null;
  //   return user.email || user.name || "Signed in";
  // }, [session.data?.user]);

  const handleMicrosoftSignIn = async () => {
    setErrorMessage(null);
    setIsSigningIn(true);

    if (USE_DUMMY_DATA) {
      globalThis.location.href = returnUrl;
      return;
    }

    try {
      const result = await authClient.signIn.social({
        provider: "microsoft",
        callbackURL: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${returnUrl}`,
      });
      if (result?.error) {
        console.error("[sign-in] Microsoft OAuth error:", result.error);
        
        // Handle rate limiting specifically
        if (result.error.status === 429) {
          setErrorMessage(
            "Too many sign-in attempts. Please wait a few minutes before trying again. " +
            "This is a temporary rate limit from Microsoft OAuth to prevent abuse."
          );
        } else {
          setErrorMessage(
            `${result.error.message ?? "Sign in failed"} — ${result.error.status ?? ""} ${result.error.code ?? ""}`
          );
        }
      }
    } catch (err: any) {
      console.error("[sign-in] Exception:", err);
      setErrorMessage(err?.message ?? "Sign in failed. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  let authContent: ReactNode;
  if (session.isPending) {
    authContent = (
      <div className="text-center p-10 border rounded-2xl border-dashed">
        <p className="text-zinc-500 animate-pulse">Checking session...</p>
      </div>
    );
  } else if (session.data?.user) {
    authContent = (
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6">
        <p className="text-sm text-zinc-600">
          Signed in as <span className="font-bold text-zinc-900">{userLabel}</span>
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={returnUrl}
            className="flex h-12 items-center justify-center rounded-xl bg-[#4CAF31] font-bold text-white hover:bg-[#3d8e27] transition-colors"
          >
            Go to Dashboard
          </Link>
          <button
            onClick={async () => {
              const res = await authClient.signOut();
              if (res.error) {
                console.error("Sign out error", res.error);
                alert("Error signing out: " + res.error.message);
              } else {
                globalThis.location.href = "/sign-in";
              }
            }}
            className="text-sm text-zinc-400 hover:text-red-500 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  } else {
    authContent = (
      <div className="space-y-6">
        <button
          onClick={handleMicrosoftSignIn}
          disabled={isSigningIn}
          className="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#4CAF31] px-6 font-bold text-white transition-all hover:bg-[#3d8e27] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#4CAF31]"
        >
          {isSigningIn ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            </>
          ) : (
            <>
              Continue with Microsoft
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        {errorMessage && (
          <div className="rounded-lg bg-red-50 p-4 text-xs text-red-600 border border-red-100 space-y-2">
            <p className="font-semibold">Authentication Error</p>
            <p>{errorMessage}</p>
            {errorMessage.includes("rate limit") ? (
              <div className="mt-3 pt-3 border-t border-red-200 text-[11px] space-y-1">
                <p className="font-semibold">Why did this happen?</p>
                <ul className="list-disc list-inside space-y-0.5 text-red-500">
                  <li>Multiple sign-in attempts in a short time</li>
                  <li>Microsoft OAuth has temporary rate limits</li>
                </ul>
                <p className="mt-2 font-semibold">What to do:</p>
                <ul className="list-disc list-inside space-y-0.5 text-red-500">
                  <li>Wait 2-5 minutes before trying again</li>
                  <li>Clear your browser cache and cookies</li>
                  <li>Try using incognito/private mode</li>
                </ul>
              </div>
            ) : (
              <button
                onClick={handleMicrosoftSignIn}
                disabled={isSigningIn}
                className="text-xs font-bold text-red-600 underline hover:text-red-800 disabled:opacity-50"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row font-sans bg-white">
      {/* Left Section: Branding & Features */}
      <section className="relative hidden w-full flex-col justify-center bg-[#F0F9F6] p-12 md:flex md:w-1/2 lg:p-20 overflow-hidden">
        <div className="mb-8 z-10">
          <h2 className="text-4xl font-bold text-[#4CAF31]">
            MAR<span className="text-[#333]">TECH</span>
          </h2>
          <p className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">
            Marketing . Technology . Solution.
          </p>
        </div>

        <div className="max-w-md z-10">
          <h1 className="mb-6 text-6xl font-extrabold tracking-tight text-zinc-900 leading-[1.1]">
            Create. Publish. <br /> Grow.
          </h1>
          <p className="mb-10 text-lg text-zinc-600">
            Log in to design, schedule, and manage impactful content across
            every channel — all from one smart workspace.
          </p>

          <ul className="space-y-4">
            {FEATURE_ITEMS.map((text) => (
              <li key={text} className="flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-sm w-fit border border-zinc-100">
                <svg className="h-5 w-5 text-[#4CAF31]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-zinc-700">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Decorative Grid */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4CAF31 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>
      </section>

      {/* Right Section: Login Card */}
      <section className="flex w-full items-center justify-center p-8 md:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-zinc-900">Login to Design Smart</h2>
            <p className="mt-2 text-zinc-500">Simplify Content Creation and Management</p>
          </div>

          {authContent}

          <div className="mt-12 pt-8 border-t border-zinc-100 flex justify-between items-center text-xs text-zinc-400">
            <Link href="/" className="hover:text-zinc-900 transition-colors">← Back home</Link>
            <span>Powered by Better Auth</span>
          </div>
        </div>
      </section>
    </div>
  );
}
