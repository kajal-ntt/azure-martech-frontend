import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url param required" }, { status: 400 });
  }

  // For non-GCS URLs (e.g. picsum placeholders), fetch directly
  if (!url.startsWith("https://storage.googleapis.com/")) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return new NextResponse(null, { status: res.status });
      const contentType = res.headers.get("content-type") ?? "image/png";
      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" },
      });
    } catch (err) {
      console.error("[image-proxy] direct fetch error:", err);
      return new NextResponse(null, { status: 502 });
    }
  }

  // GCS URLs — proxy through backend which has credentials
  try {
    const backendRes = await fetch(
      `${BACKEND_URL}/api/creatives/proxy-image?url=${encodeURIComponent(url)}`,
      { cache: "no-store" }
    );

    if (!backendRes.ok) {
      return new NextResponse(null, { status: backendRes.status });
    }

    const contentType = backendRes.headers.get("content-type") ?? "image/png";
    const buffer = await backendRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    console.error("[image-proxy] error:", err);
    return new NextResponse(null, { status: 502 });
  }
}
