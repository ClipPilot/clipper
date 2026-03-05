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
 *     responses:
 *       200:
 *         description: List of accounts
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/accounts", requireAuth, (req, res) => userPerformanceController.listAccounts(req, res));

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
 *   get:
 *     summary: Get a specific user performance account
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
 *         description: Account details
 *       404:
 *         description: Account not found
 */
router.get("/:teamId/accounts/:accountId", requireAuth, (req, res) => userPerformanceController.getAccount(req, res));

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
 *       404:
 *         description: Account not found
 */
router.delete("/:teamId/accounts/:accountId", requireAuth, (req, res) => userPerformanceController.deleteAccount(req, res));

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
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Account not found
 */
router.patch("/:teamId/accounts/:accountId/status", requireAuth, (req, res) => userPerformanceController.updateAccountStatus(req, res));

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
 *       200:
 *         description: Sync completed
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
 *       404:
 *         description: Post not found
 */
router.delete("/:teamId/posts/:postId", requireAuth, (req, res) => userPerformanceController.deletePost(req, res));

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
 *         description: Dashboard statistics
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/dashboard", requireAuth, (req, res) => userPerformanceController.getDashboard(req, res));

export default router;
