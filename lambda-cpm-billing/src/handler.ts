import { Handler } from "aws-lambda";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@clipper/shared-db";
import { eq, and, sql, inArray, gt, gte, isNotNull, desc } from "drizzle-orm";
import Stripe from "stripe";
import { Resend } from "resend";
import { campaignPausedEmail } from "@clipper/shared-email";

const DATABASE_URL = process.env.DATABASE_URL!;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://platform.cuttr.com";

let pool: Pool | null = null;
const getDb = () => {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return drizzle(pool, { schema });
};

const getStripe = () => new Stripe(STRIPE_SECRET_KEY);

const BILLABLE_STATUSES = ["started"] as const;

interface PostBreakdownEntry {
  user_post_id: number;
  previous_views: number;
  current_views: number;
  delta_views: number;
  charge_cents: number;
}

interface ChargeRecord {
  source: "wallet" | "card";
  chargeCents: number;
  stripePaymentIntentId?: string;
}

interface PaymentResult {
  success: boolean;
  charges: ChargeRecord[];
  failureReason?: string;
}

// Advisory lock key for preventing concurrent billing runs
const CPM_BILLING_LOCK_KEY = 8675309;

export const handler: Handler = async () => {
  const db = getDb();
  const now = new Date();

  console.log(`[CPM Billing] Starting billing run at ${now.toISOString()}`);

  // Acquire advisory lock to prevent concurrent Lambda executions from double-billing
  const lockResult = await db.execute(sql`SELECT pg_try_advisory_lock(${CPM_BILLING_LOCK_KEY}) AS acquired`);
  const lockAcquired = (lockResult as any).rows?.[0]?.acquired ?? (lockResult as any)[0]?.acquired;
  if (!lockAcquired) {
    console.log("[CPM Billing] Another instance is already running, skipping");
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: "lock" }) };
  }

  try {
    return await runBilling(db, now);
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${CPM_BILLING_LOCK_KEY})`);
  }
};

async function runBilling(db: ReturnType<typeof getDb>, now: Date) {
  const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);
  const [recentCharge] = await db
    .select({ id: schema.campaignDailyCharges.id })
    .from(schema.campaignDailyCharges)
    .where(gte(schema.campaignDailyCharges.charge_date, twentyHoursAgo))
    .limit(1);

  if (recentCharge) {
    console.log("[CPM Billing] Already billed within 20h, skipping");
    return { statusCode: 200, body: JSON.stringify({ skipped: true }) };
  }

  const activeCampaigns = await db
    .select({
      id: schema.campaigns.id,
      team_id: schema.campaigns.team_id,
      quoted_cpm: schema.campaigns.quoted_cpm,
      status: schema.campaigns.status,
    })
    .from(schema.campaigns)
    .where(
      and(
        inArray(schema.campaigns.status, [...BILLABLE_STATUSES]),
        isNotNull(schema.campaigns.quoted_cpm),
      ),
    );

  console.log(`[CPM Billing] Found ${activeCampaigns.length} active campaigns`);

  let totalCharged = 0;
  let totalFailed = 0;

  for (const campaign of activeCampaigns) {
    try {
      const cpmRate = parseFloat(campaign.quoted_cpm!);
      if (cpmRate <= 0) continue;

      const billablePosts = await db
        .select({
          user_post_id: schema.userPosts.id,
          video_play_count: schema.userPosts.video_play_count,
          video_view_count: schema.userPosts.video_view_count,
          last_billed_views: schema.userPosts.last_billed_views,
          syncs_remaining: schema.userPosts.syncs_remaining,
        })
        .from(schema.userPosts)
        .innerJoin(
          schema.posts,
          eq(schema.userPosts.mass_post_id, schema.posts.id),
        )
        .where(
          and(
            eq(schema.posts.campaign_id, campaign.id),
            gt(schema.userPosts.syncs_remaining, 0),
            isNotNull(schema.userPosts.post_url),
          ),
        );

      if (billablePosts.length === 0) continue;

      const breakdown: PostBreakdownEntry[] = [];
      let totalDeltaViews = 0;

      for (const post of billablePosts) {
        const currentViews =
          post.video_play_count ?? post.video_view_count ?? 0;
        const previousViews = post.last_billed_views;
        const deltaViews = Math.max(0, currentViews - previousViews);

        if (deltaViews === 0) continue;

        const postChargeCents = Math.round((deltaViews / 1000) * cpmRate * 100);

        breakdown.push({
          user_post_id: post.user_post_id,
          previous_views: previousViews,
          current_views: currentViews,
          delta_views: deltaViews,
          charge_cents: postChargeCents,
        });

        totalDeltaViews += deltaViews;
      }

      if (totalDeltaViews === 0 || breakdown.length === 0) continue;

      const totalChargeCents = breakdown.reduce(
        (sum, b) => sum + b.charge_cents,
        0,
      );

      if (totalChargeCents < 1) continue;

      const result = await collectPayment(
        db,
        campaign.id,
        campaign.team_id,
        totalChargeCents,
      );

      if (result.success) {
        // Transaction: charge records + last_billed_views must be atomic
        // If Lambda crashes between these, we'd either double-charge or lose records
        await db.transaction(async (tx) => {
          for (const charge of result.charges) {
            await tx.insert(schema.campaignDailyCharges).values({
              campaign_id: campaign.id,
              team_id: campaign.team_id,
              charge_date: now,
              total_views_delta: totalDeltaViews,
              cpm_rate: cpmRate.toString(),
              charge_cents: charge.chargeCents,
              source: charge.source,
              status: "charged",
              stripe_payment_intent_id: charge.stripePaymentIntentId ?? null,
              failure_reason: null,
              post_breakdown: breakdown,
            });
          }

          const postIds = breakdown.map((e) => e.user_post_id);
          const caseChunks = breakdown.map(
            (e) => sql`WHEN ${e.user_post_id} THEN ${e.current_views}::integer`,
          );

          await tx
            .update(schema.userPosts)
            .set({
              last_billed_views: sql`CASE ${schema.userPosts.id} ${sql.join(caseChunks, sql` `)} END`,
              updated_at: now,
            })
            .where(inArray(schema.userPosts.id, postIds));
        });

        totalCharged += totalChargeCents;
        console.log(
          `[CPM Billing] Campaign ${campaign.id}: $${(totalChargeCents / 100).toFixed(2)} (${totalDeltaViews} views @ $${cpmRate} CPM) — ${result.charges.map((c) => `${c.source}: $${(c.chargeCents / 100).toFixed(2)}`).join(", ")}`,
        );
      } else {
        await db.insert(schema.campaignDailyCharges).values({
          campaign_id: campaign.id,
          team_id: campaign.team_id,
          charge_date: now,
          total_views_delta: totalDeltaViews,
          cpm_rate: cpmRate.toString(),
          charge_cents: totalChargeCents,
          source: null,
          status: "failed",
          stripe_payment_intent_id: null,
          failure_reason: result.failureReason ?? null,
          post_breakdown: breakdown,
        });

        totalFailed++;
        console.error(
          `[CPM Billing] Campaign ${campaign.id}: payment failed — ${result.failureReason}`,
        );
        await endCampaignAndStopTracking(db, campaign.id, campaign.team_id, result.failureReason ?? "Unknown");
      }
    } catch (err) {
      totalFailed++;
      console.error(`[CPM Billing] Campaign ${campaign.id}:`, err);
    }
  }

  console.log(
    `[CPM Billing] Done. $${(totalCharged / 100).toFixed(2)} charged. ${totalFailed} failures.`,
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      campaignsProcessed: activeCampaigns.length,
      totalChargedCents: totalCharged,
      failures: totalFailed,
    }),
  };
};

// ── Payment collection ──

async function collectPayment(
  db: ReturnType<typeof getDb>,
  campaignId: number,
  teamId: number,
  amountCents: number,
): Promise<PaymentResult> {
  const [wallet] = await db
    .select()
    .from(schema.campaignWallets)
    .where(eq(schema.campaignWallets.campaign_id, campaignId))
    .limit(1);

  // Wallet covers the full amount
  if (wallet && wallet.balance_cents >= amountCents) {
    const [updated] = await db
      .update(schema.campaignWallets)
      .set({
        balance_cents: sql`${schema.campaignWallets.balance_cents} - ${amountCents}`,
        total_spent_cents: sql`${schema.campaignWallets.total_spent_cents} + ${amountCents}`,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(schema.campaignWallets.campaign_id, campaignId),
          sql`${schema.campaignWallets.balance_cents} >= ${amountCents}`,
        ),
      )
      .returning();

    if (updated) {
      return {
        success: true,
        charges: [{ source: "wallet", chargeCents: amountCents }],
      };
    }
  }

  // Wallet can't cover it — need card. Drain wallet first, card for remainder.
  const walletBalance = wallet?.balance_cents ?? 0;
  const walletPortion = Math.min(walletBalance, amountCents);
  const cardPortion = amountCents - walletPortion;

  const paymentMethodId = wallet?.stripe_payment_method_id;
  if (!paymentMethodId) {
    return {
      success: false,
      charges: [],
      failureReason: "Wallet insufficient and no card on file",
    };
  }

  const [team] = await db
    .select({ stripe_customer_id: schema.teams.stripe_customer_id })
    .from(schema.teams)
    .where(eq(schema.teams.id, teamId))
    .limit(1);

  if (!team?.stripe_customer_id) {
    return {
      success: false,
      charges: [],
      failureReason: "No Stripe customer for team",
    };
  }

  // Charge card FIRST before draining wallet (so we can roll back cleanly)
  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: cardPortion,
      currency: "usd",
      customer: team.stripe_customer_id,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        campaignId: campaignId.toString(),
        teamId: teamId.toString(),
        type: "cpm_daily_charge",
      },
    });

    if (paymentIntent.status !== "succeeded") {
      return {
        success: false,
        charges: [],
        failureReason: `Payment intent status: ${paymentIntent.status}`,
      };
    }

    // Card succeeded — now drain wallet portion
    const charges: ChargeRecord[] = [];

    if (walletPortion > 0) {
      await db
        .update(schema.campaignWallets)
        .set({
          balance_cents: sql`${schema.campaignWallets.balance_cents} - ${walletPortion}`,
          total_spent_cents: sql`${schema.campaignWallets.total_spent_cents} + ${walletPortion}`,
          updated_at: new Date(),
        })
        .where(eq(schema.campaignWallets.campaign_id, campaignId));

      charges.push({ source: "wallet", chargeCents: walletPortion });
    }

    charges.push({
      source: "card",
      chargeCents: cardPortion,
      stripePaymentIntentId: paymentIntent.id,
    });

    return { success: true, charges };
  } catch (err: any) {
    console.error(`[CPM Billing] Stripe failed for campaign ${campaignId}:`, err);
    return {
      success: false,
      charges: [],
      failureReason: `Card charge failed: ${err.message}`,
    };
  }
}

// ── Campaign shutdown ──

async function endCampaignAndStopTracking(
  db: ReturnType<typeof getDb>,
  campaignId: number,
  teamId: number,
  failureReason: string,
) {
  const [campaign] = await db
    .select({ name: schema.campaigns.name })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);

  await db
    .update(schema.campaigns)
    .set({ status: "paused", updated_at: new Date() })
    .where(eq(schema.campaigns.id, campaignId));

  const linkedPostIds = await db
    .select({ id: schema.userPosts.id })
    .from(schema.userPosts)
    .innerJoin(schema.posts, eq(schema.userPosts.mass_post_id, schema.posts.id))
    .where(eq(schema.posts.campaign_id, campaignId));

  if (linkedPostIds.length > 0) {
    await db
      .update(schema.userPosts)
      .set({ syncs_remaining: 0, updated_at: new Date() })
      .where(
        inArray(
          schema.userPosts.id,
          linkedPostIds.map((p) => p.id),
        ),
      );
  }

  console.log(
    `[CPM Billing] Campaign ${campaignId}: paused + stopped ${linkedPostIds.length} posts`,
  );

  await sendCampaignPausedEmails(db, campaignId, teamId, campaign?.name ?? `#${campaignId}`, failureReason);
}

