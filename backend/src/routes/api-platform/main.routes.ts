import { Router } from "express";
import {
  createApiKeyController,
  listApiKeysController,
  revokeApiKeyController,
  getWalletController,
  createWalletTopUpController,
  getTopUpStatusController,
  getAutoRefillController,
  updateAutoRefillController,
  getUsageLogsController,
  testApiRouteController,
  getWalletV1Controller,
} from "../../controllers/apiPlatform.controller";
import {
  createClipJobController,
  getClipJobStatusController,
} from "../../controllers/apiClip.controller";
import {
  createFaceSwapJobController,
  getFaceSwapStatusController,
} from "../../controllers/apiFaceSwap.controller";
import { requireAuth, validateAPIKey } from "../../middleware/auth.middleware";
import { upload, apiFaceSwapUpload } from "../../config/multer";

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

// Dashboard-only routes (bearer auth, teamId in URL) — used by frontend
router.get("/teams/:teamId/wallet", requireAuth, getWalletController);
router.post("/teams/:teamId/wallet/topup", requireAuth, createWalletTopUpController);
router.get("/teams/:teamId/wallet/topup/:paymentIntentId/status", requireAuth, getTopUpStatusController);
router.get("/teams/:teamId/wallet/auto-refill", requireAuth, getAutoRefillController);
router.put("/teams/:teamId/wallet/auto-refill", requireAuth, updateAutoRefillController);
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

/**
 * @openapi
 * /platform/v1/wallet:
 *   get:
 *     summary: Get wallet balance
 *     description: Returns your team's API wallet balance and usage totals.
 *     tags:
 *       - Wallet
 *     security:
 *       - apiKeyAuth: []
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
 *         description: Invalid or missing API key
 */
router.get("/v1/wallet", validateAPIKey, getWalletV1Controller);

/**
 * @openapi
 * /platform/v1/clip:
 *   post:
 *     summary: Submit a video for AI clipping
 *     description: |
 *       Submit a video for AI-powered clip generation. Provide either:
 *       - A `video_url` in JSON body, or
 *       - A `video` file via multipart form data.
 *
 *       Each clip costs $1.50 and is deducted from your wallet upfront.
 *       Poll GET /v1/clip/{jobId} for results.
 *     tags:
 *       - AI Clipping
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - video_url
 *             properties:
 *               video_url:
 *                 type: string
 *                 format: uri
 *                 description: URL of the video to clip. Supports direct video URLs, YouTube, Instagram, TikTok, and X links.
 *               num_clips:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 default: 1
 *               style:
 *                 type: string
 *                 enum: [viral, business, general, gaming]
 *                 default: viral
 *               length:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 180
 *                 default: 40
 *                 description: Target clip duration in seconds.
 *               prompt:
 *                 type: string
 *                 description: Custom AI instructions for clip selection (e.g. "focus on product demos" or "find the funniest moments").
 *               captions:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                     default: false
 *                   color:
 *                     type: string
 *                     enum: [white, black, red, orange, yellow, green, teal, blue, purple, pink]
 *                     default: white
 *                   font:
 *                     type: string
 *                     enum: [Montserrat, Luckiest Guy, Everlasting, Komika, Burbank, Bebas Neue, Anton]
 *                     default: Montserrat
 *               camera_mode:
 *                 type: string
 *                 enum: [standard, gaming, speaker-zoom, center-crop, active-speaker]
 *                 default: standard
 *                 description: |
 *                   Controls how the video is framed for vertical output.
 *                   - standard: blurred background with centered video
 *                   - gaming: detects facecam overlay and separates gameplay + facecam
 *                   - speaker-zoom: zooms into the speaker's face
 *                   - center-crop: crops the center of the video
 *                   - active-speaker: tracks and zooms into the active speaker (multi-person)
 *               auto_heading:
 *                 type: boolean
 *                 default: true
 *                 description: Automatically generate a short viral heading overlay for each clip using AI.
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file (mp4, mov, avi, mkv, webm)
 *               num_clips:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 default: 1
 *               style:
 *                 type: string
 *                 enum: [viral, business, general, gaming]
 *                 default: viral
 *               length:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 180
 *                 default: 40
 *                 description: Target clip duration in seconds.
 *               prompt:
 *                 type: string
 *                 description: Custom AI instructions for clip selection.
 *               captions:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                     default: false
 *                   color:
 *                     type: string
 *                     enum: [white, black, red, orange, yellow, green, teal, blue, purple, pink]
 *                     default: white
 *                   font:
 *                     type: string
 *                     enum: [Montserrat, Luckiest Guy, Everlasting, Komika, Burbank, Bebas Neue, Anton]
 *                     default: Montserrat
 *               camera_mode:
 *                 type: string
 *                 enum: [standard, gaming, speaker-zoom, center-crop, active-speaker]
 *                 default: standard
 *                 description: Controls how the video is framed for vertical output.
 *               auto_heading:
 *                 type: boolean
 *                 default: true
 *                 description: Automatically generate a short viral heading overlay for each clip.
 *     responses:
 *       200:
 *         description: Clip job submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 job_id:
 *                   type: string
 *                   format: uuid
 *                 num_clips:
 *                   type: integer
 *                 cost_cents:
 *                   type: integer
 *                 status:
 *                   type: string
 *                   example: processing
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Invalid or missing API key
 *       402:
 *         description: Insufficient wallet balance
 */
