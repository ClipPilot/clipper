import { Router } from "express";
import {
  createApiKeyController,
  listApiKeysController,
  revokeApiKeyController,
  getWalletController,
  createWalletTopUpController,
  getAutoRefillController,
  updateAutoRefillController,
  getUsageLogsController,
  testApiRouteController,
} from "../../controllers/apiPlatform.controller";
import { requireAuth, validateAPIKey } from "../../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /platform/teams/{teamId}/keys:
 *   post:
 *     summary: Create a new API key
 *     description: Generate a new API key for the team. The raw key is returned only once in the response.
 *     tags:
 *       - API Platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: API key created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 key:
 *                   type: string
 *                   description: The raw API key (shown only once)
 *                 key_prefix:
 *                   type: string
 *                 expires_at:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post("/teams/:teamId/keys", requireAuth, createApiKeyController);

/**
 * @openapi
 * /platform/teams/{teamId}/keys:
 *   get:
 *     summary: List all API keys for a team
 *     description: Returns all API keys with their prefix and metadata. Raw keys are never returned.
 *     tags:
 *       - API Platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       key_prefix:
 *                         type: string
 *                       revoked:
 *                         type: boolean
 *                       last_used_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get("/teams/:teamId/keys", requireAuth, listApiKeysController);

/**
 * @openapi
 * /platform/teams/{teamId}/keys/{keyId}:
 *   delete:
 *     summary: Revoke an API key
 *     description: Permanently revokes an API key. This cannot be undone.
 *     tags:
 *       - API Platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: API key revoked
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: API key not found
 */
router.delete("/teams/:teamId/keys/:keyId", requireAuth, revokeApiKeyController);

/**
 * @openapi
 * /platform/teams/{teamId}/wallet:
 *   get:
 *     summary: Get wallet balance
 *     description: Returns the team's API wallet balance and usage totals.
 *     tags:
 *       - API Platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Wallet balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance_cents:
 *                   type: integer
 *                 total_spent_cents:
 *                   type: integer
 *                 total_topped_up_cents:
 *                   type: integer
 *                 active:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get("/teams/:teamId/wallet", requireAuth, getWalletController);

/**
 * @openapi
 * /platform/teams/{teamId}/wallet/topup:
 *   post:
 *     summary: Create a wallet top-up checkout session
 *     description: Creates a Stripe checkout session to add funds to the API wallet. Minimum $5.00.
 *     tags:
 *       - API Platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount_cents
 *             properties:
 *               amount_cents:
 *                 type: integer
 *                 minimum: 500
 *                 description: Amount in cents (500 = $5.00)
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *       400:
 *         description: Invalid amount
 *       401:
 *         description: Unauthorized
 */
router.post("/teams/:teamId/wallet/topup", requireAuth, createWalletTopUpController);

/**
 * @openapi
 * /platform/teams/{teamId}/wallet/auto-refill:
 *   get:
 *     summary: Get auto-refill settings
 *     tags:
 *       - API Platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Auto-refill settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auto_refill:
 *                   type: boolean
 *                 refill_threshold_cents:
 *                   type: integer
 *                 refill_amount_cents:
 *                   type: integer
 *                 has_payment_method:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get("/teams/:teamId/wallet/auto-refill", requireAuth, getAutoRefillController);

/**
 * @openapi
 * /platform/teams/{teamId}/wallet/auto-refill:
 *   put:
 *     summary: Update auto-refill settings
 *     tags:
 *       - API Platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auto_refill:
 *                 type: boolean
 *               refill_threshold_cents:
 *                 type: integer
 *                 minimum: 100
 *               refill_amount_cents:
 *                 type: integer
 *                 minimum: 500
 *     responses:
 *       200:
 *         description: Updated settings
 *       400:
 *         description: No payment method or invalid values
 *       401:
 *         description: Unauthorized
 */
router.put("/teams/:teamId/wallet/auto-refill", requireAuth, updateAutoRefillController);

/**
 * @openapi
 * /platform/teams/{teamId}/usage:
 *   get:
 *     summary: Get API usage logs
 *     tags:
 *       - API Platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Usage logs
 *       401:
 *         description: Unauthorized
 */
router.get("/teams/:teamId/usage", requireAuth, getUsageLogsController);

/**
 * @openapi
 * /platform/v1/test:
 *   get:
 *     summary: Test API key authentication
 *     description: Simple endpoint to verify your API key is working. Requires X-API-Key header.
 *     tags:
 *       - API Platform
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: API key is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: working
 *                 team_id:
 *                   type: integer
 *                 key_name:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Invalid or missing API key
 *       402:
 *         description: Insufficient balance
 *       429:
 *         description: Rate limit exceeded
 */
router.get("/v1/test", validateAPIKey, testApiRouteController);

export default router;
