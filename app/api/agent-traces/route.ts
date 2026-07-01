import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function GET(req: NextRequest) {
  const cookie = (await headers()).get("cookie") ?? "";
  const { searchParams } = new URL(req.url);

  // Forward all query params to the backend
  const backendUrl = new URL(`${BACKEND_URL}/api/agent-traces`);
  searchParams.forEach((value, key) => {
    backendUrl.searchParams.set(key, value);
  });

  try {
    const backendRes = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: { cookie },
      cache: "no-store",
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("[proxy] GET /api/agent-traces error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
