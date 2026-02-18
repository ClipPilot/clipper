import { NextRequest, NextResponse } from "next/server";
import { checkAllServices } from "@/lib/checker";
import { recordChecks } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkAllServices();
    await recordChecks(result.services);

    return NextResponse.json({
      stored: result.services.length,
      overall: result.overall,
      checkedAt: result.checkedAt,
    });
  } catch (err) {
    console.error("[/api/cron] Error:", err);
    return NextResponse.json(
      { error: "Cron check failed", message: String(err) },
      { status: 500 }
    );
  }
}
