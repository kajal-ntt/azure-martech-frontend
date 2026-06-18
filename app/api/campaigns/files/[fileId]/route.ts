import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  const response = await fetch(
    `${process.env.BACKEND_URL}/api/campaigns/files/${fileId}`,
    {
      method: "DELETE",
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