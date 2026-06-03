import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Disable Next.js route caching and static optimisation — required for streaming
export const dynamic = "force-dynamic";

const AGENT_URL = (process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://localhost:8001/api/v1").replace("localhost", "127.0.0.1");

/**
 * POST /api/agents/video
 *
 * Proxies the NDJSON streaming response from the Python agent backend.
 *
 * WHY TransformStream:
 * Next.js App Router buffers the entire body of `new NextResponse(readableStream)`
 * before sending it to the browser, which defeats streaming entirely.
 * Piping through a TransformStream forces the runtime to flush each chunk
 * as it arrives from the upstream fetch, giving the browser real-time progress.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const authHeader = (await headers()).get("authorization") ?? "";

  try {
    const upstream = await fetch(`${AGENT_URL}/agents/video/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body,
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "Unknown error");
      return NextResponse.json({ error: text }, { status: upstream.status });
    }

    // Pipe through a TransformStream so each NDJSON line is flushed immediately
    const { readable, writable } = new TransformStream();
    upstream.body.pipeTo(writable).catch(() => {});

    return new NextResponse(readable, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[proxy] POST /api/agents/video error:", err);
    return NextResponse.json({ error: "Failed to reach agent backend" }, { status: 502 });
  }
}
