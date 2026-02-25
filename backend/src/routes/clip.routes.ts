import { Router } from "express";
import { clipManagerController } from "../controllers/clipManager.controller";
import {
  getPresignedUploadUrl,
  submitClipJob,
  submitBatchClipJob,
  initiateMultipartUpload,
  completeMultipartUpload,
  abortMultipartUpload,
} from "../controllers/upload.controller";
import {
  getVideoInfo,
  downloadVideo,
  downloadVideoSync,
} from "../controllers/videoDownload.controller";
import { requireAuth, requireSeatAccess } from "../middleware/auth.middleware";

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
 *                 description: File size in bytes (max 2GB)
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
 * /clip-video/multipart/initiate:
 *   post:
 *     summary: Initiate multipart upload
 *     description: Initiates a multipart upload for large files (>50MB). Returns presigned URLs for each chunk.
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
 *               - fileSize
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
 *                 description: File size in bytes (max 2GB)
 *     responses:
 *       200:
 *         description: Multipart upload initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadId:
 *                   type: string
 *                   description: AWS S3 upload ID for this multipart upload
 *                 s3Key:
 *                   type: string
 *                   description: S3 key where the file will be stored
 *                 chunkSize:
 *                   type: integer
 *                   description: Size of each chunk in bytes (10MB)
 *                 totalParts:
 *                   type: integer
 *                   description: Total number of parts to upload
 *                 partUrls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       partNumber:
 *                         type: integer
 *                       uploadUrl:
 *                         type: string
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post("/multipart/initiate", requireAuth, initiateMultipartUpload);

/**
 * @openapi
 * /clip-video/multipart/complete:
 *   post:
 *     summary: Complete multipart upload
 *     description: Completes a multipart upload after all parts have been uploaded. Assembles the file in S3.
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
 *               - s3Key
 *               - uploadId
 *               - parts
 *             properties:
 *               s3Key:
 *                 type: string
 *                 description: S3 key from initiate response
 *               uploadId:
 *                 type: string
 *                 description: Upload ID from initiate response
 *               parts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     partNumber:
 *                       type: integer
 *                     etag:
 *                       type: string
 *                       description: ETag returned from S3 after uploading each part
 *     responses:
 *       200:
 *         description: Multipart upload completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 s3Key:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to complete upload
 */
router.post("/multipart/complete", requireAuth, completeMultipartUpload);

/**
 * @openapi
 * /clip-video/multipart/abort:
 *   post:
 *     summary: Abort multipart upload
 *     description: Aborts an in-progress multipart upload. Use this if an upload fails or is cancelled.
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
 *               - s3Key
 *               - uploadId
 *             properties:
 *               s3Key:
 *                 type: string
 *                 description: S3 key from initiate response
 *               uploadId:
 *                 type: string
 *                 description: Upload ID from initiate response
 *     responses:
 *       200:
 *         description: Multipart upload aborted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post("/multipart/abort", requireAuth, abortMultipartUpload);

/**
 * @openapi
 * /clip-video/url/info:
 *   post:
 *     summary: Get video info from URL
 *     description: Fetches metadata for a video URL. Supports YouTube, Twitch, Kick, Vimeo, Instagram, TikTok, and 1000+ other sites via yt-dlp.
 *     tags:
 *       - Video URL Download
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Video info retrieved
 */
router.post("/url/info", requireAuth, getVideoInfo);

/**
 * @openapi
 * /clip-video/url/download:
 *   post:
 *     summary: Download video from URL with SSE progress
 *     description: Downloads a video from any supported URL, uploads to S3, and streams progress via SSE.
 *     tags:
 *       - Video URL Download
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - teamId
 *             properties:
 *               url:
 *                 type: string
 *               teamId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: SSE stream with download progress
 */
router.post("/url/download", requireAuth, downloadVideo);

/**
 * @openapi
 * /clip-video/url/download-sync:
 *   post:
 *     summary: Download video from URL synchronously
 *     description: Downloads a video from any supported URL and uploads to S3. Returns result when complete.
 *     tags:
 *       - Video URL Download
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - teamId
 *             properties:
 *               url:
 *                 type: string
 *               teamId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Video downloaded and uploaded to S3
 */
