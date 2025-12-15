import { Router } from "express";
import { clipManagerController } from "../controllers/clipManager.controller";
import { getPresignedUploadUrl, submitClipJob } from "../controllers/upload.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /clip-video/presigned-upload:
 *   post:
 *     summary: Get a presigned URL for direct S3 upload
 *     description: Returns a presigned URL that allows direct video upload to S3 from the browser.
 *     tags:
 *       - Video Upload
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - fileName
 *               - contentType
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID
 *               fileName:
 *                 type: string
 *                 description: Original file name
 *               contentType:
 *                 type: string
 *                 description: MIME type (video/mp4, video/quicktime, etc.)
 *               fileSize:
 *                 type: integer
 *                 description: File size in bytes (max 1.5GB)
 *     responses:
 *       200:
 *         description: Presigned URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl:
 *                   type: string
 *                   description: Presigned S3 URL for PUT upload
 *                 s3Key:
 *                   type: string
 *                   description: S3 key where the file will be stored
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post("/presigned-upload", requireAuth, getPresignedUploadUrl);

/**
 * @openapi
 * /clip-video/submit:
 *   post:
 *     summary: Submit a clip generation job
 *     description: After uploading video to S3, submit this to queue the clip generation job.
 *     tags:
 *       - Video Upload
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - s3Key
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID
 *               s3Key:
 *                 type: string
 *                 description: S3 key from presigned-upload response
 *               originalFileName:
 *                 type: string
 *               fileSize:
 *                 type: integer
 *               length:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 120
 *                 description: Desired clip length in seconds
 *               hookLength:
 *                 type: integer
 *                 minimum: 2
 *                 maximum: 15
 *                 description: Hook length in seconds
 *               promptType:
 *                 type: string
 *                 enum: [business, viral]
 *               customPrompt:
 *                 type: string
 *               textPrompt:
 *                 type: string
 *               numberOfVideos:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               customText:
 *                 type: string
 *               textPosition:
 *                 type: string
 *                 enum: [top, middle, bottom]
 *               textColor:
 *                 type: string
 *               captions:
 *                 type: boolean
 *               captionColor:
 *                 type: string
 *               captionFont:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clipIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 message:
 *                   type: string
 *                 status:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Usage limit reached
 */
router.post("/submit", requireAuth, submitClipJob);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips:
 *   get:
 *     summary: Get all clips for a team
 *     description: Retrieves all video clips that have been generated for a specific team
 *     tags:
 *       - Clips Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *     responses:
 *       200:
 *         description: Successfully retrieved clips
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clips:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       team_id:
 *                         type: integer
 *                       generated_by_user_id:
 *                         type: integer
 *                       clip_path:
 *                         type: string
 *                       source_video_path:
 *                         type: string
 *                       clip_score:
 *                         type: integer
 *                       clip_metadata:
 *                         type: object
 *                       prompt:
 *                         type: string
 *                       message:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid team ID
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/clips", requireAuth, clipManagerController.getClips.bind(clipManagerController));

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/pending:
 *   get:
 *     summary: Get all pending clips for a team
 *     description: Retrieves all video clips that are currently pending/processing for a specific team. Use this endpoint to poll for clip status.
 *     tags:
 *       - Clips Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *     responses:
 *       200:
 *         description: Successfully retrieved pending clips
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clips:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid team ID
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/clips/pending", requireAuth, clipManagerController.getPendingClips.bind(clipManagerController));

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/completed:
 *   get:
 *     summary: Get all completed clips for a team with pagination
 *     description: Retrieves completed video clips for a specific team with efficient pagination support
 *     tags:
 *       - Clips Management
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
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of clips to return (max 100)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of clips to skip
 *     responses:
 *       200:
 *         description: Successfully retrieved completed clips
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clips:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/clips/completed", requireAuth, clipManagerController.getCompletedClips.bind(clipManagerController));

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}:
 *   get:
 *     summary: Get a specific clip
 *     description: Retrieves details of a single clip by ID
 *     tags:
 *       - Clips Management
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
 *         description: Successfully retrieved clip
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clip:
 *                   type: object
 *       404:
 *         description: Clip not found
 */
