import { Router } from "express";
import {
  createApiKeyController,
  listApiKeysController,
  revokeApiKeyController,
} from "../../controllers/apiPlatform.controller";
import { requireAuth } from "../../middleware/auth.middleware";

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

export default router;
