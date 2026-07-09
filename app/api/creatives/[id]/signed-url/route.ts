import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_CREATIVES, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL;

function toProxiedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Azure Blob — proxy through image-proxy
  if (url.includes("blob.core.windows.net")) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  // GCS
  if (url.startsWith("gs://")) {
    const https = url.replace("gs://", "https://storage.googleapis.com/");
    return `/api/image-proxy?url=${encodeURIComponent(https)}`;
  }
  return url;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (USE_MOCK) {
    const creative = MOCK_CREATIVES.find(c => c.id === id) ?? MOCK_CREATIVES[0];
    return NextResponse.json({ url: toProxiedUrl(creative.url), status: creative.status });
  }

  const cookie = (await headers()).get("cookie") ?? "";
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/creatives/${id}/signed-url`, {
      headers: { cookie },
    });

    const text = await backendRes.text();
    try {
      const data = JSON.parse(text);
      // Replace the raw URL with a proxied URL so the editor/canvas can load it
      if (data.url) {
        data.url = toProxiedUrl(data.url);
      }
      return NextResponse.json(data, { status: backendRes.status });
    } catch {
      return NextResponse.json({ error: text }, { status: backendRes.status });
    }
  } catch (err) {
    console.error("[proxy] GET /api/creatives/signed-url error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
