import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url param required" }, { status: 400 });
  }

  // Azure Blob Storage — proxy through Node backend (private container)
  if (url.includes("blob.core.windows.net")) {
    try {
      const backendRes = await fetch(
        `${BACKEND_URL}/api/creatives/proxy-image?url=${encodeURIComponent(url)}`,
        { cache: "no-store" }
      );

      if (!backendRes.ok) {
        return new NextResponse(null, { status: backendRes.status });
      }

      const contentType = backendRes.headers.get("content-type") ?? "application/octet-stream";
      const buffer = await backendRes.arrayBuffer();

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch (err) {
      console.error("[image-proxy] azure error:", err);
      return new NextResponse(null, { status: 502 });
    }
  }

  // GCS / external URLs — fetch directly
  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[image-proxy] fallback error:", err);
    return new NextResponse(null, { status: 502 });
  }
}
