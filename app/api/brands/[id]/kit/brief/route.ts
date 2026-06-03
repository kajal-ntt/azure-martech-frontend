import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_BRAND_KIT, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) return NextResponse.json({ ...MOCK_BRAND_KIT, brandId: id });

  const cookie = (await headers()).get("cookie") ?? "";
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const body = await req.text();

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/brands/${id}/kit/brief`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie, origin },
      body,
    });
    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error(`[proxy] PUT /api/brands/${id}/kit/brief error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
