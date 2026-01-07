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
} from "@clipper/shared-db/src/schema";
import { eq, and } from "drizzle-orm";
import { emailNotiService } from "./emailNoti.service";
import { referralService } from "./referral.service";
import { affiliateService } from "./affiliate.service";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://platform.cuttr.com";

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
        and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, "owner"))
      )
      .limit(1);
    return owner;
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
            `Stripe customer ${team.stripe_customer_id} not found, creating new customer for team ${teamId}`
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
    cancelUrl: string
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
      metadata: { teamId: teamId.toString() },
      subscription_data: {
        metadata: { teamId: teamId.toString() },
      },
    });

    return session.url!;
  }

  async createPortalSession(
    teamId: number,
    returnUrl: string
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
          "Your billing profile was reset. Please subscribe again from the pricing page."
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
      JSON.stringify(subscription, null, 2)
    );

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
          `No team found for subscription ${subscription.id}, customer ${subscription.customer}`
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

    // Check metadata for enterprise plan (dynamic prices aren't in getPlanFromPriceId)
    const metadataPlan = subscription.metadata?.plan;
    const plan = metadataPlan === "enterprise" ? "enterprise" : getPlanFromPriceId(priceId);

    // Get dates from subscription items (Stripe puts them there, not at root level)
    const subscriptionItem = subscription.items?.data?.[0];
    const periodStartTs =
      subscriptionItem?.current_period_start ||
      subscription.start_date ||
      subscription.billing_cycle_anchor;
    const periodEndTs = subscriptionItem?.current_period_end;

    console.log(
      `Period timestamps - start: ${periodStartTs} (type: ${typeof periodStartTs}), end: ${periodEndTs} (type: ${typeof periodEndTs})`
    );

    if (!periodStartTs || !periodEndTs) {
      console.error(`Missing period dates in subscription ${subscription.id}`);
      return;
    }

    // Handle both Unix timestamps (numbers) and Date strings
    const parseDate = (val: any): Date => {
      if (typeof val === "number") {
        return new Date(val * 1000); // Unix timestamp in seconds
      }
      if (val instanceof Date) {
        return val;
      }
      return new Date(val); // Try parsing as string
    };

    const periodStart = parseDate(periodStartTs);
    const periodEnd = parseDate(periodEndTs);

    // Validate parsed dates
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      console.error(
        `Invalid period dates in subscription ${subscription.id}: start=${periodStart}, end=${periodEnd}`
      );
      return;
    }

    // Check if subscription already exists (upsert logic)
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

    const clipsLimit = plan === "enterprise" && team?.enterprise_clip_limit
      ? team.enterprise_clip_limit
      : getClipsLimitForPlan(plan);

    await db
      .update(teams)
      .set({ plan, updated_at: new Date() })
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
      `Subscription ${subscription.id} created/updated for team ${teamId}, plan: ${plan}, clips: ${clipsLimit}`
    );

    try {
      await referralService.activateReferral(teamId, plan);
    } catch (refError) {
      console.error("Failed to activate referral:", refError);
    }

    try {
      await affiliateService.activateAffiliate(teamId, plan);
    } catch (affError) {
      console.error("Failed to activate affiliate:", affError);
    }

    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
      const owner = await this.getTeamOwner(teamId);

      if (owner && team) {
        await emailNotiService.sendSubscriptionWelcome(owner.email, {
          userName: owner.firstName,
          planName: plan.charAt(0).toUpperCase() + plan.slice(1),
          teamName: team.name,
          clipsLimit: clipsLimit,
          dashboardUrl: `${FRONTEND_URL}/dashboard`,
        });
      }
    } catch (emailError) {
      console.error("Failed to send subscription welcome email:", emailError);
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
        `Missing period dates in subscription update ${subscription.id}`
      );
      return;
    }

    // Handle both Unix timestamps (numbers) and Date strings
    const parseDate = (val: any): Date => {
      if (typeof val === "number") {
        return new Date(val * 1000);
      }
      if (val instanceof Date) {
        return val;
      }
      return new Date(val);
    };

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, existingSub.team_id))
      .limit(1);

    // Check metadata for enterprise plan (dynamic prices aren't in getPlanFromPriceId)
    const metadataPlan = subscription.metadata?.plan;
    let plan = metadataPlan === "enterprise" ? "enterprise" : getPlanFromPriceId(priceId);

    if (plan === "free" && team && team.plan !== "free") {
      console.log(
        `Unrecognized price ID ${priceId}, preserving existing plan: ${team.plan}`
      );
      plan = team.plan;
    }

    const clipsLimit = plan === "enterprise" && team?.enterprise_clip_limit
      ? team.enterprise_clip_limit
      : getClipsLimitForPlan(plan);
    const newPeriodStart = parseDate(periodStartTs);
    const newPeriodEnd = parseDate(periodEndTs);

    // Validate parsed dates
    if (isNaN(newPeriodStart.getTime()) || isNaN(newPeriodEnd.getTime())) {
      console.error(
        `Invalid period dates in subscription update ${subscription.id}`
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
        const bonusClipsApplied = await referralService.applyBonusClipsOnRenewal(existingSub.team_id);
        if (bonusClipsApplied > 0) {
          console.log(`Applied ${bonusClipsApplied} referral bonus clips to team ${existingSub.team_id}`);
        }
      } catch (refError) {
        console.error("Failed to apply referral bonus clips:", refError);
      }

      try {
        const percentOff = await referralService.getAccumulatedPercentOff(existingSub.team_id);
        if (percentOff > 0 && team?.stripe_customer_id) {
          await this.applyReferralDiscountToSubscription(team.stripe_customer_id, subscription.id, percentOff);
          console.log(`Applied ${percentOff}% referral discount to team ${existingSub.team_id}`);
        }
      } catch (discountError) {
        console.error("Failed to apply referral discount:", discountError);
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
      `Subscription ${subscription.id} updated for team ${existingSub.team_id}`
    );
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

    await db
      .update(teams)
      .set({ plan: "free", updated_at: new Date() })
      .where(eq(teams.id, existingSub.team_id));

    await db
      .update(usageStats)
      .set({
        limit: 3,
        clips_created: 3,
        updated_at: new Date(),
      })
      .where(eq(usageStats.team_id, existingSub.team_id));

    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, existingSub.team_id))
        .limit(1);
      const owner = await this.getTeamOwner(existingSub.team_id);

      if (owner && team) {
        const endDate = existingSub.current_period_end
          ? new Date(existingSub.current_period_end).toLocaleDateString(
              "en-US",
              {
                month: "long",
                day: "numeric",
                year: "numeric",
              }
            )
          : "soon";

        await emailNotiService.sendSubscriptionCancelled(owner.email, {
          userName: owner.firstName,
          teamName: team.name,
          endDate,
          reactivateUrl: `${FRONTEND_URL}/dashboard/pricing`,
        });
      }
    } catch (emailError) {
      console.error("Failed to send subscription cancelled email:", emailError);
    }
  }

  async handleCheckoutCompleted(session: any): Promise<void> {
    // Only handle addon purchases (one-time payments)
    if (session.metadata?.type !== "addon") {
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

    // Get current team
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      console.error(`No team found for team ${teamId}`);
      return;
    }

    // Add addon clips to the persistent addon pool (never expires)
    const newAddonTotal = (team.addon_clips_remaining || 0) + addonClips;

    await db
      .update(teams)
      .set({
        addon_clips_remaining: newAddonTotal,
        updated_at: new Date(),
      })
      .where(eq(teams.id, teamId));

    console.log(
      `Added ${addonClips} addon clips to team ${teamId}. New addon total: ${newAddonTotal}`
    );
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

  async changePlan(teamId: number, newPriceId: string): Promise<{
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
    const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const subscriptionItemId = stripeSubscription.items.data[0]?.id;

    if (!subscriptionItemId) {
      throw new Error("Subscription item not found");
    }

    // Update subscription with new price, effective at next billing cycle
    // Using proration_behavior: 'none' means the change takes effect at renewal
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{
        id: subscriptionItemId,
        price: newPriceId,
      }],
      proration_behavior: "none",
    });

    const newPlan = getPlanFromPriceId(newPriceId);
    const effectiveDate = sub.current_period_end || new Date();

    console.log(`Plan change scheduled for team ${teamId}: ${sub.plan} -> ${newPlan}, effective ${effectiveDate}`);

    return {
      success: true,
      effectiveDate,
      newPlan,
    };
  }

  async applyReferralDiscountToSubscription(
    customerId: string,
    subscriptionId: string,
    percentOff: number
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

    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, existingSub.team_id))
        .limit(1);
      const owner = await this.getTeamOwner(existingSub.team_id);

      if (owner && team) {
        const amount = invoice.amount_paid
          ? `$${(invoice.amount_paid / 100).toFixed(2)}`
          : "N/A";
        const renewalDate = existingSub.current_period_end
          ? new Date(existingSub.current_period_end).toLocaleDateString(
              "en-US",
              {
                month: "long",
                day: "numeric",
                year: "numeric",
              }
            )
          : "N/A";

        await emailNotiService.sendSubscriptionRenewal(owner.email, {
          userName: owner.firstName,
          teamName: team.name,
          planName:
            existingSub.plan.charAt(0).toUpperCase() +
            existingSub.plan.slice(1),
          amount,
          renewalDate,
          manageUrl: `${FRONTEND_URL}/dashboard/settings`,
        });
      }
    } catch (emailError) {
      console.error("Failed to send renewal email:", emailError);
    }

    try {
      const amountInDollars = (invoice.amount_paid || 0) / 100;
      if (amountInDollars > 0) {
        await affiliateService.recordCommission(
          existingSub.team_id,
          invoice.id,
          amountInDollars
        );
      }
    } catch (affError) {
      console.error("Failed to record affiliate commission:", affError);
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

    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, existingSub.team_id))
        .limit(1);
      const owner = await this.getTeamOwner(existingSub.team_id);

      if (owner && team) {
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
              }
            )
          : "soon";

        await emailNotiService.sendPaymentFailed(owner.email, {
          userName: owner.firstName,
          teamName: team.name,
          amount,
          retryDate,
          updatePaymentUrl: `${FRONTEND_URL}/dashboard/settings`,
        });
      }
    } catch (emailError) {
      console.error("Failed to send payment failed email:", emailError);
    }
  }
}

export const stripeService = new StripeService();

export async function applyReferralDiscount(teamId: number, percentOff: number): Promise<void> {
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
    percentOff
  );

  console.log(`Applied ${percentOff}% discount to team ${teamId} subscription`);
}
