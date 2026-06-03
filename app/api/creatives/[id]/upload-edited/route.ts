import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_CREATIVES, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * PUT /api/creatives/:id/upload-edited
 * Saves an edited image as a new creative record via the save-as-new endpoint.
 * The backend doesn't have a dedicated upload-edited endpoint — save-as-new handles this.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (USE_MOCK) return NextResponse.json({ ...MOCK_CREATIVES[0], id, url: "https://picsum.photos/seed/edited/800/1000" });

  const cookie = (await headers()).get("cookie") ?? "";
  const contentType = req.headers.get("content-type") ?? "application/octet-stream";

  try {
    // Route to save-as-new which handles image uploads and creates a new versioned creative
    const backendRes = await fetch(`${BACKEND_URL}/api/creatives/${id}/save-as-new`, {
      method: "POST",
      headers: { "content-type": contentType, cookie },
      body: req.body,
      // @ts-expect-error - duplex needed for streaming
      duplex: "half",
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error(`[proxy] PUT /api/creatives/${id}/upload-edited error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
