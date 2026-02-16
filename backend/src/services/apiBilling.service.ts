import { db } from "../db";
import {
  apiBillingAccounts,
  apiUsageLogs,
  apiWalletTopUps,
} from "@clipper/shared-db/src/schema";
import { eq, sql } from "drizzle-orm";
import { API_PRODUCTS } from "../config/api-products";

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

    const account = await this.getAccount(teamId);
    if (!account || account.balance_cents < product.priceCents) {
      return { success: false, balanceCents: account?.balance_cents ?? 0 };
    }

    const [updated] = await db
      .update(apiBillingAccounts)
      .set({
        balance_cents: sql`${apiBillingAccounts.balance_cents} - ${product.priceCents}`,
        total_spent_cents: sql`${apiBillingAccounts.total_spent_cents} + ${product.priceCents}`,
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
      cost_cents: product.priceCents,
      quantity: 1,
      response_time_ms: responseTimeMs ?? null,
      metadata: metadata ?? null,
    });

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

  formatBalance(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export const apiBillingService = new ApiBillingService();
