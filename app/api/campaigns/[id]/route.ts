import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_CAMPAIGNS, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) {
    const campaign = MOCK_CAMPAIGNS.find(c => c.id === id) ?? MOCK_CAMPAIGNS[0];
    return NextResponse.json(campaign);
  }

  const cookie = (await headers()).get("cookie") ?? "";

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/campaigns/${id}`, {
      method: "GET",
      headers: { cookie },
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error(`[proxy] GET /api/campaigns/${id} error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) return NextResponse.json({ id, ...await req.json().catch(() => ({})) });

  const cookie = (await headers()).get("cookie") ?? "";
  const body = await req.text();

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/campaigns/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body,
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error(`[proxy] PUT /api/campaigns/${id} error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
