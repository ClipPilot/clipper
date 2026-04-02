import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  handleWebhook,
  getPrices,
  changePlan,
} from "../controllers/stripe.controller";

const router = Router();

/**
 * @openapi
 * /stripe/webhook:
 *   post:
 *     summary: Stripe webhook endpoint
 *     description: |
 *       Handles Stripe webhook events for subscription lifecycle and one-time purchases.
 *       This endpoint receives events from Stripe and processes them accordingly.
 *
 *       Supported events:
 *       - checkout.session.completed (for one-time addon purchases)
 *       - customer.subscription.created
 *       - customer.subscription.updated
 *       - customer.subscription.deleted
 *       - invoice.payment_succeeded
 *       - invoice.payment_failed
 *     tags:
 *       - Stripe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Stripe webhook event payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - received
 *               properties:
 *                 received:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid webhook signature
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Webhook handler error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/webhook", handleWebhook);

/**
 * @openapi
 * /stripe/prices:
 *   get:
 *     summary: Get available Stripe prices
 *     description: |
 *       Returns the configured Stripe price IDs for all subscription plans and addons.
 *
 *       **Subscription Plans** (monthly recurring):
 *       - STUDIO: 500 clips/month
 *       - SCALE: 1000 clips/month
 *
 *       **Addon Packs** (one-time purchase, adds to monthly limit):
 *       - STUDIO_ADDON: +50 clips
 *       - SCALE_ADDON: +100 clips
 *     tags:
 *       - Stripe
 *     responses:
 *       200:
 *         description: Successfully retrieved prices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - prices
 *               properties:
 *                 prices:
 *                   type: object
 *                   properties:
 *                     CREATOR:
 *                       type: string
 *                     STUDIO:
 *                       type: string
 *                     SCALE:
 *                       type: string
 *                     STUDIO_ADDON:
 *                       type: string
 *                     SCALE_ADDON:
 *                       type: string
 */
router.get("/prices", getPrices);

/**
 * @openapi
 * /stripe/checkout:
 *   post:
 *     summary: Create a Stripe checkout session
 *     description: |
 *       Creates a new Stripe checkout session for subscription or one-time addon purchase.
 *       Returns a URL to redirect the user to Stripe's hosted checkout page.
 *
 *       **Subscription plans** (STUDIO, SCALE): Creates a recurring subscription.
 *       **Addon purchases** (STUDIO_ADDON, SCALE_ADDON): Creates a one-time payment
 *       that adds clips to the team's monthly limit. Can be purchased multiple times.
 *     tags:
 *       - Stripe
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - priceId
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID to associate the purchase with
 *                 example: 1
 *               priceId:
 *                 type: string
 *                 description: |
 *                   Stripe price ID for the selected plan or addon.
 *                   - STUDIO/SCALE: Creates a subscription
 *                   - STUDIO_ADDON (+50 clips): One-time purchase
 *                   - SCALE_ADDON (+100 clips): One-time purchase
 *                 example: "price_1SeiLyGu9cYiGgY365Gs60AW"
 *               successUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect after successful payment
 *                 example: "https://app.example.com/dashboard/pricing?success=true"
 *               cancelUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect if user cancels
 *                 example: "https://app.example.com/dashboard/pricing?canceled=true"
 *     responses:
 *       200:
 *         description: Checkout session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - url
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: Stripe checkout URL to redirect the user to
 *                   example: "https://checkout.stripe.com/c/pay/cs_test_..."
 *       400:
 *         description: Invalid request - missing teamId, priceId, or invalid price
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to create checkout session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/checkout", requireAuth, createCheckoutSession);

/**
 * @openapi
 * /stripe/portal:
 *   post:
 *     summary: Create a Stripe billing portal session
 *     description: |
 *       Creates a session for the Stripe Customer Portal where users can manage
 *       their subscription, update payment methods, view invoices, and cancel.
 *     tags:
 *       - Stripe
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID whose subscription to manage
 *                 example: 1
 *               returnUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to return to after portal session
 *                 example: "https://app.example.com/dashboard/settings"
 *     responses:
 *       200:
 *         description: Portal session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - url
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: Stripe customer portal URL
 *                   example: "https://billing.stripe.com/p/session/..."
 *       400:
 *         description: Missing teamId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to create portal session (e.g., no Stripe customer found)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/portal", requireAuth, createPortalSession);

/**
 * @openapi
 * /stripe/subscription/{teamId}:
 *   get:
 *     summary: Get team subscription details
 *     description: |
 *       Retrieves the current subscription status and plan for a team.
 *       Returns null for subscription if the team has no active subscription.
 *     tags:
 *       - Stripe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID to get subscription for
 *         example: 1
 *     responses:
 *       200:
 *         description: Subscription details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - subscription
 *                 - plan
 *               properties:
 *                 subscription:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/Subscription'
 *                     - type: 'null'
 *                   description: Subscription object or null if no subscription
 *                 plan:
 *                   type: string
 *                   enum: [free, studio, scale, enterprise]
 *                   description: Current plan name
 *                   example: "studio"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to get subscription
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/subscription/:teamId", requireAuth, getSubscription);

/**
 * @openapi
 * /stripe/change-plan:
 *   post:
 *     summary: Change subscription plan
 *     description: |
 *       Changes the subscription plan between Studio and Scale.
 *       The change takes effect at the next billing cycle (no proration).
 *       Only team owners can change plans. Enterprise plans cannot be changed.
 *     tags:
 *       - Stripe
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - newPriceId
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID to change the plan for
 *                 example: 1
 *               newPriceId:
 *                 type: string
 *                 description: The Stripe price ID for the new plan (Studio or Scale only)
 *     responses:
 *       200:
 *         description: Plan change scheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - effectiveDate
 *                 - newPlan
 *                 - message
 *               properties:
 *                 success:
 *                   type: boolean
 *                 effectiveDate:
 *                   type: string
 *                   format: date-time
 *                 newPlan:
 *                   type: string
 *                   enum: [creator, studio, scale]
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request or plan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to change plan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/change-plan", requireAuth, changePlan);

export default router;
