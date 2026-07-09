import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_AUDIENCES, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL;

export async function GET(req: NextRequest) {
  if (USE_MOCK) return NextResponse.json(MOCK_AUDIENCES);

  const cookie = (await headers()).get("cookie") ?? "";

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/audiences`, {
      method: "GET",
      headers: { cookie },
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("[proxy] GET /api/audiences error:", err);
    return NextResponse.json(
      { error: "Failed to reach backend" },
      { status: 502 }
    );
  }
}
