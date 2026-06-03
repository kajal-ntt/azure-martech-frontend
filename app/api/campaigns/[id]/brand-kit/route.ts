import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_BRAND_KIT, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) return NextResponse.json(MOCK_BRAND_KIT);

  const cookie = (await headers()).get("cookie") ?? "";
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/campaigns/${id}/brand-kit`, {
      headers: { cookie },
    });
    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error(`[proxy] GET /api/campaigns/${id}/brand-kit error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
