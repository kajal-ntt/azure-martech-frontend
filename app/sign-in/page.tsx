"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/dashboard";

  const handleLogin = async () => {
    setErrorMessage(null);
    setIsSigningIn(true);

    if (USE_DUMMY_DATA) {
      globalThis.location.href = returnUrl;
      return;
    }

    const result = await authClient.signIn(username, password);
    setIsSigningIn(false);

    if (result.error) {
      setErrorMessage(result.error.message);
      return;
    }

    router.push(returnUrl);
  };

  const authContent = (
    <div className="space-y-5">
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full rounded-xl border border-zinc-300 p-4"
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        className="w-full rounded-xl border border-zinc-300 p-4"
      />

      <button
        onClick={handleLogin}
        disabled={isSigningIn}
        className="h-14 w-full rounded-xl bg-[#4CAF31] text-white font-bold hover:bg-[#3d8e27] disabled:opacity-50"
      >
        {isSigningIn ? "Signing in..." : "Login"}
      </button>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-red-600 text-sm">
          {errorMessage}
        </div>
      )}
    </div>
  );

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
            <span>Powered by MARTECH</span>
          </div>
        </div>
      </section>
    </div>
  );
}
