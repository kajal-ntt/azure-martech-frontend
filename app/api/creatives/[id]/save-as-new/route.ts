import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_CREATIVES, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) return NextResponse.json({ ...MOCK_CREATIVES[0], id: `mock-creative-${Date.now()}` }, { status: 201 });

  const cookie = (await headers()).get("cookie") ?? "";
  const contentType = req.headers.get("content-type") ?? "application/octet-stream";

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/creatives/${id}/save-as-new`, {
      method: "POST",
      headers: { "content-type": contentType, cookie },
      body: req.body,
      // @ts-expect-error - duplex needed for streaming
      duplex: "half",
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error(`[proxy] POST /api/creatives/${id}/save-as-new error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
