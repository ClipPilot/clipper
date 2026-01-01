import { Router, Request, Response } from "express";
import { emitClipsRefresh, emitClipUpdate } from "../services/socket.service";
import { comfyController } from "../controllers/comfy.controller";

const router = Router();

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

const validateInternalKey = (req: Request, res: Response, next: Function) => {
  const apiKey = req.headers["x-internal-api-key"];

  if (!INTERNAL_API_KEY) {
    return next();
  }

  if (apiKey !== INTERNAL_API_KEY) {
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
router.post("/notify/clips-refresh", validateInternalKey, (req: Request, res: Response) => {
  const { teamId } = req.body;

  if (!teamId) {
    return res.status(400).json({ error: "teamId is required" });
  }

  emitClipsRefresh(teamId);
  console.log(`[INTERNAL] Emitted clips-refresh for team ${teamId}`);

  return res.status(200).json({ success: true });
});

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
router.post("/notify/clip-update", validateInternalKey, (req: Request, res: Response) => {
  const { teamId, clipId, clip } = req.body;

  if (!teamId) {
    return res.status(400).json({ error: "teamId is required" });
  }

  emitClipUpdate(teamId, clip || { id: clipId });
  console.log(`[INTERNAL] Emitted clip-update for team ${teamId}, clip ${clipId}`);

  return res.status(200).json({ success: true });
});

/**
 * @openapi
 * /internal/comfy/next-job:
 *   post:
 *     summary: GPU pod pulls next available job
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
 *               - podId
 *             properties:
 *               podId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Job assigned or null if queue empty
 */
router.post(
  "/comfy/next-job",
  validateInternalKey,
  comfyController.assignNextJob.bind(comfyController)
);

/**
 * @openapi
 * /internal/comfy/progress:
 *   post:
 *     summary: Worker reports job progress
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
 *               - jobId
 *               - progress
 *             properties:
 *               jobId:
 *                 type: string
 *                 format: uuid
 *               progress:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Progress updated
 */
router.post(
  "/comfy/progress",
  validateInternalKey,
  comfyController.updateProgress.bind(comfyController)
);

/**
 * @openapi
 * /internal/comfy/complete:
 *   post:
 *     summary: GPU pod marks job completed or failed
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
 *               - jobId
 *               - success
 *             properties:
 *               jobId:
 *                 type: string
 *                 format: uuid
 *               success:
 *                 type: boolean
 *               outputFile:
 *                 type: string
 *               errorMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job marked complete
 */
router.post(
  "/comfy/complete",
  validateInternalKey,
  comfyController.completeJob.bind(comfyController)
);

export default router;
