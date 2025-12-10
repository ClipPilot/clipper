import { Router } from "express";
import { clipVideoController } from "../controllers/clip.controller";

const router = Router();

/**
 * @openapi
 * /clip-video:
 *   post:
 *     summary: Generate AI-powered short-form video clips
 *     description: |
 *       Takes a video file, transcribes it using Deepgram, analyzes the transcript with AI to identify
 *       engaging clips, and combines them into a high-retention short-form video suitable for TikTok.
 *
 *       The process:
 *       1. Transcribes the video using Deepgram
 *       2. Uses OpenAI to identify an engaging hook (6 seconds max) and main content clips
 *       3. Creates individual video clips for each segment
 *       4. Merges all clips into a final 30-40 second video
 *
 *       The video path is configured via environment variable (LOCAL_VIDEO_PATH).
 *     tags:
 *       - Video Clipping
 *     responses:
 *       200:
 *         description: Successfully generated video clip
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClipResponse'
 *             example:
 *               clipPath: "/output/combined.mp4"
 *       400:
 *         description: No video uploaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "No video uploaded"
 *       500:
 *         description: Server error during processing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               transcription_failed:
 *                 value:
 *                   error: "Transcription failed"
 *               ai_failed:
 *                 value:
 *                   error: "Failed to generate clip suggestions"
 *               general_error:
 *                 value:
 *                   error: "Failed to transcribe"
 */
router.post("/", clipVideoController);

export default router;