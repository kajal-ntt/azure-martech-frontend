import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_BRAND, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  if (USE_MOCK) return NextResponse.json(MOCK_BRAND, { status: 201 });

  const cookie = (await headers()).get("cookie") ?? "";
  const body = await req.text();

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/brands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      },
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
    console.error("[proxy] POST /api/brands error:", err);
    return NextResponse.json(
      { error: "Failed to reach backend" },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  if (USE_MOCK) return NextResponse.json([MOCK_BRAND]);

  const cookie = (await headers()).get("cookie") ?? "";

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/brands`, {
      method: "GET",
      headers: {
        cookie,
      },
    });

    const text = await backendRes.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: backendRes.status });
    } catch {
      return NextResponse.json({ error: text }, { status: backendRes.status });
    }
  } catch (err) {
    console.error("[proxy] GET /api/brands error:", err);
    return NextResponse.json(
      { error: "Failed to reach backend" },
      { status: 502 }
    );
  }
}