async function sendCampaignPausedEmails(
  db: ReturnType<typeof getDb>,
  campaignId: number,
  teamId: number,
  campaignName: string,
  failureReason: string,
) {
  try {
    const resend = new Resend(RESEND_API_KEY);

    const [team] = await db
      .select({ name: schema.teams.name })
      .from(schema.teams)
      .where(eq(schema.teams.id, teamId))
      .limit(1);

    const [owner] = await db
      .select({
        email: schema.users.email,
        firstName: schema.users.first_name,
      })
      .from(schema.users)
      .innerJoin(
        schema.teamMembers,
        and(
          eq(schema.users.id, schema.teamMembers.user_id),
          eq(schema.teamMembers.team_id, teamId),
          eq(schema.teamMembers.role, "owner"),
        ),
      )
      .limit(1);

    const teamName = team?.name ?? `Team #${teamId}`;
    const dashboardUrl = `${FRONTEND_URL}/dashboard/publish-posts/${campaignId}`;

    if (owner?.email) {
      await resend.emails.send({
        from: "Cuttr <no-reply@mail.cuttr.com>",
        to: [owner.email],
        subject: `Campaign "${campaignName}" has been paused — payment failed`,
        html: campaignPausedEmail({
          userName: owner.firstName || "there",
          teamName,
          campaignName,
          failureReason,
          dashboardUrl,
        }),
      });
    }

    await resend.emails.send({
      from: "Cuttr <no-reply@mail.cuttr.com>",
      to: ["contact@cuttr.com"],
      subject: `[Billing Alert] Campaign "${campaignName}" paused — payment failed (Team: ${teamName})`,
      html: campaignPausedEmail({
        userName: "Team",
        teamName,
        campaignName,
        failureReason,
        dashboardUrl,
        isAdmin: true,
      }),
    });

    console.log(`[CPM Billing] Pause emails sent for campaign ${campaignId}`);
  } catch (err) {
    console.error(`[CPM Billing] Failed to send pause emails for campaign ${campaignId}:`, err);
  }
}
