import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookie = (await headers()).get("cookie") ?? "";
  const contentType = req.headers.get("content-type") ?? "multipart/form-data";

  try {
    const backendRes = await fetch(
      `${BACKEND_URL}/api/campaigns/${id}/reference-image`,
      {
        method: "POST",
        headers: { "content-type": contentType, cookie },
        body: req.body,
        // @ts-expect-error - duplex needed for streaming
        duplex: "half",
      }
    );

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error(`[proxy] POST /api/campaigns/${id}/reference-image error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
