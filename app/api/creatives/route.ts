import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_CREATIVES, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  if (USE_MOCK) {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ ...MOCK_CREATIVES[0], ...body, id: `mock-creative-${Date.now()}` }, { status: 201 });
  }

  const cookie = (await headers()).get("cookie") ?? "";
  const body = await req.text();

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/creatives`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body,
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("[proxy] POST /api/creatives error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  if (USE_MOCK) {
    const list = campaignId ? MOCK_CREATIVES.filter(c => c.campaignId === campaignId) : MOCK_CREATIVES;
    return NextResponse.json(list.length ? list : MOCK_CREATIVES);
  }

  const cookie = (await headers()).get("cookie") ?? "";

  try {
    const url = campaignId 
      ? `${BACKEND_URL}/api/creatives?campaignId=${campaignId}`
      : `${BACKEND_URL}/api/creatives`;

    const backendRes = await fetch(url, {
      method: "GET",
      headers: { cookie },
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("[proxy] GET /api/creatives error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
