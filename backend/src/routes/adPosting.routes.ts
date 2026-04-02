import { Router } from "express";
import { requireAuth, requireSeatAccess } from "../middleware/auth.middleware";
import {
  postClipToPlatforms,
  getClipPosts,
  webhookMarkAsPosted,
  getPostsForTeam,
  getAccountStats,
  uploadCustomVideo,
  completeCustomVideo,
} from "../controllers/adPosting.controller";

const router = Router();

/**
 * @openapi
 * /api/ad-posting/teams/{teamId}/post:
 *   post:
 *     summary: Post a clip to one or more platforms
 *     description: >
 *       Validates the clip, deducts credits based on total copies, and sends
 *       an async SQS job for worker processing. The team must be approved for
 *       mass posting with a Google Drive folder configured.
 *     tags:
 *       - Ad Posting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clipId
 *             properties:
 *               clipId:
 *                 type: integer
 *                 description: ID of the clip to post
 *               platformQuantities:
 *                 type: object
 *                 description: "Map of platform → number of copies (1-50 each)"
 *                 additionalProperties:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 50
 *                 example:
 *                   tiktok: 5
 *                   instagram: 3
 *               platforms:
 *                 type: array
 *                 description: "Legacy format: array of platform names (1 copy each)"
 *                 items:
 *                   type: string
 *                   enum: [tiktok, instagram, facebook, youtube, x]
 *     responses:
 *       202:
 *         description: Ad posting job accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - message
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ad posting started
 *       400:
 *         description: Invalid input (bad teamId, clipId, platform, or quantity)
 *       401:
 *         description: User not authenticated
 *       402:
 *         description: Insufficient credits
 *       403:
 *         description: Team not approved for mass posting or no Drive folder
 *       404:
 *         description: Clip not found
 *       500:
 *         description: Server error
 */
router.post(
  "/teams/:teamId/post",
  requireAuth,
  requireSeatAccess,
  postClipToPlatforms,
);

/**
 * @openapi
 * /api/ad-posting/teams/{teamId}/clips/{clipId}/posts:
 *   get:
 *     summary: Get all posts for a clip
 *     description: Returns the list of platform posts created for a specific clip.
 *     tags:
 *       - Ad Posting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *       - in: path
 *         name: clipId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The clip ID
 *     responses:
 *       200:
 *         description: List of posts for the clip
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClipPostsResponse'
 *       400:
 *         description: Invalid team ID or clip ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  "/teams/:teamId/clips/:clipId/posts",
  requireAuth,
  requireSeatAccess,
  getClipPosts,
);

/**
 * @openapi
 * /api/ad-posting/webhook/posted:
 *   post:
 *     summary: Webhook to mark a post as posted
 *     description: >
 *       Called by the external botfarm service when a post is successfully
 *       published. Marks the post as "posted" and cleans up the Drive file.
 *       Authenticated via x-webhook-secret header.
 *     tags:
 *       - Ad Posting
 *     parameters:
 *       - in: header
 *         name: x-webhook-secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Shared secret for webhook authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: integer
 *                 description: ID of the post to mark as posted
 *               postUrl:
 *                 type: string
 *                 description: URL where the post was published
 *     responses:
 *       200:
 *         description: Post marked as posted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid postId
 *       401:
 *         description: Invalid or missing webhook secret
 *       500:
 *         description: Server error
 */
router.post("/webhook/posted", webhookMarkAsPosted);

/**
 * @openapi
 * /api/ad-posting/teams/{teamId}/posts:
 *   get:
 *     summary: Get paginated posts for a team
 *     description: >
 *       Returns a paginated list of posts for the team, joined with clip data.
 *       Supports filtering by status group (queued or published), platform,
 *       date range, and search by clip title.
 *     tags:
 *       - Ad Posting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *       - in: query
 *         name: tab
 *         schema:
 *           type: string
 *           enum: [queued, published]
 *           default: queued
 *         description: >
 *           Filter group — "queued" returns scheduled/processing/failed posts,
 *           "published" returns posted posts.
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [tiktok, instagram, facebook, youtube, x]
 *         description: Filter by platform
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, all]
 *           default: all
 *         description: Filter by date range relative to today
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by clip title (case-insensitive partial match)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, posted_time]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of rows per page
 *     responses:
 *       200:
 *         description: Paginated list of posts with clip data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - posts
 *                 - pagination
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required:
 *                       - id
 *                       - platform
 *                       - status
 *                       - created_at
 *                     properties:
 *                       id:
 *                         type: integer
 *                       clip_id:
 *                         type: integer
 *                         nullable: true
 *                       clip_title:
 *                         type: string
 *                         nullable: true
 *                       clip_url:
 *                         type: string
 *                         nullable: true
 *                       platform:
 *                         type: string
 *                       status:
 *                         type: string
 *                       content:
 *                         type: string
 *                       post_url:
 *                         type: string
 *                         nullable: true
 *                       posted_time:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   required:
 *                     - page
 *                     - pageSize
 *                     - total
 *                     - totalPages
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         description: Invalid team ID or query parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/posts", requireAuth, requireSeatAccess, getPostsForTeam);

/**
 * @openapi
 * /api/ad-posting/teams/{teamId}/accounts:
 *   get:
 *     summary: Get posting account stats for a team
 *     description: Returns aggregated account-level statistics for ad posting
 *     tags:
 *       - Ad Posting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, all]
 *     responses:
 *       200:
 *         description: Account stats (shape returned by service)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Invalid team ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/accounts", requireAuth, requireSeatAccess, getAccountStats);

/**
 * @openapi
 * /api/ad-posting/teams/{teamId}/custom-video:
 *   post:
 *     summary: Upload a custom video for ad posting
 *     description: Creates a clip record and returns a presigned S3 upload URL
 *     tags:
 *       - Ad Posting
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
 *               - fileName
 *               - contentType
 *             properties:
 *               fileName:
 *                 type: string
 *               contentType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Upload URL and clip record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Requires Studio plan or higher
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/custom-video", requireAuth, requireSeatAccess, uploadCustomVideo);

/**
 * @openapi
 * /api/ad-posting/teams/{teamId}/custom-video/{clipId}/complete:
 *   post:
 *     summary: Complete a custom video upload
 *     description: Marks a custom video upload as complete after the file has been uploaded to S3
 *     tags:
 *       - Ad Posting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: clipId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Custom video marked complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Invalid team ID or clip ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/custom-video/:clipId/complete", requireAuth, requireSeatAccess, completeCustomVideo);

export default router;
