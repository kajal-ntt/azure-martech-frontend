import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_CAMPAIGNS, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  if (USE_MOCK) {
    const body = await req.json().catch(() => ({}));
    const newCampaign = { ...MOCK_CAMPAIGNS[0], ...body, id: `mock-campaign-${Date.now()}`, createdAt: new Date().toISOString() };
    return NextResponse.json(newCampaign, { status: 201 });
  }

  const cookie = (await headers()).get("cookie") ?? "";
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const body = await req.text();

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/campaigns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        origin,
      },
      body,
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("[proxy] POST /api/campaigns error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  if (USE_MOCK) return NextResponse.json(MOCK_CAMPAIGNS);

  const cookie = (await headers()).get("cookie") ?? "";

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/campaigns`, {
      method: "GET",
      headers: { cookie },
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("[proxy] GET /api/campaigns error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
