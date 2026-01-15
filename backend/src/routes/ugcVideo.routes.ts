import { Router } from "express";
import { ugcVideoController } from "../controllers/ugcVideo.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /ugc-video/jobs:
 *   get:
 *     summary: List video generation jobs for a team
 *     description: |
 *       Returns a paginated list of video generation jobs for the specified team.
 *       Includes job status, progress, thumbnails, and video URLs for completed jobs.
 *     tags:
 *       - UGC Video
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Number of jobs to return (max 50)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of jobs to skip
 *     responses:
 *       200:
 *         description: List of video jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       scriptId:
 *                         type: string
 *                         format: uuid
 *                       scriptTitle:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [queued, generating, completed, failed]
 *                       progress:
 *                         type: integer
 *                       progressMessage:
 *                         type: string
 *                       thumbnailUrl:
 *                         type: string
 *                         description: Presigned URL for thumbnail
 *                       finalVideoUrl:
 *                         type: string
 *                         description: Presigned URL (only for completed)
 *                       totalDurationSeconds:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                   description: Total number of jobs
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       400:
 *         description: Missing teamId parameter
 */
router.get(
  "/jobs",
  requireAuth,
  ugcVideoController.listVideoJobs.bind(ugcVideoController)
);

/**
 * @openapi
 * /ugc-video/generate:
 *   post:
 *     summary: Generate a UGC video from a script
 *     description: |
 *       Queues a background job to generate a full video from all scenes in a script.
 *       Each scene goes through: TTS audio → image-to-video → lipsync (a-roll) or overlay (b-roll/mixed).
 *       Returns a job ID immediately. Poll /status/:jobId for progress.
 *     tags:
 *       - UGC Video
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
 *               - scriptId
 *               - voiceId
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID
 *               scriptId:
 *                 type: string
 *                 format: uuid
 *                 description: The script ID to generate video from
 *               voiceId:
 *                 type: string
 *                 description: ElevenLabs voice ID for TTS
 *     responses:
 *       202:
 *         description: Video generation job queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobId:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [queued]
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required parameters or script not ready
 *       403:
 *         description: UGC Studio access required
 *       404:
 *         description: Script not found
 */
router.post(
  "/generate",
  requireAuth,
  ugcVideoController.generateVideo.bind(ugcVideoController)
);

/**
 * @openapi
 * /ugc-video/status/{jobId}:
 *   get:
 *     summary: Get video generation job status
 *     description: |
 *       Poll this endpoint to check video generation progress.
 *       When status is 'completed', the response includes the final video URL.
 *     tags:
 *       - UGC Video
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The video generation job ID
 *     responses:
 *       200:
 *         description: Job status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [queued, generating, completed, failed]
 *                 progress:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 100
 *                 progressMessage:
 *                   type: string
 *                 finalVideoUrl:
 *                   type: string
 *                   description: Presigned URL (only when completed)
 *                 totalDurationSeconds:
 *                   type: integer
 *                   description: Total video duration (only when completed)
 *                 error:
 *                   type: string
 *                   description: Error message (only when failed)
 *       404:
 *         description: Job not found
 */
router.get(
  "/status/:jobId",
  requireAuth,
  ugcVideoController.getVideoGenerationStatus.bind(ugcVideoController)
);

/**
 * @openapi
 * /ugc-video/script/{scriptId}:
 *   get:
 *     summary: Get the generated video for a script
 *     description: Returns the most recently completed video for a script
 *     tags:
 *       - UGC Video
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scriptId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The script ID
 *     responses:
 *       200:
 *         description: Video retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   format: uuid
 *                 videoKey:
 *                   type: string
 *                 videoUrl:
 *                   type: string
 *                   description: Presigned URL for the video
 *                 totalDurationSeconds:
 *                   type: integer
 *                 sceneVideos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sceneId:
 *                         type: string
 *                       sceneNumber:
 *                         type: integer
 *                       audioKey:
 *                         type: string
 *                       videoKey:
 *                         type: string
 *       404:
 *         description: No completed video found for this script
 */
router.get(
  "/script/:scriptId",
  requireAuth,
  ugcVideoController.getScriptVideo.bind(ugcVideoController)
);

/**
 * @openapi
 * /ugc-video/finalize:
 *   post:
 *     summary: Finalize a completed video and create a clip
 *     description: |
 *       Creates a clip record in the library from a completed UGC video.
 *       The clip can then be edited with captions and text overlays.
 *     tags:
 *       - UGC Video
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - teamId
 *             properties:
 *               jobId:
 *                 type: string
 *                 format: uuid
 *                 description: The completed video generation job ID
 *               teamId:
 *                 type: integer
 *                 description: The team ID
 *     responses:
 *       200:
 *         description: Video finalized and clip created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 clipId:
 *                   type: integer
 *                   description: The new clip ID
 *                 clipPath:
 *                   type: string
 *                   description: S3 key of the video
 *       400:
 *         description: Video not completed or missing parameters
 *       404:
 *         description: Job not found
 */
router.post(
  "/finalize",
  requireAuth,
  ugcVideoController.finalizeVideo.bind(ugcVideoController)
);

export default router;
