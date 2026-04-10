import * as Sentry from "@sentry/node";
import {
  stripe,
  STRIPE_PRICES,
  getPlanFromPriceId,
  getClipsLimitForPlan,
  isAddonPrice,
  getAddonClips,
} from "../config/stripe.config";
import { db } from "../db";
import {
  teams,
  subscriptions,
  usageStats,
  teamMembers,
  users,
  apiWalletTopUps,
} from "@clipper/shared-db/src/schema";
import { eq, and, not, sql } from "drizzle-orm";
import { emailNotiService } from "./emailNoti.service";
import { campaignBillingService } from "./massPosting/campaignBilling.service";
import { referralService } from "./referral.service";
import { apiBillingService } from "./apiBilling.service";
import { isAnalyticsPlan, isMainPlatformPlan, getViralityAccountLimit } from "../utils/plans";
import { viralityService } from "./virality/virality.service";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://platform.cuttr.com";

/**
 * Converts a Stripe period timestamp (Unix seconds, Date object, or ISO string)
 * to a JavaScript Date.
 */
const parseDate = (val: any): Date => {
  if (typeof val === "number") {
    return new Date(val * 1000);
  }
  if (val instanceof Date) {
    return val;
  }
  return new Date(val);
};

class StripeService {
  private async getTeamOwner(teamId: number) {
    const [owner] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.first_name,
        lastName: users.last_name,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.user_id, users.id))
      .where(
        and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, "owner")),
      )
      .limit(1);
    return owner;
  }

  /**
   * Fetches the team owner and passes them to the provided email callback.
   * Swallows errors so that a failed email never breaks the main webhook flow.
   */
  private async notifyTeamOwner(
    teamId: number,
    emailFn: (owner: NonNullable<Awaited<ReturnType<StripeService["getTeamOwner"]>>>) => Promise<unknown>,
    errorLabel: string,
  ): Promise<void> {
    try {
      const owner = await this.getTeamOwner(teamId);
      if (!owner) return;
      await emailFn(owner);
    } catch (emailError) {
      console.error(`Failed to ${errorLabel}:`, emailError);
      Sentry.captureException(emailError);
    }
  }

  async getOrCreateCustomer(teamId: number, email: string): Promise<string> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    // If we have a stored customer ID, verify it exists in Stripe
    if (team?.stripe_customer_id) {
      try {
        await stripe.customers.retrieve(team.stripe_customer_id);
        return team.stripe_customer_id;
      } catch (error: any) {
        // Customer doesn't exist (likely test/prod environment mismatch)
        if (error.code === "resource_missing") {
          console.log(
            `Stripe customer ${team.stripe_customer_id} not found, creating new customer for team ${teamId}`,
          );
          // Clear the invalid customer ID and fall through to create a new one
          await db
            .update(teams)
            .set({ stripe_customer_id: null, updated_at: new Date() })
            .where(eq(teams.id, teamId));
        } else {
          throw error;
        }
      }
    }

    const customer = await stripe.customers.create({
      email,
      metadata: { teamId: teamId.toString() },
    });

    await db
      .update(teams)
      .set({ stripe_customer_id: customer.id, updated_at: new Date() })
      .where(eq(teams.id, teamId));

    return customer.id;
  }

  async createCheckoutSession(
    teamId: number,
    priceId: string,
    email: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> {
    const customerId = await this.getOrCreateCustomer(teamId, email);

    // Check if this is an addon (one-time payment) or subscription
    const isAddon = isAddonPrice(priceId);

    if (isAddon) {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        metadata: {
          teamId: teamId.toString(),
          priceId: priceId,
          type: "addon",
        },
      });

      return session.url!;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: { teamId: teamId.toString(), priceId },
      subscription_data: {
        metadata: { teamId: teamId.toString() },
      },
    });

    return session.url!;
  }

  async createPortalSession(
    teamId: number,
    returnUrl: string,
  ): Promise<string> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team?.stripe_customer_id) {
      throw new Error("No Stripe customer found for this team");
    }

    // Verify customer exists in Stripe before creating portal session
    try {
      await stripe.customers.retrieve(team.stripe_customer_id);
    } catch (error: any) {
      if (error.code === "resource_missing") {
        // Clear invalid customer ID
        await db
          .update(teams)
          .set({ stripe_customer_id: null, updated_at: new Date() })
          .where(eq(teams.id, teamId));
        throw new Error(
          "Your billing profile was reset. Please subscribe again from the pricing page.",
        );
      }
      throw error;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: team.stripe_customer_id,
      return_url: returnUrl,
    });

    return session.url;
  }

  async handleSubscriptionCreated(subscription: any): Promise<void> {
    console.log(
      "handleSubscriptionCreated called with:",
      JSON.stringify(subscription, null, 2),
    );

    const previousSubToCancel =
      subscription.metadata?.cancel_previous_subscription;
    if (previousSubToCancel) {
      try {
        console.log(
          `Cancelling previous subscription ${previousSubToCancel} after Enterprise upgrade`,
        );
        await stripe.subscriptions.cancel(previousSubToCancel);

        await db
          .update(subscriptions)
          .set({ status: "canceled", updated_at: new Date() })
          .where(eq(subscriptions.stripe_subscription_id, previousSubToCancel));

        console.log(
          `Successfully cancelled previous subscription ${previousSubToCancel}`,
        );
      } catch (cancelError: any) {
        console.error(
          `Failed to cancel previous subscription ${previousSubToCancel}:`,
          cancelError.message,
        );
        Sentry.captureException(cancelError);
      }
    }

    // Try to get teamId from metadata, or fall back to looking up by customer
    let teamId = parseInt(subscription.metadata?.teamId);

    if (isNaN(teamId)) {
      // Fallback: look up team by stripe_customer_id
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.stripe_customer_id, subscription.customer))
        .limit(1);

      if (!team) {
        console.error(
          `No team found for subscription ${subscription.id}, customer ${subscription.customer}`,
        );
        return;
      }
      teamId = team.id;
    }

    const priceId = subscription.items?.data?.[0]?.price?.id;
    if (!priceId) {
      console.error(`No price found in subscription ${subscription.id}`);
      return;
    }
    const metadataPlan = subscription.metadata?.plan;
    const plan =
      metadataPlan === "enterprise"
        ? "enterprise"
        : getPlanFromPriceId(priceId);

    const subscriptionItem = subscription.items?.data?.[0];
    const periodStartTs =
      subscriptionItem?.current_period_start ||
      subscription.start_date ||
      subscription.billing_cycle_anchor;
    const periodEndTs = subscriptionItem?.current_period_end;

    console.log(
      `Period timestamps - start: ${periodStartTs} (type: ${typeof periodStartTs}), end: ${periodEndTs} (type: ${typeof periodEndTs})`,
    );

    if (!periodStartTs || !periodEndTs) {
      console.error(`Missing period dates in subscription ${subscription.id}`);
      return;
    }

    const periodStart = parseDate(periodStartTs);
    const periodEnd = parseDate(periodEndTs);

    // Validate parsed dates
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      console.error(
        `Invalid period dates in subscription ${subscription.id}: start=${periodStart}, end=${periodEnd}`,
      );
      return;
    }

    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripe_subscription_id, subscription.id))
      .limit(1);

    if (existingSub) {
      // Update existing subscription instead of inserting
      await db
        .update(subscriptions)
        .set({
          status: subscription.status,
          plan,
          price_id: priceId,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          updated_at: new Date(),
        })
        .where(eq(subscriptions.stripe_subscription_id, subscription.id));
    } else {
      await db.insert(subscriptions).values({
        team_id: teamId,
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        plan,
        price_id: priceId,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      });
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    await db
      .update(teams)
      .set({ plan, updated_at: new Date() })
      .where(eq(teams.id, teamId));

    if (!isAnalyticsPlan(plan)) {
      const clipsLimit =
        plan === "enterprise" && team?.enterprise_clip_limit
          ? team.enterprise_clip_limit
          : getClipsLimitForPlan(plan);

      await db
        .update(usageStats)
        .set({
          limit: clipsLimit,
          clips_created: 0,
          resets_date: periodEnd,
          updated_at: new Date(),
        })
        .where(eq(usageStats.team_id, teamId));

      console.log(
        `Subscription ${subscription.id} created/updated for team ${teamId}, plan: ${plan}, clips: ${clipsLimit}`,
      );
    } else {
      console.log(
        `Subscription ${subscription.id} created/updated for team ${teamId}, plan: ${plan} (analytics — usage stats unchanged)`,
      );
    }

    await this.enforceSubscriptionExclusivity(teamId, plan, subscription.id);

    try {
      await referralService.activateReferral(teamId, plan);
    } catch (refError) {
      console.error("Failed to activate referral:", refError);
      Sentry.captureException(refError);
    }

    if (!isAnalyticsPlan(plan)) {
      const clipsLimit =
        plan === "enterprise" && team?.enterprise_clip_limit
          ? team.enterprise_clip_limit
          : getClipsLimitForPlan(plan);

      const [teamForEmail] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      if (teamForEmail) {
        await this.notifyTeamOwner(
          teamId,
          (owner) =>
            emailNotiService.sendSubscriptionWelcome(owner.email, {
              userName: owner.firstName,
              planName: plan.charAt(0).toUpperCase() + plan.slice(1),
              teamName: teamForEmail.name,
              clipsLimit: clipsLimit,
              dashboardUrl: `${FRONTEND_URL}/dashboard`,
            }),
          "send subscription welcome email",
        );
      }
    }
  }

  async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripe_subscription_id, subscription.id))
      .limit(1);

    if (!existingSub) {
      return this.handleSubscriptionCreated(subscription);
    }

    const subscriptionItem = subscription.items?.data?.[0];
    const priceId = subscriptionItem?.price?.id;
    if (!priceId) {
      console.error(`No price found in subscription update ${subscription.id}`);
      return;
    }

    // Get dates from subscription items (Stripe puts them there, not at root level)
    const periodStartTs =
      subscriptionItem?.current_period_start ||
      subscription.start_date ||
      subscription.billing_cycle_anchor;
    const periodEndTs = subscriptionItem?.current_period_end;

    if (!periodStartTs || !periodEndTs) {
      console.error(
        `Missing period dates in subscription update ${subscription.id}`,
      );
      return;
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, existingSub.team_id))
      .limit(1);

    // Check metadata for enterprise plan (dynamic prices aren't in getPlanFromPriceId)
    const metadataPlan = subscription.metadata?.plan;
    let plan =
      metadataPlan === "enterprise"
        ? "enterprise"
        : getPlanFromPriceId(priceId);

    if (plan === "free" && team && team.plan !== "free") {
      console.log(
        `Unrecognized price ID ${priceId}, preserving existing plan: ${team.plan}`,
      );
      plan = team.plan;
    }

    const clipsLimit =
      plan === "enterprise" && team?.enterprise_clip_limit
        ? team.enterprise_clip_limit
        : getClipsLimitForPlan(plan);
    const newPeriodStart = parseDate(periodStartTs);
    const newPeriodEnd = parseDate(periodEndTs);

    // Validate parsed dates
    if (isNaN(newPeriodStart.getTime()) || isNaN(newPeriodEnd.getTime())) {
      console.error(
        `Invalid period dates in subscription update ${subscription.id}`,
      );
      return;
    }

    // Check if billing period changed (new month started)
    const periodChanged =
      existingSub.current_period_start?.getTime() !== newPeriodStart.getTime();

    await db
      .update(subscriptions)
      .set({
        status: subscription.status,
        plan,
        price_id: priceId,
        current_period_start: newPeriodStart,
        current_period_end: newPeriodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        updated_at: new Date(),
      })
      .where(eq(subscriptions.stripe_subscription_id, subscription.id));

    await db
      .update(teams)
      .set({ plan, updated_at: new Date() })
      .where(eq(teams.id, existingSub.team_id));

    if (periodChanged) {
      await db
        .update(usageStats)
        .set({
          limit: clipsLimit,
          clips_created: 0,
          resets_date: newPeriodEnd,
          updated_at: new Date(),
        })
        .where(eq(usageStats.team_id, existingSub.team_id));

      try {
        const bonusClipsApplied =
          await referralService.applyBonusClipsOnRenewal(existingSub.team_id);
        if (bonusClipsApplied > 0) {
          console.log(
            `Applied ${bonusClipsApplied} referral bonus clips to team ${existingSub.team_id}`,
          );
        }
      } catch (refError) {
        console.error("Failed to apply referral bonus clips:", refError);
        Sentry.captureException(refError);
      }

      try {
        const percentOff = await referralService.getAccumulatedPercentOff(
          existingSub.team_id,
        );
        if (percentOff > 0 && team?.stripe_customer_id) {
          await this.applyReferralDiscountToSubscription(
            team.stripe_customer_id,
            subscription.id,
            percentOff,
          );
          console.log(
            `Applied ${percentOff}% referral discount to team ${existingSub.team_id}`,
          );
        }
      } catch (discountError) {
        console.error("Failed to apply referral discount:", discountError);
        Sentry.captureException(discountError);
      }
    } else {
      await db
        .update(usageStats)
        .set({
          resets_date: newPeriodEnd,
          updated_at: new Date(),
        })
        .where(eq(usageStats.team_id, existingSub.team_id));
    }

    console.log(
      `Subscription ${subscription.id} updated for team ${existingSub.team_id}`,
    );
  }

  private async enforceSubscriptionExclusivity(
    teamId: number,
    newPlan: string,
    newSubscriptionId: string,
  ): Promise<void> {
    const isNewAnalytics = isAnalyticsPlan(newPlan);
    const isNewMain = isMainPlatformPlan(newPlan);
    if (!isNewAnalytics && !isNewMain) return;

    const conflictingSubs = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.team_id, teamId),
          not(eq(subscriptions.stripe_subscription_id, newSubscriptionId)),
          not(eq(subscriptions.status, "canceled")),
        ),
      );

    for (const sub of conflictingSubs) {
      const subPlan = getPlanFromPriceId(sub.price_id);
      const isConflictingCrossPlan =
        (isNewAnalytics && isMainPlatformPlan(subPlan)) ||
        (isNewMain && isAnalyticsPlan(subPlan));
      const isAnalyticsSwitch = isNewAnalytics && isAnalyticsPlan(subPlan);

      if (!isConflictingCrossPlan && !isAnalyticsSwitch) continue;

      try {
        if (isAnalyticsSwitch) {
          console.log(`[Exclusivity] Prorating analytics switch: ${subPlan} → ${newPlan} (cancelling old sub ${sub.stripe_subscription_id}, new sub ${newSubscriptionId} already created by Stripe)`);
          await stripe.subscriptions.cancel(sub.stripe_subscription_id, { prorate: true });
        } else {
          console.log(`[Exclusivity] Cancelling ${subPlan} subscription ${sub.stripe_subscription_id} (conflicts with ${newPlan})`);
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        }
        await db
          .update(subscriptions)
          .set({ status: "canceled", updated_at: new Date() })
          .where(eq(subscriptions.stripe_subscription_id, sub.stripe_subscription_id));
      } catch (err: any) {
        console.error(`[Exclusivity] Failed to cancel ${sub.stripe_subscription_id}:`, err.message);
        Sentry.captureException(err);
      }
    }

    if (isNewMain) {
      await viralityService.reactivateAllAccounts(teamId);
    }

    if (isNewAnalytics) {
      const limit = getViralityAccountLimit(newPlan);
      if (limit !== -1) {
        await viralityService.deactivateExcessAccounts(teamId, limit);
      }
    }
  }

  async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripe_subscription_id, subscription.id))
      .limit(1);

    if (!existingSub) return;

    await db
      .update(subscriptions)
      .set({ status: "canceled", updated_at: new Date() })
      .where(eq(subscriptions.stripe_subscription_id, subscription.id));

    const [otherSubscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.team_id, existingSub.team_id),
          not(eq(subscriptions.stripe_subscription_id, subscription.id)),
          not(eq(subscriptions.status, "canceled")),
        ),
      )
      .limit(1);

    if (otherSubscription) {
      console.log(
        `[Subscription Deleted] Team ${existingSub.team_id} has another subscription (${otherSubscription.stripe_subscription_id}, status: ${otherSubscription.status}), not downgrading to free`,
      );
      return;
    }

    await db
      .update(teams)
      .set({ plan: "free", updated_at: new Date() })
      .where(eq(teams.id, existingSub.team_id));

    if (isAnalyticsPlan(existingSub.plan)) {
      await viralityService.deactivateExcessAccounts(existingSub.team_id, 0);
    } else {
      await db
        .update(usageStats)
        .set({
          limit: 0,
          clips_created: 0,
          updated_at: new Date(),
        })
        .where(eq(usageStats.team_id, existingSub.team_id));
    }

    const [teamForEmail] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, existingSub.team_id))
      .limit(1);

    if (teamForEmail) {
      const endDate = existingSub.current_period_end
        ? new Date(existingSub.current_period_end).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "soon";

      await this.notifyTeamOwner(
        existingSub.team_id,
        (owner) =>
          emailNotiService.sendSubscriptionCancelled(owner.email, {
            userName: owner.firstName,
            teamName: teamForEmail.name,
            endDate,
            reactivateUrl: `${FRONTEND_URL}/dashboard/pricing`,
          }),
        "send subscription cancelled email",
      );
    }
  }

  async handleCheckoutCompleted(session: any): Promise<void> {
    // Handle subscription checkout (give immediate access even for ACH)
    if (session.mode === "subscription") {
      await this.handleSubscriptionCheckout(session);
      return;
    }

    if (session.metadata?.type !== "addon") {
      return;
    }

    // For ACH/bank transfers, payment_status is "unpaid" initially
    // Only process when payment is confirmed (async_payment_succeeded will call this again)
    if (session.payment_status !== "paid") {
      console.log(
        `[Checkout] Skipping addon - payment not yet confirmed (status: ${session.payment_status})`,
      );
      return;
    }

    const teamId = parseInt(session.metadata.teamId);
    const priceId = session.metadata.priceId;

    if (!teamId || !priceId) {
      console.error("Missing teamId or priceId in checkout session metadata");
      return;
    }

    const addonClips = getAddonClips(priceId);
    if (addonClips === 0) {
      console.error(`Unknown addon price: ${priceId}`);
      return;
    }

    const [updated] = await db
      .update(teams)
      .set({
        addon_clips_remaining: sql`COALESCE(${teams.addon_clips_remaining}, 0) + ${addonClips}`,
        updated_at: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning({ addon_clips_remaining: teams.addon_clips_remaining });

    if (!updated) {
      console.error(`No team found for team ${teamId}`);
      return;
    }

    console.log(
      `Added ${addonClips} addon clips to team ${teamId}. New addon total: ${updated.addon_clips_remaining}`,
    );
  }

  async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    const metadataType = paymentIntent.metadata?.type;

    // Handle campaign top-ups
    if (metadataType === "campaign_topup") {
      await this.handleCampaignTopUp(paymentIntent);
      return;
    }

    if (metadataType !== "api_topup") {
      return;
    }

    const teamId = parseInt(paymentIntent.metadata.teamId);
    const amountCents = parseInt(paymentIntent.metadata.amount_cents);

    if (!teamId || !amountCents) {
      console.error("[PaymentIntent] Missing teamId or amount_cents in metadata");
      return;
    }

    // Idempotency: check if already credited
    const [existing] = await db
      .select({ id: apiWalletTopUps.id })
      .from(apiWalletTopUps)
      .where(eq(apiWalletTopUps.stripe_payment_intent_id, paymentIntent.id))
      .limit(1);

    if (existing) {
      console.log(`[PaymentIntent] Already credited PI ${paymentIntent.id}, skipping`);
      return;
    }

    const { balanceCents } = await apiBillingService.topUp(
      teamId,
      amountCents,
      paymentIntent.id,
    );

    // Save payment method for auto-refill
    if (paymentIntent.payment_method && typeof paymentIntent.payment_method === "string") {
      try {
        await apiBillingService.savePaymentMethod(teamId, paymentIntent.payment_method);
      } catch (err) {
        console.error("[PaymentIntent] Failed to save payment method:", err);
      }
    }

    console.log(
      `[PaymentIntent] Added $${(amountCents / 100).toFixed(2)} to team ${teamId}. New balance: $${(balanceCents / 100).toFixed(2)}`,
    );
  }

  private async handleCampaignTopUp(paymentIntent: any): Promise<void> {
    const teamId = parseInt(paymentIntent.metadata.teamId);
    const campaignId = parseInt(paymentIntent.metadata.campaignId);
    const amountCents = parseInt(paymentIntent.metadata.amount_cents);

    if (!teamId || !campaignId || !amountCents) {
      console.error("[CampaignTopUp] Missing metadata fields");
      return;
    }

    const already = await campaignBillingService.isTopUpCredited(
      campaignId,
      paymentIntent.id,
    );
    if (already) {
      console.log(`[CampaignTopUp] Already credited PI ${paymentIntent.id}, skipping`);
      return;
    }

    const { balanceCents } = await campaignBillingService.topUp(
      campaignId,
      teamId,
      amountCents,
      paymentIntent.id,
    );

    console.log(
      `[CampaignTopUp] Added $${(amountCents / 100).toFixed(2)} to campaign ${campaignId}. New balance: $${(balanceCents / 100).toFixed(2)}`,
    );
  }

  async handleSubscriptionCheckout(session: any): Promise<void> {
    const teamId = session.metadata?.teamId
      ? parseInt(session.metadata.teamId)
      : null;
    const isPaid = session.payment_status === "paid";
    let priceId =
      session.line_items?.data?.[0]?.price?.id || session.metadata?.priceId;
    const metadataPlan = session.metadata?.plan;

    // Fallback: fetch subscription from Stripe if priceId not in session
    if (!priceId && session.subscription) {
      try {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        priceId = sub.items?.data?.[0]?.price?.id;
        console.log(
          `[Subscription Checkout] Resolved priceId from Stripe subscription: ${priceId}`,
        );
      } catch (err) {
        console.error(
          `[Subscription Checkout] Failed to fetch subscription ${session.subscription}:`,
          err,
        );
      }
    }

    const plan =
      metadataPlan === "enterprise"
        ? "enterprise"
        : getPlanFromPriceId(priceId);

    console.log(
      `[Subscription Checkout] Team: ${teamId}, Plan: ${plan}, PriceId: ${priceId}, Payment: ${session.payment_status}, Session: ${session.id}`,
    );

    if (!teamId) {
      console.error("[Subscription Checkout] No teamId in session metadata");
      return;
    }

    // Can't determine plan — let subscription.created handle it
    if (plan === "free" && !priceId) {
      console.log(
        "[Subscription Checkout] Could not determine plan, letting subscription.created handle it",
      );
      return;
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      console.error(`[Subscription Checkout] Team ${teamId} not found`);
      return;
    }

    // Already on correct plan (subscription.created may have fired first)
    if (team.plan !== "free" && team.plan === plan) {
      console.log(
        `[Subscription Checkout] Team ${teamId} already on ${plan}, skipping`,
      );
      return;
    }

    // Don't downgrade a paid team
    if (plan === "free" && team.plan !== "free") {
      console.log(
        `[Subscription Checkout] Team ${teamId} already on ${team.plan}, not downgrading`,
      );
      return;
    }
    const clipsLimit =
      plan === "enterprise" && team.enterprise_clip_limit
        ? team.enterprise_clip_limit
        : getClipsLimitForPlan(plan);

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Activate plan immediately (even for ACH with pending payment)
    await db
      .update(teams)
      .set({
        plan,
        updated_at: new Date(),
      })
      .where(eq(teams.id, teamId));

    await db
      .update(usageStats)
      .set({
        limit: clipsLimit,
        clips_created: 0,
        resets_date: periodEnd,
        updated_at: new Date(),
      })
      .where(eq(usageStats.team_id, teamId));

    console.log(
      `[Subscription Checkout] Team ${teamId} activated on ${plan} with ${clipsLimit} clips (payment ${isPaid ? "confirmed" : "pending ACH"})`,
    );

    // Send welcome email
    await this.notifyTeamOwner(
      teamId,
      (owner) =>
        emailNotiService.sendSubscriptionWelcome(owner.email, {
          userName: owner.firstName,
          planName: plan.charAt(0).toUpperCase() + plan.slice(1),
          teamName: team.name,
          clipsLimit,
          dashboardUrl: `${FRONTEND_URL}/dashboard`,
        }),
      "[Subscription Checkout] send welcome email",
    );
  }

  async handleAsyncPaymentFailed(session: any): Promise<void> {
    const teamId = session.metadata?.teamId
      ? parseInt(session.metadata.teamId)
      : null;
    const customerEmail = session.customer_details?.email;
    const amount = session.amount_total
      ? `$${(session.amount_total / 100).toFixed(2)}`
      : "your payment";
    const isSubscription = session.mode === "subscription";

    console.error(
      `[ACH Payment Failed] Team: ${teamId}, Email: ${customerEmail}, Subscription: ${isSubscription}, Session: ${session.id}`,
    );

    if (!teamId) {
      console.error("[ACH Payment Failed] No teamId in session metadata");
      return;
    }

    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      if (!team) {
        console.error(`[ACH Payment Failed] Team ${teamId} not found`);
        return;
      }

      // Revoke plan access if this was a subscription ACH payment that failed
      if (isSubscription && team.plan !== "free") {
        console.log(
          `[ACH Payment Failed] Revoking ${team.plan} access for team ${teamId}`,
        );

        await db
          .update(teams)
          .set({
            plan: "free",
            updated_at: new Date(),
          })
          .where(eq(teams.id, teamId));

        await db
          .update(usageStats)
          .set({
            limit: 0,
            updated_at: new Date(),
          })
          .where(eq(usageStats.team_id, teamId));

        console.log(
          `[ACH Payment Failed] Team ${teamId} reverted to free plan`,
        );
      }

      const owner = await this.getTeamOwner(teamId);
      if (!owner) {
        console.error(`[ACH Payment Failed] No owner found for team ${teamId}`);
        return;
      }

      await emailNotiService.sendPaymentFailed(owner.email, {
        userName: owner.firstName,
        teamName: team.name,
        amount,
        retryDate: "N/A (ACH bank transfer failed)",
        updatePaymentUrl: `${FRONTEND_URL}/dashboard/settings`,
      });

      console.log(`[ACH Payment Failed] Notification sent to ${owner.email}`);
    } catch (error) {
      console.error("[ACH Payment Failed] Error sending notification:", error);
      Sentry.captureException(error);
    }
  }

  async getTeamSubscription(teamId: number) {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.team_id, teamId))
      .limit(1);
    return sub || null;
  }

  async getTeamPlan(teamId: number): Promise<string> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    return team?.plan || "free";
  }

  async changePlan(
    teamId: number,
    newPriceId: string,
  ): Promise<{
    success: boolean;
    effectiveDate: Date;
    newPlan: string;
  }> {
    // Get current subscription
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.team_id, teamId))
      .limit(1);

    if (!sub?.stripe_subscription_id || sub.status !== "active") {
      throw new Error("No active subscription found");
    }

    // Get the current subscription from Stripe to find the item ID
    const stripeSubscription = await stripe.subscriptions.retrieve(
      sub.stripe_subscription_id,
    );
    const subscriptionItemId = stripeSubscription.items.data[0]?.id;

    if (!subscriptionItemId) {
      throw new Error("Subscription item not found");
    }

    // Update subscription with new price, effective at next billing cycle
    // Using proration_behavior: 'none' means the change takes effect at renewal
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
      proration_behavior: "none",
    });

    const newPlan = getPlanFromPriceId(newPriceId);
    const effectiveDate = sub.current_period_end || new Date();

    console.log(
      `Plan change scheduled for team ${teamId}: ${sub.plan} -> ${newPlan}, effective ${effectiveDate}`,
    );

    return {
      success: true,
      effectiveDate,
      newPlan,
    };
  }

  async applyReferralDiscountToSubscription(
    customerId: string,
    subscriptionId: string,
    percentOff: number,
  ): Promise<void> {
    const couponId = `referral_${customerId}_${Math.round(percentOff)}`;

    let coupon;
    try {
      coupon = await stripe.coupons.retrieve(couponId);
      if (coupon.percent_off !== percentOff) {
        await stripe.coupons.del(couponId);
        throw new Error("Recreate coupon");
      }
    } catch {
      coupon = await stripe.coupons.create({
        id: couponId,
        percent_off: Math.min(percentOff, 100),
        duration: "forever",
        name: `Referral Discount ${percentOff}%`,
      });
    }

    await stripe.subscriptions.update(subscriptionId, {
      discounts: [{ coupon: coupon.id }],
    });
  }

  async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    if (!invoice.subscription) return;

    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripe_subscription_id, invoice.subscription))
      .limit(1);

    if (!existingSub) return;

    const [teamForEmail] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, existingSub.team_id))
      .limit(1);

    if (teamForEmail) {
      const amount = invoice.amount_paid
        ? `$${(invoice.amount_paid / 100).toFixed(2)}`
        : "N/A";
      const renewalDate = existingSub.current_period_end
        ? new Date(existingSub.current_period_end).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "N/A";

      await this.notifyTeamOwner(
        existingSub.team_id,
        (owner) =>
          emailNotiService.sendSubscriptionRenewal(owner.email, {
            userName: owner.firstName,
            teamName: teamForEmail.name,
            planName:
              existingSub.plan.charAt(0).toUpperCase() +
              existingSub.plan.slice(1),
            amount,
            renewalDate,
            manageUrl: `${FRONTEND_URL}/dashboard/settings`,
          }),
        "send renewal email",
      );
    }
  }

  async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    if (!invoice.subscription) return;

    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripe_subscription_id, invoice.subscription))
      .limit(1);

    if (!existingSub) return;

    const [teamForEmail] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, existingSub.team_id))
      .limit(1);

    if (teamForEmail) {
      const amount = invoice.amount_due
        ? `$${(invoice.amount_due / 100).toFixed(2)}`
        : "N/A";
      const retryDate = invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString(
            "en-US",
            {
              month: "long",
              day: "numeric",
              year: "numeric",
            },
          )
        : "soon";

      await this.notifyTeamOwner(
        existingSub.team_id,
        (owner) =>
          emailNotiService.sendPaymentFailed(owner.email, {
            userName: owner.firstName,
            teamName: teamForEmail.name,
            amount,
            retryDate,
            updatePaymentUrl: `${FRONTEND_URL}/dashboard/settings`,
          }),
        "send payment failed email",
      );
    }
  }
}

export const stripeService = new StripeService();

export async function applyReferralDiscount(
  teamId: number,
  percentOff: number,
): Promise<void> {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team?.stripe_customer_id) {
    console.log(`Team ${teamId} has no Stripe customer, skipping discount`);
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.team_id, teamId))
    .limit(1);

  if (!sub?.stripe_subscription_id || sub.status !== "active") {
    console.log(`Team ${teamId} has no active subscription, skipping discount`);
    return;
  }

  await stripeService.applyReferralDiscountToSubscription(
    team.stripe_customer_id,
    sub.stripe_subscription_id,
    percentOff,
  );

  console.log(`Applied ${percentOff}% discount to team ${teamId} subscription`);
}
