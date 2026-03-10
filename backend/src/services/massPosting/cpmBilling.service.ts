import {
  campaigns,
  campaignDailyCharges,
} from "@clipper/shared-db";
import { db } from "../../db";
import { eq, and, desc } from "drizzle-orm";

class CpmBillingService {
  async getBillingBreakdown(campaignId: number, teamId: number) {
    // Get campaign for CPM rate
    const [campaign] = await db
      .select({
        quoted_cpm: campaigns.quoted_cpm,
        status: campaigns.status,
      })
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.team_id, teamId)))
      .limit(1);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Get all daily charges ordered by date
    const dailyCharges = await db
      .select()
      .from(campaignDailyCharges)
      .where(
        and(
          eq(campaignDailyCharges.campaign_id, campaignId),
          eq(campaignDailyCharges.team_id, teamId),
        ),
      )
      .orderBy(desc(campaignDailyCharges.charge_date));

    // Compute summary
    let totalChargedCents = 0;
    let totalViews = 0;
    let walletSpentCents = 0;
    let cardChargedCents = 0;

    for (const charge of dailyCharges) {
      if (charge.status === "charged") {
        totalChargedCents += charge.charge_cents;
        totalViews += charge.total_views_delta;
        if (charge.source === "wallet") {
          walletSpentCents += charge.charge_cents;
        } else if (charge.source === "card") {
          cardChargedCents += charge.charge_cents;
        }
      }
    }

    return {
      summary: {
        totalChargedCents,
        totalViews,
        walletSpentCents,
        cardChargedCents,
        cpmRate: campaign.quoted_cpm,
        daysTracked: dailyCharges.length,
      },
      dailyCharges: dailyCharges.map((c) => ({
        id: c.id,
        chargeDate: c.charge_date,
        totalViewsDelta: c.total_views_delta,
        cpmRate: c.cpm_rate,
        chargeCents: c.charge_cents,
        source: c.source,
        status: c.status,
        failureReason: c.failure_reason,
        postBreakdown: c.post_breakdown,
        createdAt: c.created_at,
      })),
    };
  }
}

export const cpmBillingService = new CpmBillingService();
