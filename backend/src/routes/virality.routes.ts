import { Router } from "express";
import { requireAuth, requireSeatAccess } from "../middleware/auth.middleware";
import { viralityController } from "../controllers/virality.controller";

const router = Router();

/**
 * @openapi
 * /virality/{teamId}/accounts:
 *   get:
 *     summary: List all tracked competitor accounts for a team
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
 *     summary: Add a new account to track (competitor or user) within a group
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
 *               - groupId
 *               - competitor
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
 *               groupId:
 *                 type: integer
 *                 description: ID of the group to assign this account to
 *               competitor:
 *                 type: boolean
 *                 description: If true, writes to competitor_accounts; if false, writes to user_accounts
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
 *   delete:
 *     summary: Remove a tracked competitor account
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
 * /api/virality/{teamId}/accounts/{accountId}/group:
 *   patch:
 *     summary: Move an account to a different group
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
 *       404:
 *         description: Account or group not found
 */
router.patch("/:teamId/accounts/:accountId/group", requireAuth, (req, res) => viralityController.moveAccountToGroup(req, res));

/**
 * @openapi
 * /api/virality/{teamId}/bulk-move-accounts:
 *   post:
 *     summary: Move all accounts from one group to another
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
 *             $ref: '#/components/schemas/BulkMoveAccountsRequest'
 *     responses:
 *       200:
 *         description: Accounts moved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkMoveAccountsResponse'
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Plan upgrade required
 */
router.post("/:teamId/bulk-move-accounts", requireAuth, (req, res) => viralityController.bulkMoveAccounts(req, res));

/**
 * @openapi
 * /virality/{teamId}/accounts/{accountId}/status:
 *   patch:
 *     summary: Update competitor account active status
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
 * /virality/{teamId}/accounts/unpause-all:
 *   post:
 *     summary: Unpause all virality accounts for a team
 *     description: Reactivates all paused virality accounts. Requires Studio plan or higher.
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
 *         description: All accounts unpaused
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *               properties:
 *                 success:
 *                   type: boolean
 *       403:
 *         description: Plan upgrade required
 */
router.post("/:teamId/accounts/unpause-all", requireAuth, (req, res) => viralityController.unpauseAllAccounts(req, res));

/**
 * @openapi
 * /virality/{teamId}/accounts/{accountId}/sync:
 *   post:
 *     summary: Trigger a sync for a competitor account
 *     description: Fetches latest posts and metrics from Instagram, TikTok, or X for a competitor account
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
 *     summary: Get posts for a competitor account
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
 *     summary: Remove a tracked competitor post
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
 *     summary: Get competitor dashboard statistics
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
 *     summary: List all competitor groups for a team
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
 *         description: List of competitor groups
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
router.get("/:teamId/competitors", requireAuth, (req, res) => viralityController.listGroups(req, res));

/**
 * @openapi
 * /virality/{teamId}/competitors-with-accounts:
 *   get:
 *     summary: List all competitor groups with their accounts pre-loaded
 *     description: Returns all competitor groups for a team with nested accounts in a single request, avoiding N+1 queries.
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
 *         description: List of competitor groups with nested accounts
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
router.get("/:teamId/competitors-with-accounts", requireAuth, (req, res) => viralityController.listGroupsWithAccounts(req, res));

/**
 * @openapi
 * /virality/{teamId}/posts:
 *   get:
 *     summary: Get all competitor posts for a team grouped by account
 *     description: Batch-fetches all posts across all tracked competitor accounts in a single request, avoiding per-account queries.
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
 *     summary: Create a new competitor group
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
 *               competitor:
 *                 type: boolean
 *                 default: true
 *                 description: Whether this is a competitor group (true) or a user performance group (false)
 *     responses:
 *       201:
 *         description: Group created
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
router.post("/:teamId/competitors", requireAuth, (req, res) => viralityController.createGroup(req, res));

/**
 * @openapi
 * /virality/{teamId}/competitors/{competitorId}:
 *   patch:
 *     summary: Update a competitor group
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
 *         description: Competitor group updated
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
 *         description: Competitor group not found
 */
router.patch("/:teamId/competitors/:competitorId", requireAuth, (req, res) => viralityController.updateGroup(req, res));

/**
 * @openapi
 * /virality/{teamId}/competitors/{competitorId}:
 *   get:
 *     summary: Get a competitor group with its accounts
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
 *         description: Competitor group details with nested accounts
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
 *         description: Competitor group not found
 */
router.get("/:teamId/competitors/:competitorId", requireAuth, (req, res) => viralityController.getGroupWithAccounts(req, res));

/**
 * @openapi
 * /virality/{teamId}/competitors/{competitorId}:
 *   delete:
 *     summary: Delete a competitor group
 *     description: Deletes the group and all its associated accounts via cascade.
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
 *         description: Competitor group deleted
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
 *         description: Competitor group not found
 */
router.delete("/:teamId/competitors/:competitorId", requireAuth, (req, res) => viralityController.deleteGroup(req, res));

/**
 * @openapi
 * /virality/{teamId}/accounts/{accountId}/alerts:
 *   patch:
 *     summary: Toggle alert_enabled for a competitor account
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
 *         description: List of alert logs with total count
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AlertLogsResponse'
 */
router.get("/:teamId/alert-logs", requireAuth, (req, res) => viralityController.getAlertLogs(req, res));

/**
 * @openapi
 * /virality/{teamId}/alerts/{alertId}/notify:
 *   post:
 *     tags:
 *       - Virality
 *     summary: Notify team about a specific alert
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotifyAlertResponse'
 */
router.post("/:teamId/alerts/:alertId/notify", requireAuth, requireSeatAccess, (req, res) => viralityController.notifyAlert(req, res));

export default router;
