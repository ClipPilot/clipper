import { db } from "../db";
import {
  apiBillingAccounts,
  apiUsageLogs,
  apiWalletTopUps,
  teams,
} from "@clipper/shared-db/src/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { API_PRODUCTS } from "../config/api-products";
import { stripe } from "../config/stripe.config";

class ApiBillingService {
  async getAccount(teamId: number) {
    const [account] = await db
      .select()
      .from(apiBillingAccounts)
      .where(eq(apiBillingAccounts.team_id, teamId))
      .limit(1);

    return account ?? null;
  }

  async getOrCreateAccount(teamId: number) {
    const existing = await this.getAccount(teamId);
    if (existing) return existing;

    const [created] = await db
      .insert(apiBillingAccounts)
      .values({ team_id: teamId, active: true })
      .returning();

    return created;
  }

  async topUp(
    teamId: number,
    amountCents: number,
    stripePaymentIntentId?: string,
    stripeCheckoutSessionId?: string,
  ) {
    await this.getOrCreateAccount(teamId);

    const [topUp] = await db
      .insert(apiWalletTopUps)
      .values({
        team_id: teamId,
        amount_cents: amountCents,
        credits_cents: amountCents,
        stripe_payment_intent_id: stripePaymentIntentId ?? null,
        stripe_checkout_session_id: stripeCheckoutSessionId ?? null,
      })
      .returning();

    const [updated] = await db
      .update(apiBillingAccounts)
      .set({
        balance_cents: sql`${apiBillingAccounts.balance_cents} + ${amountCents}`,
        total_topped_up_cents: sql`${apiBillingAccounts.total_topped_up_cents} + ${amountCents}`,
        active: true,
        updated_at: new Date(),
      })
      .where(eq(apiBillingAccounts.team_id, teamId))
      .returning();

    return { topUp, balanceCents: updated.balance_cents };
  }

  async consume(
    apiKeyId: number,
    teamId: number,
    productSlug: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs?: number,
    metadata?: Record<string, unknown>,
  ) {
    const product = API_PRODUCTS[productSlug];
    if (!product) throw new Error(`Unknown product: ${productSlug}`);

    return this.consumeAmount(
      apiKeyId, teamId, productSlug, product.priceCents, 1,
      endpoint, method, statusCode, responseTimeMs, metadata,
    );
  }

  async consumeAmount(
    apiKeyId: number,
    teamId: number,
    productSlug: string,
    totalCostCents: number,
    quantity: number,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs?: number,
    metadata?: Record<string, unknown>,
  ) {
    if (!API_PRODUCTS[productSlug]) throw new Error(`Unknown product: ${productSlug}`);

    const account = await this.getAccount(teamId);
    if (!account || account.balance_cents < totalCostCents) {
      return { success: false, balanceCents: account?.balance_cents ?? 0 };
    }

    const [updated] = await db
      .update(apiBillingAccounts)
      .set({
        balance_cents: sql`${apiBillingAccounts.balance_cents} - ${totalCostCents}`,
        total_spent_cents: sql`${apiBillingAccounts.total_spent_cents} + ${totalCostCents}`,
        updated_at: new Date(),
      })
      .where(eq(apiBillingAccounts.team_id, teamId))
      .returning();

    await db.insert(apiUsageLogs).values({
      api_key_id: apiKeyId,
      team_id: teamId,
      product_slug: productSlug,
      endpoint,
      method,
      status_code: statusCode,
      cost_cents: totalCostCents,
      quantity,
      response_time_ms: responseTimeMs ?? null,
      metadata: metadata ?? null,
    });

    if (updated.balance_cents <= updated.refill_threshold_cents && updated.auto_refill) {
      this.tryAutoRefill(teamId).catch(() => {});
    }

    return { success: true, balanceCents: updated.balance_cents };
  }

  async logNonBillable(
    apiKeyId: number,
    teamId: number,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs?: number,
  ) {
    await db.insert(apiUsageLogs).values({
      api_key_id: apiKeyId,
      team_id: teamId,
      product_slug: null,
      endpoint,
      method,
      status_code: statusCode,
      cost_cents: 0,
      quantity: 0,
      response_time_ms: responseTimeMs ?? null,
      metadata: null,
    });
  }

  async getUsageLogs(teamId: number, limit: number, offset: number) {
    const logs = await db
      .select()
      .from(apiUsageLogs)
      .where(eq(apiUsageLogs.team_id, teamId))
      .orderBy(desc(apiUsageLogs.created_at))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(apiUsageLogs)
      .where(eq(apiUsageLogs.team_id, teamId));

    return { logs, total };
  }

  async updateAutoRefill(
    teamId: number,
    settings: {
      auto_refill?: boolean;
      refill_threshold_cents?: number;
      refill_amount_cents?: number;
    },
  ) {
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (settings.auto_refill !== undefined) updates.auto_refill = settings.auto_refill;
    if (settings.refill_threshold_cents !== undefined)
      updates.refill_threshold_cents = settings.refill_threshold_cents;
    if (settings.refill_amount_cents !== undefined)
      updates.refill_amount_cents = settings.refill_amount_cents;

    const [updated] = await db
      .update(apiBillingAccounts)
      .set(updates)
      .where(eq(apiBillingAccounts.team_id, teamId))
      .returning();

    return updated;
  }

  async savePaymentMethod(teamId: number, paymentMethodId: string) {
    await db
      .update(apiBillingAccounts)
      .set({
        stripe_payment_method_id: paymentMethodId,
        updated_at: new Date(),
      })
      .where(eq(apiBillingAccounts.team_id, teamId));
  }

  async tryAutoRefill(teamId: number): Promise<boolean> {
    const account = await this.getAccount(teamId);
    if (!account) return false;
    if (!account.auto_refill) return false;
    if (!account.stripe_payment_method_id) return false;
    if (account.balance_cents > account.refill_threshold_cents) return false;

    const [team] = await db
      .select({ stripe_customer_id: teams.stripe_customer_id })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team?.stripe_customer_id) return false;

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: account.refill_amount_cents,
        currency: "usd",
        customer: team.stripe_customer_id,
        payment_method: account.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          teamId: teamId.toString(),
          type: "api_auto_refill",
          amount_cents: account.refill_amount_cents.toString(),
        },
      });

      if (paymentIntent.status === "succeeded") {
        await this.topUp(
          teamId,
          account.refill_amount_cents,
          paymentIntent.id,
        );
        console.log(
          `[Auto-Refill] Charged $${(account.refill_amount_cents / 100).toFixed(2)} for team ${teamId}`,
        );
        return true;
      }

      return false;
    } catch (err) {
      console.error(`[Auto-Refill] Failed for team ${teamId}:`, err);
      return false;
    }
  }

  async isTopUpCredited(teamId: number, stripePaymentIntentId: string): Promise<boolean> {
    const [topUp] = await db
      .select({ id: apiWalletTopUps.id })
      .from(apiWalletTopUps)
      .where(
        and(
          eq(apiWalletTopUps.team_id, teamId),
          eq(apiWalletTopUps.stripe_payment_intent_id, stripePaymentIntentId),
        ),
      )
      .limit(1);

    return !!topUp;
  }

  formatBalance(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export const apiBillingService = new ApiBillingService();