router.get("/teams/:teamId/clips/:clipId", requireAuth, clipManagerController.getClip.bind(clipManagerController));

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}:
 *   patch:
 *     summary: Update a clip
 *     description: Update clip metadata such as message or score
 *     tags:
 *       - Clips Management
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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Optional message/note about the clip
 *               clipScore:
 *                 type: integer
 *                 description: Score rating for the clip
 *     responses:
 *       200:
 *         description: Clip updated successfully
 *       404:
 *         description: Clip not found
 */
router.patch("/teams/:teamId/clips/:clipId", requireAuth, clipManagerController.updateClip.bind(clipManagerController));

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}:
 *   delete:
 *     summary: Delete a clip
 *     description: Permanently delete a clip from the database
 *     tags:
 *       - Clips Management
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
 *         description: Clip deleted successfully
 *       404:
 *         description: Clip not found
 */
router.delete("/teams/:teamId/clips/:clipId", requireAuth, clipManagerController.deleteClip.bind(clipManagerController));

/**
 * @openapi
 * /clip-video/teams/{teamId}/folders/{folderId}/clips:
 *   get:
 *     summary: Get clips in a folder
 *     description: Retrieves all clips that belong to a specific folder
 *     tags:
 *       - Clips Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved clips
 *       401:
 *         description: Unauthorized - missing or invalid bearer token
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/folders/:folderId/clips", requireAuth, clipManagerController.getClipsByFolder.bind(clipManagerController));

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/captions:
 *   post:
 *     summary: Update clip captions
 *     description: Regenerate the clip video with updated caption text. Downloads the blank video, applies new captions, and uploads the result.
 *     tags:
 *       - Clips Management
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - captionsData
 *             properties:
 *               captionsData:
 *                 type: array
 *                 description: Array of caption entries with timing and text
 *                 items:
 *                   type: object
 *                   properties:
 *                     index:
 *                       type: integer
 *                     startTime:
 *                       type: number
 *                       description: Start time in seconds
 *                     endTime:
 *                       type: number
 *                       description: End time in seconds
 *                     text:
 *                       type: string
 *                       description: Caption text
 *               captionColor:
 *                 type: string
 *                 description: Hex color for caption highlight (e.g., "#FFD600")
 *     responses:
 *       200:
 *         description: Captions updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 clipUrl:
 *                   type: string
 *                   description: Presigned URL to the updated clip
 *                 captionsData:
 *                   type: array
 *                   description: The updated captions data
 *       400:
 *         description: Invalid request - missing captions data or no blank video available
 *       404:
 *         description: Clip not found
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/clips/:clipId/captions", requireAuth, clipManagerController.updateCaptions.bind(clipManagerController));

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/text-overlay:
 *   post:
 *     summary: Apply text overlay to clip
 *     description: Add a text overlay to the clip at a specific position. Downloads the blank video, applies the text overlay, and uploads the result.
 *     tags:
 *       - Clips Management
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: The text to overlay on the video
 *               color:
 *                 type: string
 *                 default: "#FFFFFF"
 *                 description: Hex color for the text (e.g., "#FFFFFF" for white)
 *               x:
 *                 type: number
 *                 default: 50
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Horizontal position as percentage (0-100, 50 = center)
 *               y:
 *                 type: number
 *                 default: 10
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Vertical position as percentage (0-100, 0 = top)
 *               fontSize:
 *                 type: number
 *                 default: 48
 *                 minimum: 16
 *                 maximum: 120
 *                 description: Font size in pixels
 *     responses:
 *       200:
 *         description: Text overlay applied successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 clipUrl:
 *                   type: string
 *                   description: Presigned URL to the updated clip
 *       400:
 *         description: Invalid request - missing text or no blank video available
 *       404:
 *         description: Clip not found
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/clips/:clipId/text-overlay", requireAuth, clipManagerController.updateTextOverlay.bind(clipManagerController));

export default router;
