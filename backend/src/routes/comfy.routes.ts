import { Router } from "express";
import multer from "multer";
import { comfyController } from "../controllers/comfy.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /comfy/ugc-face-swap:
 *   post:
 *     summary: Queue a UGC face swap job
 *     description: Upload image and video, process through ComfyUI face swap. Videos split into 10s chunks, processed, then stitched. Max 30 seconds.
 *     tags:
 *       - ComfyUI
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - image
 *               - video
 *             properties:
 *               teamId:
 *                 type: integer
 *               image:
 *                 type: string
 *                 format: binary
 *               video:
 *                 type: string
 *                 format: binary
 *     responses:
 *       202:
 *         description: Job queued
 *       400:
 *         description: Invalid input or video too long
 */
router.post(
  "/ugc-face-swap",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  comfyController.createUGCFaceSwapJob.bind(comfyController)
);

/**
 * @openapi
 * /comfy/jobs/{jobId}:
 *   get:
 *     summary: Get job status
 *     tags:
 *       - ComfyUI
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job details
 *       404:
 *         description: Job not found
 */
router.get(
  "/jobs/:jobId",
  comfyController.getJobStatus.bind(comfyController)
);

/**
 * @openapi
 * /comfy/team/{teamId}/jobs:
 *   get:
 *     summary: Get all jobs for a team
 *     tags:
 *       - ComfyUI
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of jobs
 */
router.get(
  "/team/:teamId/jobs",
  comfyController.getTeamJobs.bind(comfyController)
);

export default router;
