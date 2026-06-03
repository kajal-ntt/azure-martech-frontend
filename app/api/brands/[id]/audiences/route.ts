import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_AUDIENCES, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) return NextResponse.json({ ...MOCK_AUDIENCES[0], id: `mock-audience-${Date.now()}`, brandId: id }, { status: 201 });

  const cookie = (await headers()).get("cookie") ?? "";
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const body = await req.text();

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/brands/${id}/audiences`, {
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
    console.error(`[proxy] POST /api/brands/${id}/audiences error:`, err);
    return NextResponse.json(
      { error: "Failed to reach backend" },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) return NextResponse.json(MOCK_AUDIENCES);

  const cookie = (await headers()).get("cookie") ?? "";

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/brands/${id}/audiences`, {
      method: "GET",
      headers: { cookie },
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error(`[proxy] GET /api/brands/${id}/audiences error:`, err);
    return NextResponse.json(
      { error: "Failed to reach backend" },
      { status: 502 }
    );
  }
}
