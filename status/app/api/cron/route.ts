import { NextRequest, NextResponse } from "next/server";
import { checkAllServices } from "@/lib/checker";
import { recordChecks } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET || process.env.STATUS_CRON_SECRET;

  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await checkAllServices();

  try {
    await recordChecks(result.services);
  } catch (err) {
    console.error("[cron] Failed to record checks to DynamoDB:", err);
    return NextResponse.json(
      { error: "Failed to write to DynamoDB", details: String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    stored: result.services.length,
    overall: result.overall,
    checkedAt: result.checkedAt,
  });
}
