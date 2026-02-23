import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.AD_POSTING_WEBHOOK_SECRET;

  if (!apiUrl || !secret) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { postId, postUrl } = body;

  // Validate postId is a positive integer
  if (!postId || !Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json(
      { error: "postId must be a positive integer" },
      { status: 400 }
    );
  }

  // Validate postUrl is a non-empty string
  if (!postUrl || typeof postUrl !== "string" || postUrl.trim() === "") {
    return NextResponse.json(
      { error: "postUrl is required" },
      { status: 400 }
    );
  }

  // Forward to backend webhook
  const backendUrl = `${apiUrl}/ad-posting/webhook/posted`;

  const backendRes = await fetch(backendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": secret,
    },
    body: JSON.stringify({ postId, postUrl }),
  });

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
