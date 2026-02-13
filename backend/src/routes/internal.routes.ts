import { Router, Request, Response } from "express";
import {
  notifyClipsRefresh,
  notifyClipUpdate,
  notifyComfyJobUpdate,
  notifyScriptJobUpdate,
  notifyUGCVideoJobUpdate,
  notifyAdCloneJobUpdate,
  notifyAdPostingUpdate,
} from "../controllers/internal.controller";

const router = Router();

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

const validateInternalKey = (req: Request, res: Response, next: Function) => {
  if (!INTERNAL_API_KEY) {
    console.error("INTERNAL_API_KEY is not configured");
    return res.status(500).json({ error: "Internal API not configured" });
  }

  const apiKey = req.headers["x-internal-api-key"];

  if (!apiKey || apiKey !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};

/**
 * @openapi
 * /internal/notify/clips-refresh:
 *   post:
 *     summary: Trigger clips refresh notification
 *     description: |
 *       Internal endpoint used by the worker to notify clients that new clips
 *       are available. Emits a WebSocket event to all connected clients for the team.
 *     tags:
 *       - Internal
 *     security:
 *       - internalApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID to notify
 *                 example: 1
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing teamId
 *       401:
 *         description: Invalid internal API key
 */
router.post("/notify/clips-refresh", validateInternalKey, notifyClipsRefresh);

/**
 * @openapi
 * /internal/notify/clip-update:
 *   post:
 *     summary: Trigger single clip update notification
 *     description: |
 *       Internal endpoint used by the worker to notify clients that a specific
 *       clip has been updated. Emits a WebSocket event with the clip data.
 *     tags:
 *       - Internal
 *     security:
 *       - internalApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID to notify
 *                 example: 1
 *               clipId:
 *                 type: integer
 *                 description: The clip ID that was updated
 *                 example: 123
 *               clip:
 *                 type: object
 *                 description: Full clip object to send to clients
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing teamId
 *       401:
 *         description: Invalid internal API key
 */
router.post("/notify/clip-update", validateInternalKey, notifyClipUpdate);

/**
 * @openapi
 * /internal/notify/comfy-job-update:
 *   post:
 *     summary: Trigger ComfyUI job update notification
 *     description: |
 *       Internal endpoint used by the worker to notify clients of ComfyUI job
 *       progress updates. Emits a WebSocket event with job status and output.
 *     tags:
 *       - Internal
 *     security:
 *       - internalApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - job
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID to notify
 *               job:
 *                 type: object
 *                 required:
 *                   - id
 *                   - status
 *                 properties:
 *                   id:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [pending_upload, queued, running, completed, failed, deleted]
 *                   progress:
 *                     type: number
 *                   progressMessage:
 *                     type: string
 *                   outputUrl:
 *                     type: string
 *                   errorMessage:
 *                     type: string
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       400:
 *         description: Missing teamId or job
 *       401:
 *         description: Invalid internal API key
 */
router.post("/notify/comfy-job-update", validateInternalKey, notifyComfyJobUpdate);

/**
 * @openapi
 * /internal/notify/script-job-update:
 *   post:
 *     summary: Trigger script generation job update notification
 *     description: |
 *       Internal endpoint used by the worker to notify clients of script generation
 *       progress. Emits a WebSocket event with generation status and results.
 *     tags:
 *       - Internal
 *     security:
 *       - internalApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - update
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID to notify
 *               update:
 *                 type: object
 *                 required:
 *                   - scriptId
 *                   - status
 *                   - progress
 *                   - progressMessage
 *                 properties:
 *                   scriptId:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [queued, generating, completed, failed]
 *                   progress:
 *                     type: integer
 *                     minimum: 0
 *                     maximum: 100
 *                   progressMessage:
 *                     type: string
 *                   scripts:
 *                     type: array
 *                     description: Generated scripts (when status is completed)
 *                   error:
 *                     type: string
 *                     description: Error message (when status is failed)
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       400:
 *         description: Missing teamId or update
 *       401:
 *         description: Invalid internal API key
 */
router.post("/notify/script-job-update", validateInternalKey, notifyScriptJobUpdate);

/**
 * @openapi
 * /internal/notify/ugc-video-job-update:
 *   post:
 *     summary: Trigger UGC video job update notification
 *     tags:
 *       - Internal
 *     security:
 *       - internalApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - update
 *             properties:
 *               teamId:
 *                 type: integer
 *               update:
 *                 type: object
 *                 properties:
 *                   jobId:
 *                     type: string
 *     responses:
 *       200:
 *         description: Notification sent
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid internal API key
 */
router.post("/notify/ugc-video-job-update", validateInternalKey, notifyUGCVideoJobUpdate);

/**
 * @openapi
 * /internal/notify/ad-clone-job-update:
 *   post:
 *     summary: Trigger ad clone job update notification
 *     description: |
 *       Internal endpoint used by the worker to notify clients of ad clone job
 *       progress updates. Emits a WebSocket event with analysis/script status.
 *     tags:
 *       - Internal
 *     security:
 *       - internalApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - update
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID to notify
 *               update:
 *                 type: object
 *                 required:
 *                   - projectId
 *                   - status
 *                   - progress
 *                   - progressMessage
 *                 properties:
 *                   projectId:
 *                     type: string
 *                     format: uuid
 *                   status:
 *                     type: string
 *                     enum: [analyzing, analysis_complete, generating_script, script_generated, generating_video, completed, failed]
 *                   progress:
 *                     type: integer
 *                     minimum: 0
 *                     maximum: 100
 *                   progressMessage:
 *                     type: string
 *                   analysis:
 *                     type: object
 *                     description: Video analysis result (when status is analysis_complete)
 *                   scripts:
 *                     type: array
 *                     description: Generated scripts (when status is script_generated)
 *                   error:
 *                     type: string
 *                     description: Error message (when status is failed)
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       400:
 *         description: Missing teamId or update
 *       401:
 *         description: Invalid internal API key
 */
router.post("/notify/ad-clone-job-update", validateInternalKey, notifyAdCloneJobUpdate);

/**
 * @openapi
 * /internal/notify/ad-posting-update:
 *   post:
 *     summary: Trigger ad posting progress notification
 *     description: |
 *       Internal endpoint used by the worker to notify clients of ad posting
 *       progress. Emits a WebSocket event with per-copy encoding/upload status.
 *     tags:
 *       - Internal
 *     security:
 *       - internalApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - update
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID to notify
 *               update:
 *                 type: object
 *                 required:
 *                   - clipId
 *                   - platform
 *                   - platformName
 *                   - status
 *                   - totalItems
 *                   - completedItems
 *                 properties:
 *                   clipId:
 *                     type: integer
 *                   platform:
 *                     type: string
 *                   platformName:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [processing, uploaded, failed, complete]
 *                   postId:
 *                     type: integer
 *                     description: Created post ID (when status is uploaded)
 *                   error:
 *                     type: string
 *                     description: Error message (when status is failed)
 *                   totalItems:
 *                     type: integer
 *                     description: Total copies across all platforms
 *                   completedItems:
 *                     type: integer
 *                     description: Number of copies processed so far
 *                   copyIndex:
 *                     type: integer
 *                     description: Index of this copy within its platform
 *                   platformTotal:
 *                     type: integer
 *                     description: Total copies for this platform
 *                   successCount:
 *                     type: integer
 *                     description: Successful uploads (when status is complete)
 *                   failedCount:
 *                     type: integer
 *                     description: Failed uploads (when status is complete)
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       400:
 *         description: Missing teamId or update
 *       401:
 *         description: Invalid internal API key
 */
router.post("/notify/ad-posting-update", validateInternalKey, notifyAdPostingUpdate);

export default router;
