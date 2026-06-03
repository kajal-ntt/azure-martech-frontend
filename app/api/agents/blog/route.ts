import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const AGENT_URL = (process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://localhost:8001/api/v1").replace("localhost", "127.0.0.1");

/**
 * POST /api/agents/blog
 * Proxies to the agent backend's /blog/invoke endpoint.
 * Forwards the Authorization header from the client.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const authHeader = (await headers()).get("authorization") ?? "";

  try {
    const res = await fetch(`${AGENT_URL}/agents/blog/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body,
    });

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status });
    } catch {
      return NextResponse.json({ error: text }, { status: res.status });
    }
  } catch (err) {
    console.error("[proxy] POST /api/agents/blog error:", err);
    return NextResponse.json({ error: "Failed to reach agent backend" }, { status: 502 });
  }
}