router.post("/url/download-sync", requireAuth, downloadVideoSync);

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
 *                 maximum: 25
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
 * /clip-video/batch-submit:
 *   post:
 *     summary: Submit a batch clip generation job
 *     description: After uploading multiple videos to S3, submit this to queue a batch clip generation job. Supports up to 5 videos. The AI will analyze all videos and create clips that can mix segments from different source videos.
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
 *               - videos
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID
 *               videos:
 *                 type: array
 *                 maxItems: 5
 *                 items:
 *                   type: object
 *                   required:
 *                     - s3Key
 *                     - videoIndex
 *                   properties:
 *                     s3Key:
 *                       type: string
 *                       description: S3 key from presigned-upload response
 *                     videoIndex:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 4
 *                       description: Index of this video (0-4)
 *                     originalFileName:
 *                       type: string
 *                     fileSize:
 *                       type: integer
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
 *                 enum: [business, viral, gaming]
 *               customPrompt:
 *                 type: string
 *               textPrompt:
 *                 type: string
 *               numberOfVideos:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 25
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
 *         description: Batch job submitted successfully
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
 *         description: Invalid request (max 5 videos, or validation errors)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Usage limit reached
 */
router.post("/batch-submit", requireAuth, submitBatchClipJob);

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
router.get(
  "/teams/:teamId/clips",
  requireAuth,
  clipManagerController.getClips.bind(clipManagerController)
);

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
router.get(
  "/teams/:teamId/clips/pending",
  requireAuth,
  clipManagerController.getPendingClips.bind(clipManagerController)
);

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
router.get(
  "/teams/:teamId/clips/completed",
  requireAuth,
  clipManagerController.getCompletedClips.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/unsaved:
 *   get:
 *     summary: Get unsaved clips for a team
 *     description: Retrieves all completed clips that have not been saved yet. These clips have watermarks and don't count toward usage until saved.
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
 *         description: Successfully retrieved unsaved clips
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
 *                       clip_path:
 *                         type: string
 *                       is_saved:
 *                         type: boolean
 *                       status:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid team ID
 *       500:
 *         description: Server error
 */
router.get(
  "/teams/:teamId/clips/unsaved",
  requireAuth,
  clipManagerController.getUnsavedClips.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/saved:
 *   get:
 *     summary: Get saved clips for a team with pagination
 *     description: Retrieves all saved clips for a specific team with pagination support. These are clips that have been explicitly saved by the user.
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
 *           default: 12
 *           maximum: 100
 *         description: Number of clips to return (max 100)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of clips to skip for pagination
 *     responses:
 *       200:
 *         description: Successfully retrieved saved clips
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
 *                       clip_path:
 *                         type: string
 *                       is_saved:
 *                         type: boolean
 *                       saved_at:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
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
router.get(
  "/teams/:teamId/clips/saved",
  requireAuth,
  clipManagerController.getSavedClips.bind(clipManagerController)
);

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
router.get(
  "/teams/:teamId/clips/:clipId",
  requireAuth,
  clipManagerController.getClip.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/stream:
 *   get:
 *     summary: Stream clip video through backend proxy
 *     description: Streams the clip video directly from S3 through the backend. Supports Range requests for seeking. The S3 URL is never exposed to the client.
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
 *         description: Video stream
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 *       206:
 *         description: Partial video stream (Range request)
 *       404:
 *         description: Video not available
 */
router.get(
  "/teams/:teamId/clips/:clipId/stream",
  requireAuth,
  clipManagerController.streamClip.bind(clipManagerController)
);

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
router.patch(
  "/teams/:teamId/clips/:clipId",
  requireAuth,
  requireSeatAccess,
  clipManagerController.updateClip.bind(clipManagerController)
);

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
router.delete(
  "/teams/:teamId/clips/:clipId",
  requireAuth,
  requireSeatAccess,
  clipManagerController.deleteClip.bind(clipManagerController)
);

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
router.get(
  "/teams/:teamId/folders/:folderId/clips",
  requireAuth,
  clipManagerController.getClipsByFolder.bind(clipManagerController)
);

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
router.post(
  "/teams/:teamId/clips/:clipId/captions",
  requireAuth,
  requireSeatAccess,
  clipManagerController.updateCaptions.bind(clipManagerController)
);

router.post(
  "/teams/:teamId/clips/:clipId/generate-captions",
  requireAuth,
  requireSeatAccess,
  clipManagerController.generateCaptions.bind(clipManagerController)
);

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
router.post(
  "/teams/:teamId/clips/:clipId/text-overlay",
  requireAuth,
  requireSeatAccess,
  clipManagerController.updateTextOverlay.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/overlays:
 *   post:
 *     summary: Apply combined overlays to clip
 *     description: Apply both heading and captions to a clip in a single operation. Starts from blank video, applies heading if provided, then applies captions on top.
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
 *             properties:
 *               captionsEnabled:
 *                 type: boolean
 *                 description: Whether to show captions
 *               captionsData:
 *                 type: array
 *                 items:
 *                   type: object
 *               captionColor:
 *                 type: string
 *               captionFont:
 *                 type: string
 *               heading:
 *                 type: object
 *                 properties:
 *                   text:
 *                     type: string
 *                   color:
 *                     type: string
 *                   font:
 *                     type: string
 *                   x:
 *                     type: number
 *                   y:
 *                     type: number
 *                   fontSize:
 *                     type: number
 *     responses:
 *       200:
 *         description: Overlays update queued
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Cannot edit unsaved clips
 *       404:
 *         description: Clip not found
 *       500:
 *         description: Server error
 */
router.post(
  "/teams/:teamId/clips/:clipId/overlays",
  requireAuth,
  requireSeatAccess,
  clipManagerController.updateClipOverlays.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/edit:
 *   post:
 *     summary: Submit a video edit job (CapCut-like editing)
 *     description: |
 *       Submits a comprehensive video edit job that can include trimming, speed changes,
 *       cropping, audio adjustments, background music, captions, and heading overlays.
 *       All edits are processed in a single render pass on the worker.
 *     tags:
 *       - Video Editor
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - editConfig
 *             properties:
 *               editConfig:
 *                 type: object
 *                 properties:
 *                   trim:
 *                     type: object
 *                     properties:
 *                       startTime:
 *                         type: number
 *                       endTime:
 *                         type: number
 *                   crop:
 *                     type: object
 *                     properties:
 *                       aspectRatio:
 *                         type: string
 *                         enum: ["9:16", "16:9", "1:1", "4:5", "custom"]
 *                       customCrop:
 *                         type: object
 *                   speed:
 *                     type: number
 *                     minimum: 0.25
 *                     maximum: 4
 *                   audio:
 *                     type: object
 *                     properties:
 *                       originalVolume:
 *                         type: number
 *                       originalMuted:
 *                         type: boolean
 *                       backgroundMusic:
 *                         type: object
 *                   captions:
 *                     type: object
 *                   heading:
 *                     type: object
 *     responses:
 *       200:
 *         description: Video edit job queued successfully
 *       400:
 *         description: Invalid configuration
 *       403:
 *         description: Cannot edit unsaved clips
 *       404:
 *         description: Clip not found
 */
router.post(
  "/teams/:teamId/clips/:clipId/edit",
  requireAuth,
  requireSeatAccess,
  clipManagerController.submitVideoEdit.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/music:
 *   post:
 *     summary: Get presigned URL for background music upload
 *     description: Returns a presigned URL for uploading background music to S3
 *     tags:
 *       - Video Editor
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
 *               fileSize:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Upload URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl:
 *                   type: string
 *                 s3Key:
 *                   type: string
 *       400:
 *         description: Invalid file type or size
 */
router.post(
  "/teams/:teamId/clips/:clipId/music",
  requireAuth,
  requireSeatAccess,
  clipManagerController.getMusicUploadUrl.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/overlay-upload:
 *   post:
 *     summary: Get upload URL for a clip overlay image
 *     tags:
 *       - Clips
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: teamId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: clipId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Upload URL generated
 */
router.post(
  "/teams/:teamId/clips/:clipId/overlay-upload",
  requireAuth,
  requireSeatAccess,
  clipManagerController.getOverlayUploadUrl.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/overlay-urls:
 *   post:
 *     summary: Get signed URLs for clip overlay images
 *     tags:
 *       - Clips
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: teamId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: clipId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Overlay URLs returned
 */
router.post(
  "/teams/:teamId/clips/:clipId/overlay-urls",
  requireAuth,
  requireSeatAccess,
  clipManagerController.getOverlayViewUrls.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/save:
 *   post:
 *     summary: Save a clip
 *     description: Saves an unsaved clip. This removes the watermark, increments usage for the team, and moves the clip to the saved state.
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
 *     responses:
 *       200:
 *         description: Clip saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 clip:
 *                   type: object
 *                   description: The updated clip object
 *       400:
 *         description: Clip already saved
 *       403:
 *         description: Usage limit reached (free plan only)
 *       404:
 *         description: Clip not found
 *       500:
 *         description: Server error
 */
router.post(
  "/teams/:teamId/clips/:clipId/save",
  requireAuth,
  requireSeatAccess,
  clipManagerController.saveClip.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/reject:
 *   post:
 *     summary: Reject a clip
 *     description: Rejects an unsaved clip. The clip status is set to "rejected" and it will no longer appear in unsaved clips. The clip still counts toward usage limits.
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
 *     responses:
 *       200:
 *         description: Clip rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Clip already saved or already rejected
 *       404:
 *         description: Clip not found
 *       500:
 *         description: Server error
 */
router.post(
  "/teams/:teamId/clips/:clipId/reject",
  requireAuth,
  requireSeatAccess,
  clipManagerController.rejectClip.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/share:
 *   post:
 *     summary: Generate a share link for a clip
 *     description: Generates a unique share token that can be used to share the clip publicly. Only saved clips can be shared.
 *     tags:
 *       - Clip Sharing
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
 *         description: Share link generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 shareToken:
 *                   type: string
 *                   description: The unique token for sharing this clip
 *       400:
 *         description: Clip is not saved or invalid IDs
 *       404:
 *         description: Clip not found
 *       500:
 *         description: Server error
 */
router.post(
  "/teams/:teamId/clips/:clipId/share",
  requireAuth,
  requireSeatAccess,
  clipManagerController.generateShareLink.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/teams/{teamId}/clips/{clipId}/share:
 *   delete:
 *     summary: Remove share link from a clip
 *     description: Removes the share token from a clip, disabling public access.
 *     tags:
 *       - Clip Sharing
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
 *         description: Share link removed successfully
 *       404:
 *         description: Clip not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/teams/:teamId/clips/:clipId/share",
  requireAuth,
  requireSeatAccess,
  clipManagerController.removeShareLink.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/shared/{shareToken}:
 *   get:
 *     summary: Get a publicly shared clip
 *     description: Retrieves a clip using its share token. No authentication required.
 *     tags:
 *       - Clip Sharing
 *     parameters:
 *       - in: path
 *         name: shareToken
 *         required: true
 *         schema:
 *           type: string
 *         description: The share token for the clip
 *     responses:
 *       200:
 *         description: Successfully retrieved shared clip
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clip:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     message:
 *                       type: string
 *                     clipUrl:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Shared clip not found
 */
router.get(
  "/shared/:shareToken",
  clipManagerController.getSharedClip.bind(clipManagerController)
);

/**
 * @swagger
 * /clip-video/shared/{shareToken}/download:
 *   get:
 *     summary: Get download URL for a shared clip
 *     description: Generates a presigned download URL for a shared clip. No authentication required.
 *     tags:
 *       - Clips
 *     parameters:
 *       - in: path
 *         name: shareToken
 *         required: true
 *         schema:
 *           type: string
 *         description: The share token for the clip
 *     responses:
 *       200:
 *         description: Download URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 downloadUrl:
 *                   type: string
 *       404:
 *         description: Shared clip not found
 */
router.get(
  "/shared/:shareToken/download",
  clipManagerController.downloadSharedClip.bind(clipManagerController)
);

/**
 * @openapi
 * /clip-video/search-clips:
 *   get:
 *     summary: Search clips across teams
 *     tags:
 *       - Clips
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: q
 *         in: query
 *         schema:
 *           type: string
 *       - name: teamId
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Search results
 */
router.get(
  "/search-clips",
  requireAuth,
  clipManagerController.searchClips.bind(clipManagerController)
);

export default router;
