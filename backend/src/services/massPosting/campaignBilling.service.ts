import {
  campaigns,
  campaignWallets,
  campaignWalletTopUps,
} from "@clipper/shared-db";
import { db } from "../../db";
import { eq, and, sql } from "drizzle-orm";

class CampaignBillingService {
  async getWallet(campaignId: number) {
    const [wallet] = await db
      .select()
      .from(campaignWallets)
      .where(eq(campaignWallets.campaign_id, campaignId))
      .limit(1);

    return wallet || null;
  }

  async getOrCreateWallet(campaignId: number, teamId: number) {
    const existing = await this.getWallet(campaignId);
    if (existing) return existing;

    const [created] = await db
      .insert(campaignWallets)
      .values({
        campaign_id: campaignId,
        team_id: teamId,
      })
      .returning();

    return created;
  }

  async topUp(
    campaignId: number,
    teamId: number,
    amountCents: number,
    stripePaymentIntentId: string,
  ) {
    // Idempotency: check if already credited
    const [existing] = await db
      .select({ id: campaignWalletTopUps.id })
      .from(campaignWalletTopUps)
      .where(
        eq(
          campaignWalletTopUps.stripe_payment_intent_id,
          stripePaymentIntentId,
        ),
      )
      .limit(1);

    if (existing) {
      console.log(
        `[CampaignBilling] Already credited PI ${stripePaymentIntentId}, skipping`,
      );
      const wallet = await this.getOrCreateWallet(campaignId, teamId);
      return { balanceCents: wallet.balance_cents };
    }

    await this.getOrCreateWallet(campaignId, teamId);

    await db.insert(campaignWalletTopUps).values({
      campaign_id: campaignId,
      team_id: teamId,
      amount_cents: amountCents,
      stripe_payment_intent_id: stripePaymentIntentId,
    });

    const [updated] = await db
      .update(campaignWallets)
      .set({
        balance_cents: sql`${campaignWallets.balance_cents} + ${amountCents}`,
        total_deposited_cents: sql`${campaignWallets.total_deposited_cents} + ${amountCents}`,
        updated_at: new Date(),
      })
      .where(eq(campaignWallets.campaign_id, campaignId))
      .returning();

    // Check payment gate
    await this.checkPaymentGate(campaignId);

    return { balanceCents: updated.balance_cents };
  }

  async isTopUpCredited(
    campaignId: number,
    stripePaymentIntentId: string,
  ): Promise<boolean> {
    const [topUp] = await db
      .select({ id: campaignWalletTopUps.id })
      .from(campaignWalletTopUps)
      .where(
        and(
          eq(campaignWalletTopUps.campaign_id, campaignId),
          eq(
            campaignWalletTopUps.stripe_payment_intent_id,
            stripePaymentIntentId,
          ),
        ),
      )
      .limit(1);

    return !!topUp;
  }

  async savePaymentMethod(campaignId: number, teamId: number, paymentMethodId: string) {
    await this.getOrCreateWallet(campaignId, teamId);
    await db
      .update(campaignWallets)
      .set({
        stripe_payment_method_id: paymentMethodId,
        updated_at: new Date(),
      })
      .where(eq(campaignWallets.campaign_id, campaignId));
  }

  async checkPaymentGate(campaignId: number): Promise<boolean> {
    const wallet = await this.getWallet(campaignId);

    // Look up campaign minimum_fund (fallback to budget) to compare against
    const [campaign] = await db
      .select({ budget: campaigns.budget, minimum_fund: campaigns.minimum_fund })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    const requiredAmount = campaign?.minimum_fund ?? campaign?.budget;
    const requiredCents = requiredAmount
      ? Math.round(parseFloat(requiredAmount) * 100)
      : 0;

    // Gate complete when wallet balance meets or exceeds the minimum fund
    const ready = !!wallet && wallet.balance_cents >= requiredCents && requiredCents > 0;

    await db
      .update(campaigns)
      .set({ payment_ready: ready, updated_at: new Date() })
      .where(eq(campaigns.id, campaignId));

    return ready;
  }
}

export const campaignBillingService = new CampaignBillingService();
