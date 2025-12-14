import { Router, Request, Response, NextFunction } from "express";
import { clipVideoController } from "../controllers/clip.controller";
import { clipManagerController } from "../controllers/clipManager.controller";
import { upload } from "../config/multer";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Multer error handling middleware
const handleMulterError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File too large",
        message:
          "The uploaded video file exceeds the maximum size limit of 10GB",
        maxSize: "10GB",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error: "Unexpected file",
        message:
          'Only one video file should be uploaded with field name "video"',
      });
    }
    if (err.message) {
      return res.status(400).json({
        error: "Upload error",
        message: err.message,
      });
    }
  }
  next(err);
};

/**
 * @openapi
 * /clip-video:
 *   post:
 *     summary: Generate AI-powered short-form video clips
 *     description: |
 *       Upload a video file and generate an AI-powered short-form clip suitable for TikTok, YouTube Shorts, or Instagram Reels.
 *       
 *       **Important:** This endpoint checks team usage limits before processing. If the limit is reached, a 403 error is returned.
 *
 *       The process:
 *       1. Transcribes the uploaded video using Deepgram
 *       2. Uses OpenAI with customizable prompts to identify engaging clips
 *       3. Creates individual video clips for hook and main content
 *       4. Merges all clips into a final optimized video
 *
 *       **Prompt Types:**
 *       - `business`: Optimized for product demos and business content with clear explanations
 *       - `viral`: Optimized for entertaining content, funny moments, and stream highlights
 *
 *       **Custom Instructions:**
 *       You can provide additional instructions to customize the AI's clip selection.
 *     tags:
 *       - Video Clipping
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID for usage tracking (required)
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: The video file to process (mp4, mov, avi, mkv, webm - max 10GB)
 *               length:
 *                 type: integer
 *                 default: 40
 *                 minimum: 10
 *                 maximum: 120
 *                 description: Desired total length of the final clip in seconds
 *               hookLength:
 *                 type: integer
 *                 default: 6
 *                 minimum: 2
 *                 maximum: 15
 *                 description: Length of the hook/attention-grabbing opening in seconds
 *               promptType:
 *                 type: string
 *                 enum: [business, viral]
 *                 default: business
 *                 description: |
 *                   Type of prompt to use:
 *                   - business: For product demos, explanations, and professional content
 *                   - viral: For funny moments, stream highlights, and entertaining clips
 *               customPrompt:
 *                 type: string
 *                 description: Optional custom instructions for the AI (e.g., "Focus on funny moments with the dog" or "Highlight the product features")
 *               textPrompt:
 *                 type: string
 *                 description: Optional text prompt specifying what kind of clips to find (e.g., "moments about the new feature" or "funny reactions")
 *               numberOfVideos:
 *                 type: integer
 *                 default: 1
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Number of different video variations to generate (each with unique approaches and styles)
 *               customText:
 *                 type: string
 *                 description: Optional text overlay to display on the video (e.g., "🔥 MUST WATCH 🔥", "NEW PRODUCT ALERT", "WAIT FOR IT...")
 *               textPosition:
 *                 type: string
 *                 enum: [top, middle, bottom]
 *                 default: top
 *                 description: Position of the text overlay (top, middle, or bottom of video)
 *               textColor:
 *                 type: string
 *                 description: Color of the custom text overlay (hex color code)
 *               captions:
 *                 type: boolean
 *                 description: Whether to add captions overlay based on transcription
 *               captionColor:
 *                 type: string
 *                 description: Hex color for caption highlight (e.g., "#FFD600" for yellow)
 *           examples:
 *             business_video:
 *               summary: Business/Product Demo
 *               value:
 *                 video: (binary)
 *                 length: 40
 *                 hookLength: 6
 *                 promptType: business
 *             viral_clip:
 *               summary: Viral/Stream Highlight
 *               value:
 *                 video: (binary)
 *                 length: 30
 *                 hookLength: 5
 *                 promptType: viral
 *                 customPrompt: Focus on the funniest reactions and most chaotic moments
 *                 customText: "🔥 WAIT FOR IT 🔥"
 *                 textPosition: top
 *             custom_text_example:
 *               summary: With Custom Text Overlay
 *               value:
 *                 video: (binary)
 *                 promptType: business
 *                 customText: "NEW PRODUCT ALERT 🚀"
 *                 textPosition: bottom
 *             multiple_videos_example:
 *               summary: Generate Multiple Video Variations
 *               value:
 *                 video: (binary)
 *                 promptType: viral
 *                 numberOfVideos: 3
 *                 textPrompt: "focus on funny moments and epic fails"
 *                 length: 30
 *     responses:
 *       200:
 *         description: Successfully generated video clip
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 videos:
 *                   type: array
 *                   description: Array of generated video clips (one or more based on numberOfVideos parameter)
 *                   items:
 *                     type: object
 *                     properties:
 *                       clipPath:
 *                         type: string
 *                         description: Local file path to the generated clip
 *                       clipSuggestions:
 *                         type: object
 *                         description: AI-generated clip suggestions with timestamps
 *                       finalMessage:
 *                         type: string
 *                         description: AI-generated message explaining what makes this clip engaging
 *                       evalScore:
 *                         type: number
 *                         description: Score from 0-100 rating the viral potential and quality of this clip
 *                 parameters:
 *                   type: object
 *                   properties:
 *                     length:
 *                       type: integer
 *                     hookLength:
 *                       type: integer
 *                     promptType:
 *                       type: string
 *                     numberOfVideos:
 *                       type: integer
 *             example:
 *               videos:
 *                 - clipPath: "/output/combined_0.mp4"
 *                   clipSuggestions:
 *                     hook:
 *                       start: 45.2
 *                       end: 51.2
 *                       text: "This is the most insane feature I've ever seen!"
 *                     main:
 *                       - start: 12.5
 *                         end: 25.8
 *                         text: "So here's how it works..."
 *                     combined_script: "Full script of the combined clip"
 *                   finalMessage: "This clip features an emotionally charged hook followed by a clear product demonstration that maintains viewer engagement throughout."
 *                   evalScore: 85
 *               parameters:
 *                 length: 40
 *                 hookLength: 6
 *                 promptType: business
 *                 numberOfVideos: 1
 *       401:
 *         description: Unauthorized - missing or invalid bearer token
 *       403:
 *         description: Usage limit reached
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 message:
 *                   type: string
 *                 usage:
 *                   type: object
 *       400:
 *         description: Bad request - invalid parameters or missing video
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               no_video:
 *                 value:
 *                   error: "No video file uploaded"
 *               invalid_length:
 *                 value:
 *                   error: "Length must be between 10 and 120 seconds"
 *               invalid_prompt_type:
 *                 value:
 *                   error: 'Prompt type must be either "business" or "viral"'
 *       500:
 *         description: Server error during processing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               transcription_failed:
 *                 value:
 *                   error: "Transcription failed"
 *               ai_failed:
 *                 value:
 *                   error: "Failed to generate clip suggestions"
 */
router.post(
  "/",
  requireAuth,
  upload.single("video"),
  handleMulterError,
  clipVideoController
);

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

export default router;
