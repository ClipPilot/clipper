import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  listAccountsController,
  addAccountController,
  getAccountController,
  deleteAccountController,
  syncAccountController,
  getPostsController,
  getDashboardController,
  listCompetitorsController,
  createCompetitorController,
  getCompetitorController,
  deleteCompetitorController,
  updateCompetitorController,
} from "../controllers/virality.controller";

const router = Router();

/**
 * @openapi
 * /virality/{teamId}/accounts:
 *   get:
 *     summary: List all tracked accounts for a team
 *     tags:
 *       - Virality
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
 *         description: List of accounts
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/accounts", requireAuth, listAccountsController);

/**
 * @openapi
 * /virality/{teamId}/accounts:
 *   post:
 *     summary: Add a new account to track
 *     tags:
 *       - Virality
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
 *               - platform
 *               - profileUrl
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [instagram, tiktok, x]
 *               profileUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Account created
 *       400:
 *         description: Invalid input or limit reached
 *       403:
 *         description: Plan upgrade required
 *       409:
 *         description: Account already exists
 */
router.post("/:teamId/accounts", requireAuth, addAccountController);

/**
 * @openapi
 * /virality/{teamId}/accounts/{accountId}:
 *   get:
 *     summary: Get a specific account
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Account details
 *       404:
 *         description: Account not found
 */
router.get("/:teamId/accounts/:accountId", requireAuth, getAccountController);

/**
 * @openapi
 * /virality/{teamId}/accounts/{accountId}:
 *   delete:
 *     summary: Remove a tracked account
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Account deleted
 *       404:
 *         description: Account not found
 */
router.delete("/:teamId/accounts/:accountId", requireAuth, deleteAccountController);

/**
 * @openapi
 * /virality/{teamId}/accounts/{accountId}/sync:
 *   post:
 *     summary: Trigger a sync for an account
 *     description: Fetches latest posts and metrics from Instagram, TikTok, or X
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sync completed
 *       403:
 *         description: Plan upgrade required
 *       404:
 *         description: Account not found
 *       500:
 *         description: Sync failed
 */
router.post("/:teamId/accounts/:accountId/sync", requireAuth, syncAccountController);

/**
 * @openapi
 * /virality/{teamId}/accounts/{accountId}/posts:
 *   get:
 *     summary: Get posts for an account
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of posts
 *       404:
 *         description: Account not found
 */
router.get("/:teamId/accounts/:accountId/posts", requireAuth, getPostsController);

/**
 * @openapi
 * /virality/{teamId}/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags:
 *       - Virality
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
 *         description: Dashboard statistics
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/dashboard", requireAuth, getDashboardController);

// ── Competitor routes ──

router.get("/:teamId/competitors", requireAuth, listCompetitorsController);
router.post("/:teamId/competitors", requireAuth, createCompetitorController);
router.patch("/:teamId/competitors/:competitorId", requireAuth, updateCompetitorController);
router.get("/:teamId/competitors/:competitorId", requireAuth, getCompetitorController);
router.delete("/:teamId/competitors/:competitorId", requireAuth, deleteCompetitorController);

export default router;
