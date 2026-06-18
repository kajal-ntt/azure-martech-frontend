import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const response = await fetch(
    `${BACKEND_URL}/api/campaigns/${id}/files`,
    {
      credentials: "include",
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
    }
  );

  const data = await response.json();

  return NextResponse.json(data, {
    status: response.status,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const formData = await req.formData();

  const response = await fetch(
    `${BACKEND_URL}/api/campaigns/${id}/files`,
    {
      method: "POST",
      body: formData,
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
    }
  );

  const data = await response.json();

  return NextResponse.json(data, {
    status: response.status,
  });
}