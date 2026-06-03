"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Redirects unauthenticated users to /sign-in.
 * Returns { session, isPending, isAuthenticated, isReady }
 * 
 * Usage pattern — call at top of component, check isReady before rendering:
 *   const { isPending, isAuthenticated } = useAuthGuard();
 *   // ... all other hooks ...
 *   if (isPending) return <Spinner />;
 *   if (!isAuthenticated) return null;
 */
export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const session = authClient.useSession();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Skip auth check in mock mode
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      setHasChecked(true);
      return;
    }

    // Wait for session to load
    if (session.isPending) {
      return;
    }

    setHasChecked(true);

    // If no session data, redirect to sign-in with return URL
    if (session.data) {
      console.log("[useAuthGuard] Session found:", session.data.user?.email);
    } else {
      console.log("[useAuthGuard] No session found, redirecting to sign-in");
      console.log("[useAuthGuard] Current path:", pathname);
      
      // Store the intended destination
      const returnUrl = encodeURIComponent(pathname + (globalThis.window ? globalThis.window.location.search : ''));
      router.replace(`/sign-in?returnUrl=${returnUrl}`);
    }
  }, [session.isPending, session.data, router, pathname]);

  return {
    session,
    isPending: session.isPending || !hasChecked,
    isAuthenticated: !!session.data || process.env.NEXT_PUBLIC_USE_MOCK === "true",
  };
}
