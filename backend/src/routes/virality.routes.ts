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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - accounts
 *               properties:
 *                 accounts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ViralityAccount'
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
 *               accountType:
 *                 type: string
 *                 enum: [profile, hashtag, keyword]
 *                 default: profile
 *               competitorId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Account created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - account
 *               properties:
 *                 account:
 *                   $ref: '#/components/schemas/ViralityAccount'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - account
 *               properties:
 *                 account:
 *                   $ref: '#/components/schemas/ViralityAccount'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: Account not found
 */
router.delete("/:teamId/accounts/:accountId", requireAuth, (req, res) => viralityController.deleteAccount(req, res));

/**
 * @openapi
 * /virality/{teamId}/accounts/{accountId}/status:
 *   patch:
 *     summary: Update account active status
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
 *               required:
 *                 - account
 *               properties:
 *                 account:
 *                   $ref: '#/components/schemas/ViralityAccount'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Account not found
 */
router.patch("/:teamId/accounts/:accountId/status", requireAuth, (req, res) => viralityController.updateAccountStatus(req, res));

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
 *       202:
 *         description: Sync accepted (runs in background)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - accepted
 *                 - accountId
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - posts
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ViralityPost'
 *       404:
 *         description: Account not found
 */
router.get("/:teamId/accounts/:accountId/posts", requireAuth, (req, res) => viralityController.getPosts(req, res));

/**
 * @openapi
 * /virality/{teamId}/posts/{postId}:
 *   delete:
 *     summary: Remove a tracked post
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
 *               required:
 *                 - success
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: Post not found
 */
router.delete("/:teamId/posts/:postId", requireAuth, (req, res) => viralityController.deletePost(req, res));

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
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ViralityDashboard'
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/dashboard", requireAuth, (req, res) => viralityController.getDashboard(req, res));

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - competitors
 *               properties:
 *                 competitors:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ViralityCompetitor'
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/competitors", requireAuth, (req, res) => viralityController.listCompetitors(req, res));

/**
 * @openapi
 * /virality/{teamId}/competitors-with-accounts:
 *   get:
 *     summary: List all competitors with their accounts pre-loaded
 *     description: Returns all competitors for a team with nested accounts in a single request, avoiding N+1 queries.
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
 *         description: List of competitors with nested accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - competitors
 *               properties:
 *                 competitors:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CompetitorWithAccounts'
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/competitors-with-accounts", requireAuth, (req, res) => viralityController.listCompetitorsWithAccounts(req, res));

/**
 * @openapi
 * /virality/{teamId}/posts:
 *   get:
 *     summary: Get all posts for a team grouped by account
 *     description: Batch-fetches all posts across all tracked accounts in a single request, avoiding per-account queries.
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
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Posts grouped by account ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ViralityPostsByAccount'
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/posts", requireAuth, (req, res) => viralityController.getAllPosts(req, res));

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - competitor
 *               properties:
 *                 competitor:
 *                   $ref: '#/components/schemas/ViralityCompetitor'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - competitor
 *               properties:
 *                 competitor:
 *                   $ref: '#/components/schemas/ViralityCompetitor'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - competitor
 *               properties:
 *                 competitor:
 *                   allOf:
 *                     - $ref: '#/components/schemas/ViralityCompetitor'
 *                     - type: object
 *                       required:
 *                         - accounts
 *                       properties:
 *                         accounts:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ViralityAccount'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: Competitor not found
 */
router.delete("/:teamId/competitors/:competitorId", requireAuth, (req, res) => viralityController.deleteCompetitor(req, res));

/**
 * @openapi
 * /virality/{teamId}/accounts/{accountId}/alerts:
 *   patch:
 *     summary: Toggle alert_enabled for an account
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
 *               type: object
 *               required:
 *                 - account
 *               properties:
 *                 account:
 *                   $ref: '#/components/schemas/ViralityAccount'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Account not found
 */
router.patch("/:teamId/accounts/:accountId/alerts", requireAuth, (req, res) => viralityController.updateAlertEnabled(req, res));

/**
 * @openapi
 * /virality/{teamId}/settings:
 *   get:
 *     summary: Get viral alert settings for a team
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
 *         description: Viral alert settings including enabled account IDs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - settings
 *               properties:
 *                 settings:
 *                   $ref: '#/components/schemas/ViralSettings'
 */
router.get("/:teamId/settings", requireAuth, (req, res) => viralityController.getSettings(req, res));

/**
 * @openapi
 * /virality/{teamId}/settings:
 *   put:
 *     summary: Save viral alert settings for a team
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
 *               - thresholdMode
 *               - enabledAccountIds
 *             properties:
 *               percentThreshold:
 *                 type: integer
 *                 nullable: true
 *               absoluteThreshold:
 *                 type: integer
 *                 nullable: true
 *               thresholdMode:
 *                 type: string
 *                 enum: [and, or]
 *               timeFrameHours:
 *                 type: integer
 *                 enum: [12, 24, 48]
 *                 default: 24
 *               enabledAccountIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               additionalEmails:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *     responses:
 *       200:
 *         description: Settings saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - settings
 *               properties:
 *                 settings:
 *                   $ref: '#/components/schemas/ViralSettings'
 *       400:
 *         description: Invalid input
 */
router.put("/:teamId/settings", requireAuth, (req, res) => viralityController.saveSettings(req, res));

/**
 * @openapi
 * /virality/{teamId}/alert-logs:
 *   get:
 *     summary: Get alert log history for a team
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
 *         description: List of alert logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - logs
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required:
 *                       - id
 *                       - team_id
 *                       - email
 *                       - subject
 *                       - email_body
 *                       - viral_post_ids
 *                       - status
 *                       - sent_at
 *                       - created_at
 *                     properties:
 *                       id:
 *                         type: integer
 *                       team_id:
 *                         type: integer
 *                       user_id:
 *                         type: integer
 *                         nullable: true
 *                       email:
 *                         type: string
 *                       subject:
 *                         type: string
 *                       email_body:
 *                         type: string
 *                       viral_post_ids:
 *                         type: array
 *                         items:
 *                           type: integer
 *                       status:
 *                         type: string
 *                         enum: [sent, failed]
 *                       error_message:
 *                         type: string
 *                         nullable: true
 *                       sent_at:
 *                         type: string
 *                         format: date-time
 *                       created_at:
 *                         type: string
 *                         format: date-time
 */
router.get("/:teamId/alert-logs", requireAuth, (req, res) => viralityController.getAlertLogs(req, res));

export default router;
