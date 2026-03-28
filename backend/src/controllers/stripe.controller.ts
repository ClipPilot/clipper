import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { stripeService } from "../services/stripe.service";
import { stripe, STRIPE_PRICES } from "../config/stripe.config";
import { ENV } from "../config/env";
import { handleControllerError, requireUser } from "../utils/controllerHelpers";

export const createCheckoutSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { teamId, priceId, successUrl, cancelUrl } = req.body;

    if (!teamId || !priceId) {
      return res.status(400).json({ error: "Missing teamId or priceId" });
    }

    const validPrices = Object.values(STRIPE_PRICES);
    if (!validPrices.includes(priceId)) {
      return res.status(400).json({ error: "Invalid price ID" });
    }

    const url = await stripeService.createCheckoutSession(
      parseInt(teamId),
      priceId,
      req.user!.email,
      successUrl || `${req.headers.origin}/dashboard/pricing?success=true`,
      cancelUrl || `${req.headers.origin}/dashboard/pricing?canceled=true`
    );

    return res.json({ url });
  } catch (err) {
    return handleControllerError(res, "Checkout session error", err, "Failed to create checkout session");
  }
};

export const createPortalSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { teamId, returnUrl } = req.body;

    if (!teamId) {
      return res.status(400).json({ error: "Missing teamId" });
    }

    const url = await stripeService.createPortalSession(
      parseInt(teamId),
      returnUrl || `${req.headers.origin}/dashboard/settings`
    );

    return res.json({ url });
  } catch (err) {
    return handleControllerError(res, "Portal session error", err, "Failed to create portal session");
  }
};

export const getSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { teamId } = req.params;

    const subscription = await stripeService.getTeamSubscription(parseInt(teamId));
    const plan = await stripeService.getTeamPlan(parseInt(teamId));

    return res.json({ subscription, plan });
  } catch (err) {
    return handleControllerError(res, "Get subscription error", err, "Failed to get subscription");
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  if (!ENV.STRIPE_WEBHOOK_SECRET) {
    console.error("Stripe webhook secret not configured");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, ENV.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await stripeService.handleCheckoutCompleted(event.data.object);
        break;

      case "checkout.session.async_payment_succeeded":
        console.log("[Webhook] ACH payment succeeded for session:", event.data.object.id);
        await stripeService.handleCheckoutCompleted(event.data.object);
        break;

      case "checkout.session.async_payment_failed":
        console.log("[Webhook] ACH payment failed for session:", event.data.object.id);
        await stripeService.handleAsyncPaymentFailed(event.data.object);
        break;

      case "customer.subscription.created":
        await stripeService.handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await stripeService.handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await stripeService.handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await stripeService.handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await stripeService.handleInvoicePaymentFailed(event.data.object);
        break;

      case "payment_intent.succeeded":
        await stripeService.handlePaymentIntentSucceeded(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err) {
    return handleControllerError(res, "Webhook handler error", err, "Webhook handler failed");
  }
};

export const getPrices = async (_req: Request, res: Response) => {
  return res.json({
    prices: STRIPE_PRICES,
  });
};

export const changePlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { teamId, newPriceId } = req.body;

    if (!teamId || !newPriceId) {
      return res.status(400).json({ error: "Missing teamId or newPriceId" });
    }

    // Only allow changing between Creator, Studio, and Scale
    const validPrices = [STRIPE_PRICES.CREATOR, STRIPE_PRICES.STUDIO, STRIPE_PRICES.SCALE];
    if (!validPrices.includes(newPriceId)) {
      return res.status(400).json({ error: "Invalid plan. Can only change between Creator, Studio, and Scale." });
    }

    const result = await stripeService.changePlan(parseInt(teamId), newPriceId);

    return res.json({
      success: result.success,
      effectiveDate: result.effectiveDate,
      newPlan: result.newPlan,
      message: `Your plan will change to ${result.newPlan} on ${new Date(result.effectiveDate).toLocaleDateString()}.`,
    });
  } catch (err) {
    return handleControllerError(res, "Change plan error", err, "Failed to change plan");
  }
};
