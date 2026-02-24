import { NextResponse } from "next/server";
import { checkAllServices } from "@/lib/checker";
import { getAllHistory, recordChecks } from "@/lib/store";
import { services as serviceConfigs } from "@/lib/services";
import { ServiceWithHistory, StatusResponse, DailyUptime } from "@/lib/types";

export const dynamic = "force-dynamic";

function calcUptime90d(history: DailyUptime[]): number | null {
  if (history.length === 0) return null;
  const totalChecks = history.reduce((s, d) => s + d.checks, 0);
  const totalFailures = history.reduce((s, d) => s + d.failures, 0);
  if (totalChecks === 0) return null;
  return Number((((totalChecks - totalFailures) / totalChecks) * 100).toFixed(2));
}

export async function GET() {
  try {
    const serviceIds = serviceConfigs.map((s) => s.id);
    const [checks, historyMap] = await Promise.all([
      checkAllServices(),
      getAllHistory(serviceIds),
    ]);

    recordChecks(checks.services).catch((err) => {
      console.error("[status] Failed to record checks to DynamoDB:", err);
    });

    const services: ServiceWithHistory[] = checks.services.map((check) => {
      const history = historyMap[check.id] || [];
      return {
        ...check,
        history,
        uptimePercent90d: calcUptime90d(history),
      };
    });

    const response: StatusResponse = {
      overall: checks.overall,
      services,
      checkedAt: checks.checkedAt,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[/api/status] Error:", err);
    return NextResponse.json(
      { error: "Failed to check services", message: String(err) },
      { status: 500 }
    );
  }
}
