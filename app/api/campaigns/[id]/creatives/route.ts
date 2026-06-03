import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_CREATIVES, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) {
    const body = await req.json().catch(() => ({}));
    const newCreative = {
      ...MOCK_CREATIVES[0], ...body,
      id: `mock-creative-${Date.now()}`,
      campaignId: id,
      status: "PENDING",
      url: null,
      createdAt: new Date().toISOString(),
    };
    return NextResponse.json({ creative: newCreative }, { status: 201 });
  }

  const cookie = (await headers()).get("cookie") ?? "";
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const body = await req.text();

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/campaigns/${id}/creatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie, origin },
      body,
    });
    const text = await backendRes.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: backendRes.status });
    } catch {
      return NextResponse.json({ error: text }, { status: backendRes.status });
    }
  } catch (err) {
    console.error(`[proxy] POST /api/campaigns/${id}/creatives error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) {
    // Return mock creatives for any campaign ID — filter by exact match or fall back to all
    const creatives = MOCK_CREATIVES.filter(c => c.campaignId === id);
    return NextResponse.json({ creatives: creatives.length > 0 ? creatives : MOCK_CREATIVES });
  }

  const cookie = (await headers()).get("cookie") ?? "";
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/campaigns/${id}/creatives`, {
      method: "GET",
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
    console.error(`[proxy] GET /api/campaigns/${id}/creatives error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
