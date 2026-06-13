import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const AGENT_URL = (process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://localhost:8001/api/v1").replace("localhost", "127.0.0.1");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join("/");
  
  const body = await req.text();
  const authHeader = (await headers()).get("authorization") ?? "";
  const cookieHeader = req.headers.get("cookie");

  console.log("[proxy] Auth Header:", authHeader ? "PRESENT" : "MISSING");  
  console.log("[proxy] Cookie Header:", cookieHeader ? "PRESENT" : "MISSING");

  try {
    const targetUrl = `${AGENT_URL}/agents/${targetPath}`;
    console.log(`[proxy] Forwarding POST to ${targetUrl}`);

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {})
      },
      body,
    });
    console.log(`[proxy] Received ${res.status} from ${targetUrl}`);

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status });
    } catch {
      return NextResponse.json({ error: text }, { status: res.status });
    }
  } catch (err) {
    console.error(`[proxy] POST /api/agents/${targetPath} error:`, err);
    return NextResponse.json({ error: "Failed to reach agent backend" }, { status: 502 });
  }
}
