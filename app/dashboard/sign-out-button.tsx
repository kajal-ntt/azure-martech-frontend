"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { USE_DUMMY_DATA } from "@/lib/dummy-data";

export function SignOutButton() {
  const [isPending, setIsPending] = useState(false);

  return (
    <button
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        try {
          if (USE_DUMMY_DATA) {
            document.cookie = "dummy_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            globalThis.location.href = "/";
            return;
          }
          const res = await authClient.signOut();
          if (res.error) {
            console.error("Sign out error", res.error);
            alert("Error signing out: " + (res.error.message || "Unknown error"));
          } else {
            globalThis.location.href = "/sign-in";
          }
        } finally {
          setIsPending(false);
        }
      }}
      type="button"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Sign out
    </button>
  );
}