router.post("/v1/clip", validateAPIKey, upload.single("video"), createClipJobController);

/**
 * @openapi
 * /platform/v1/clip/{jobId}:
 *   get:
 *     summary: Get clip job status
 *     description: |
 *       Poll this endpoint to check if your clip job is ready.
 *       Returns permanent download URLs for each clip when status is "completed".
 *     tags:
 *       - AI Clipping
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The job_id (UUID) returned from POST /v1/clip
 *     responses:
 *       200:
 *         description: Job status
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: Job is still processing
 *                   properties:
 *                     job_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: processing
 *                     progress:
 *                       type: object
 *                       properties:
 *                         completed:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                 - type: object
 *                   description: All clips finished
 *                   properties:
 *                     job_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: completed
 *                     clips:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           clip_id:
 *                             type: integer
 *                           status:
 *                             type: string
 *                             enum: [completed, failed]
 *                           title:
 *                             type: string
 *                           heading:
 *                             type: string
 *                             description: AI-generated viral heading overlay text (if auto_heading was enabled)
 *                           download_url:
 *                             type: string
 *                             format: uri
 *                           error:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Invalid or missing API key
 *       404:
 *         description: Job not found
 */
router.get("/v1/clip/:jobId", validateAPIKey, getClipJobStatusController);

/**
 * @openapi
 * /platform/v1/face-swap:
 *   post:
 *     summary: Submit a video for face swap
 *     description: |
 *       Submit a video and face image for AI face swapping. Provide either:
 *       - URLs via JSON (`video_url` + `face_image_url`), or
 *       - Files via multipart form data (`video` + `face_image`), or
 *       - A mix of URL and file.
 *
 *       Cost is $0.20 per second of video (rounded up), deducted upfront.
 *       Maximum video duration is 300 seconds (5 minutes).
 *       Poll GET /v1/face-swap/{jobId} for results.
 *     tags:
 *       - Face Swap
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - video_url
 *               - face_image_url
 *             properties:
 *               video_url:
 *                 type: string
 *                 format: uri
 *                 description: Public URL of the video
 *               face_image_url:
 *                 type: string
 *                 format: uri
 *                 description: Public URL of the face image
 *               mode:
 *                 type: string
 *                 enum: [face, fullbody]
 *                 default: fullbody
 *                 description: "face = fast face-only swap (FAL AI), fullbody = full body swap (Kling AI)"
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *               - face_image
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file (mp4, mov, webm, avi). Max 500MB.
 *               face_image:
 *                 type: string
 *                 format: binary
 *                 description: Face image file (jpg, png, webp). Max 500MB.
 *               mode:
 *                 type: string
 *                 enum: [face, fullbody]
 *                 default: fullbody
 *     responses:
 *       202:
 *         description: Face swap job accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 job_id:
 *                   type: string
 *                   format: uuid
 *                 mode:
 *                   type: string
 *                   enum: [face, fullbody]
 *                 duration_seconds:
 *                   type: integer
 *                 cost_cents:
 *                   type: integer
 *                 status:
 *                   type: string
 *                   example: processing
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Invalid or missing API key
 *       402:
 *         description: Insufficient wallet balance
 */
router.post(
  "/v1/face-swap",
  validateAPIKey,
  apiFaceSwapUpload.fields([
    { name: "video", maxCount: 1 },
    { name: "face_image", maxCount: 1 },
  ]),
  createFaceSwapJobController,
);

/**
 * @openapi
 * /platform/v1/face-swap/{jobId}:
 *   get:
 *     summary: Get face swap job status
 *     description: |
 *       Poll this endpoint to check if your face swap job is ready.
 *       Returns a download URL when status is "completed".
 *     tags:
 *       - Face Swap
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The job_id returned from POST /v1/face-swap
 *     responses:
 *       200:
 *         description: Job status
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: Job is still processing
 *                   properties:
 *                     job_id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: processing
 *                     progress:
 *                       type: integer
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                 - type: object
 *                   description: Job completed
 *                   properties:
 *                     job_id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: completed
 *                     download_url:
 *                       type: string
 *                       format: uri
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                 - type: object
 *                   description: Job failed
 *                   properties:
 *                     job_id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: failed
 *                     error:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Invalid or missing API key
 *       404:
 *         description: Job not found
 */
router.get("/v1/face-swap/:jobId", validateAPIKey, getFaceSwapStatusController);

export default router;
