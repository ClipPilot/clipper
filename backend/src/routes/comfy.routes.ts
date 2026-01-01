import { Router } from "express";
import multer from "multer";
import { comfyController } from "../controllers/comfy.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /comfy/uploads:
 *   post:
 *     summary: Upload image and video to ComfyUI
 *     description: Uploads reference image and video to ComfyUI input storage. Returns filenames for workflow injection.
 *     tags:
 *       - ComfyUI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *               - video
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Reference image
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Reference video
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 image:
 *                   type: string
 *                   example: "uuid-image.jpg"
 *                 video:
 *                   type: string
 *                   example: "uuid-video.mp4"
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Upload failed
 */
router.post(
  "/uploads",
  //   requireAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  comfyController.uploadInputs.bind(comfyController)
);

/**
 * @openapi
 * /comfy/jobs:
 *   post:
 *     summary: Queue a ComfyUI workflow job
 *     description: Creates a job to process image and video through the ComfyUI workflow. The workflow template is managed by the worker.
 *     tags:
 *       - ComfyUI
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
 *               - imageFile
 *               - videoFile
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: Team ID for the job
 *               imageFile:
 *                 type: string
 *                 description: Filename of the uploaded reference image
 *               videoFile:
 *                 type: string
 *                 description: Filename of the uploaded reference video
 *     responses:
 *       201:
 *         description: Job queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 job:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [queued, running, completed, failed]
 *                     progress:
 *                       type: integer
 *                     progressMessage:
 *                       type: string
 *       400:
 *         description: Missing fields
 */
router.post(
  "/jobs",
  // requireAuth,
  comfyController.createJob.bind(comfyController)
);

/**
 * @openapi
 * /comfy/jobs/{jobId}:
 *   get:
 *     summary: Get job status
 *     tags:
 *       - ComfyUI
 *     security:
 *       - bearerAuth: []
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
  // requireAuth,
  comfyController.getJobStatus.bind(comfyController)
);

export default router;
