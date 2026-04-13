import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { userPerformanceController } from "../controllers/userPerformance.controller";

const router = Router();

/**
 * @openapi
 * /user-performance/{teamId}/accounts:
 *   get:
 *     summary: List all user performance accounts for a team
 *     tags:
 *       - User Performance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [mass_posting]
 *         description: Filter accounts by source
 *     responses:
 *       200:
 *         description: List of accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/accounts", requireAuth, (req, res) => userPerformanceController.listAccounts(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/backfill-managed:
 *   post:
 *     summary: Backfill managed accounts from mass posting history
 *     description: Creates user_accounts and user_posts entries for existing mass posting posts that were never bridged
 *     tags:
 *       - User Performance
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
 *         description: Backfill results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 created:
 *                   type: integer
 *                 skipped:
 *                   type: integer
 *       403:
 *         description: Plan upgrade required
 */
router.post("/:teamId/backfill-managed", requireAuth, (req, res) => userPerformanceController.backfillManaged(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/accounts:
 *   post:
 *     summary: Add a new account to track your own performance
 *     tags:
 *       - User Performance
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
 *               accountType:
 *                 type: string
 *                 enum: [profile, hashtag, keyword]
 *                 default: profile
 *     responses:
 *       201:
 *         description: Account created and initial sync triggered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 account:
 *                   type: object
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Plan upgrade required
 *       409:
 *         description: Account already being tracked
 */
router.post("/:teamId/accounts", requireAuth, (req, res) => userPerformanceController.addAccount(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/accounts/{accountId}:
 *   delete:
 *     summary: Remove a user performance account
 *     tags:
 *       - User Performance
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: Account not found
 */
router.delete("/:teamId/accounts/:accountId", requireAuth, (req, res) => userPerformanceController.deleteAccount(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/accounts/{accountId}/group:
 *   patch:
 *     summary: Move a user account to a different group
 *     tags:
 *       - User Performance
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MoveAccountToGroupRequest'
 *     responses:
 *       200:
 *         description: Account moved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MoveAccountToGroupResponse'
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Plan upgrade required
 */
router.patch("/:teamId/accounts/:accountId/group", requireAuth, (req, res) => userPerformanceController.moveAccountToGroup(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/accounts/{accountId}/status:
 *   patch:
 *     summary: Update account active status
 *     tags:
 *       - User Performance
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_active
 *             properties:
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Account status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 account:
 *                   type: object
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Account not found
 */
router.patch("/:teamId/accounts/:accountId/status", requireAuth, (req, res) => userPerformanceController.updateAccountStatus(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/accounts/{accountId}/alerts:
 *   patch:
 *     summary: Toggle alert enabled for a user account
 *     tags:
 *       - User Performance
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alert_enabled
 *             properties:
 *               alert_enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Alert setting updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ViralityAccountResponse'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Account not found
 */
router.patch("/:teamId/accounts/:accountId/alerts", requireAuth, (req, res) => userPerformanceController.updateAlertEnabled(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/accounts/{accountId}/sync:
 *   post:
 *     summary: Trigger a sync for an account
 *     description: Fetches latest posts and metrics from Instagram, TikTok, or X
 *     tags:
 *       - User Performance
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
 *       202:
 *         description: Sync accepted (runs in background)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accepted:
 *                   type: boolean
 *                 accountId:
 *                   type: integer
 *       403:
 *         description: Plan upgrade required
 *       404:
 *         description: Account not found
 *       500:
 *         description: Sync failed
 */
router.post("/:teamId/accounts/:accountId/sync", requireAuth, (req, res) => userPerformanceController.syncAccount(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/sync-all:
 *   post:
 *     summary: Sync all accounts and mass posting posts for a team
 *     description: Syncs regular accounts via full profile scrape and mass posting posts via per-post metrics
 *     tags:
 *       - User Performance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       202:
 *         description: Sync accepted for all accounts (runs in background)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accepted:
 *                   type: boolean
 *                 accountIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *       403:
 *         description: Plan upgrade required
 */
router.post("/:teamId/sync-all", requireAuth, (req, res) => userPerformanceController.syncAll(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/accounts/{accountId}/posts:
 *   get:
 *     summary: Get posts for a user performance account
 *     tags:
 *       - User Performance
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
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter posts from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter posts until this date
 *     responses:
 *       200:
 *         description: List of posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Account not found
 */
router.get("/:teamId/accounts/:accountId/posts", requireAuth, (req, res) => userPerformanceController.getPosts(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/posts/{postId}:
 *   delete:
 *     summary: Remove a tracked post
 *     tags:
 *       - User Performance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Post deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: Post not found
 */
router.delete("/:teamId/posts/:postId", requireAuth, (req, res) => userPerformanceController.deletePost(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/posts:
 *   get:
 *     summary: Get all posts for all accounts in a team (batch)
 *     tags:
 *       - User Performance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Posts grouped by account ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 postsByAccount:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: object
 */
router.get("/:teamId/posts", requireAuth, (req, res) => userPerformanceController.getAllPosts(req, res));

/**
 * @openapi
 * /user-performance/{teamId}/dashboard:
 *   get:
 *     summary: Get dashboard statistics for user performance
 *     tags:
 *       - User Performance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter stats from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter stats until this date
 *     responses:
 *       200:
 *         description: Dashboard statistics (returned directly from service)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/dashboard", requireAuth, (req, res) => userPerformanceController.getDashboard(req, res));

export default router;
