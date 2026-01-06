import { Router } from "express";
import { faceSwapController } from "../controllers/faceSwap.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { upload } from "../config/multer";

const router = Router();

/**
 * @openapi
 * /face-swap/trim:
 *   post:
 *     summary: Trim a video to specified time range
 *     tags: [Face Swap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [video, startTime, endTime, teamId]
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *               startTime:
 *                 type: number
 *               endTime:
 *                 type: number
 *               teamId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Trimmed video uploaded to S3
 */
router.post("/trim", requireAuth, upload.single("video"), faceSwapController.trimVideo);

/**
 * @openapi
 * /face-swap/download-fixed:
 *   get:
 *     summary: Download video with timestamp normalization (authenticated)
 *     description: Re-encodes video to fix playback on strict players (VLC, QuickTime, mobile)
 *     tags: [Face Swap]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *         description: Video URL to download and normalize
 *       - in: query
 *         name: filename
 *         schema:
 *           type: string
 *         description: Output filename
 *     responses:
 *       200:
 *         description: Normalized video file
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/download-fixed", requireAuth, faceSwapController.downloadFixed);

/**
 * @openapi
 * /face-swap/download-fixed-public:
 *   get:
 *     summary: Download video with timestamp normalization (public for shared links)
 *     description: Re-encodes video to fix playback on strict players. No auth required.
 *     tags: [Face Swap]
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *         description: Video URL to download and normalize
 *       - in: query
 *         name: filename
 *         schema:
 *           type: string
 *         description: Output filename
 *     responses:
 *       200:
 *         description: Normalized video file
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/download-fixed-public", faceSwapController.downloadFixedPublic);

export default router;
