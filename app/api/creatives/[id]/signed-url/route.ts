import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_CREATIVES, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) {
    const creative = MOCK_CREATIVES.find(c => c.id === id) ?? MOCK_CREATIVES[0];
    return NextResponse.json({ url: creative.url, status: creative.status });
  }

  const cookie = (await headers()).get("cookie") ?? "";
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/creatives/${id}/signed-url`, {
      headers: { cookie },
    });

    const text = await backendRes.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: backendRes.status });
    } catch {
      return NextResponse.json({ error: text }, { status: backendRes.status });
    }
  } catch (err) {
    console.error("[proxy] GET /api/creatives/signed-url error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
