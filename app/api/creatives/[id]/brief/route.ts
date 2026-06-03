import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_CREATIVES, USE_MOCK } from "@/lib/mock-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// In-memory store for mock brief edits (persists for the dev server session)
const mockBriefStore: Record<string, string> = {};

function mockBriefTemplate(id: string, type: string): string {
  if (type === "VIDEO") {
    return `Video Creative Brief:

Visual Direction: Dynamic, motion-rich content that captures attention in the first 2 seconds. Use brand colors and festive elements throughout.

Motion & Camera: Smooth dolly zoom opening, quick cuts between scenes, slow-motion product reveal. Camera movement should feel cinematic and intentional.

Format: 9:16 portrait for Stories/Reels, 8-15 second duration optimized for social platforms.

Audio & Mood: Energetic, upbeat background music that matches the festive tone. No voiceover — let visuals tell the story.

Key Message: Celebrate the moment, showcase the brand, drive action.

Call to Action: Clear end-card with CTA button — "Shop Now" or "Learn More".`;
  }

  return `Image Creative Brief:

Visual Direction: Bold, vibrant imagery that captures attention immediately. Use brand colors prominently throughout.

Background: Rich, festive scene with warm tones. Background should complement the subject without overwhelming it.

Subject & Actors: Culturally authentic representation, festive attire, conveying joy and celebration.

Graphics & Elements: Brand-consistent decorative elements that reinforce the festive theme.

Typography: Headline in brand font, large and legible. Tagline in secondary font, supporting the headline.

Logo Placement: Top-right corner with subtle drop shadow for visibility.

Call to Action: Clear, prominent CTA at the bottom — contrasting color, easy to read.`;
}

// GET /api/creatives/:id/brief
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (USE_MOCK) {
    const creative = MOCK_CREATIVES.find(c => c.id === id) ?? MOCK_CREATIVES[0];
    const type = (creative as any).type ?? "IMAGE";
    const brief = mockBriefStore[id] ?? (creative as any).creativeBrief ?? mockBriefTemplate(id, type);
    return NextResponse.json({ brief, creativeId: id, type });
  }

  const cookie = (await headers()).get("cookie") ?? "";
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/creatives/${id}`, {
      headers: { cookie },
    });
    if (!backendRes.ok) return NextResponse.json({ error: "Creative not found" }, { status: backendRes.status });
    const data = await backendRes.json();
    const creative = data.creative ?? data;
    return NextResponse.json({
      brief: creative.creativeBrief ?? null,
      creativeId: id,
      type: creative.type ?? "IMAGE",
    });
  } catch (err) {
    console.error(`[proxy] GET /api/creatives/${id}/brief error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

// PUT /api/creatives/:id/brief — save edited brief
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { brief } = body as { brief: string };

  if (!brief) return NextResponse.json({ error: "brief is required" }, { status: 400 });

  if (USE_MOCK) {
    mockBriefStore[id] = brief;
    return NextResponse.json({ success: true, creativeId: id, brief });
  }

  const cookie = (await headers()).get("cookie") ?? "";
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/creatives/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ creativeBrief: brief }),
    });
    const data = await backendRes.json();
    return NextResponse.json({ success: true, creativeId: id, brief, ...data }, { status: backendRes.status });
  } catch (err) {
    console.error(`[proxy] PUT /api/creatives/${id}/brief error:`, err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
