import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { viralityController } from "../controllers/virality.controller";

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
router.get("/:teamId/accounts", requireAuth, (req, res) => viralityController.listAccounts(req, res));

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
router.post("/:teamId/accounts", requireAuth, (req, res) => viralityController.addAccount(req, res));

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
router.get("/:teamId/accounts/:accountId", requireAuth, (req, res) => viralityController.getAccount(req, res));

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
router.delete("/:teamId/accounts/:accountId", requireAuth, (req, res) => viralityController.deleteAccount(req, res));

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
router.post("/:teamId/accounts/:accountId/sync", requireAuth, (req, res) => viralityController.syncAccount(req, res));

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
router.get("/:teamId/accounts/:accountId/posts", requireAuth, (req, res) => viralityController.getPosts(req, res));

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
router.get("/:teamId/dashboard", requireAuth, (req, res) => viralityController.getDashboard(req, res));

// ── Competitor routes ──

/**
 * @openapi
 * /virality/{teamId}/competitors:
 *   get:
 *     summary: List all competitors for a team
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
 *         description: List of competitors
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/competitors", requireAuth, (req, res) => viralityController.listCompetitors(req, res));

/**
 * @openapi
 * /virality/{teamId}/competitors:
 *   post:
 *     summary: Create a new competitor
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Competitor created
 *       400:
 *         description: Invalid input (name is required)
 *       403:
 *         description: Plan upgrade required
 */
router.post("/:teamId/competitors", requireAuth, (req, res) => viralityController.createCompetitor(req, res));

/**
 * @openapi
 * /virality/{teamId}/competitors/{competitorId}:
 *   patch:
 *     summary: Update a competitor
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
 *         name: competitorId
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Competitor updated
 *       400:
 *         description: Invalid input (name cannot be empty)
 *       403:
 *         description: Plan upgrade required
 *       404:
 *         description: Competitor not found
 */
router.patch("/:teamId/competitors/:competitorId", requireAuth, (req, res) => viralityController.updateCompetitor(req, res));

/**
 * @openapi
 * /virality/{teamId}/competitors/{competitorId}:
 *   get:
 *     summary: Get a competitor with its accounts
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
 *         name: competitorId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Competitor details with nested accounts
 *       404:
 *         description: Competitor not found
 */
router.get("/:teamId/competitors/:competitorId", requireAuth, (req, res) => viralityController.getCompetitor(req, res));

/**
 * @openapi
 * /virality/{teamId}/competitors/{competitorId}:
 *   delete:
 *     summary: Delete a competitor
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
 *         name: competitorId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Competitor deleted
 *       404:
 *         description: Competitor not found
 */
router.delete("/:teamId/competitors/:competitorId", requireAuth, (req, res) => viralityController.deleteCompetitor(req, res));

export default router;
