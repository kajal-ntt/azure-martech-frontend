"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
console.log("API_URL:", API_URL);

type SessionUser = { username: string; name: string; email?: string };
type SessionState = { user: SessionUser } | null;

async function fetchSession(): Promise<SessionState> {
  try {
    const res = await fetch(`${API_URL}/api/auth/session`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.authenticated ? { user: body.user } : null;
  } catch {
    return null;
  }
}

export const authClient = {
  useSession() {
    const [data, setData] = useState<SessionState>(null);
    const [isPending, setIsPending] = useState(true);

    useEffect(() => {
      let cancelled = false;
      fetchSession().then((session) => {
        if (!cancelled) {
          setData(session);
          setIsPending(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []);

    return { data, isPending };
  },

  async signIn(username: string, password: string) {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        return { error: { message: body?.message ?? "Invalid username or password." } };
      }
      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message ?? "Sign in failed. Please try again." } };
    }
  },

  async signOut() {
    try {
      const res = await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return { error: { message: "Sign out failed." } };
      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message ?? "Sign out failed." } };
    }
  },
};

export async function getAgentToken(): Promise<string | null> {
  // No real JWT minting anymore — just a placeholder so brands/page.tsx
  // and campaigns/page.tsx don't throw before reaching the agents proxy.
  return "dummy-agent-token";
}