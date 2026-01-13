import { Router } from "express";
import multer from "multer";
import { comfyController } from "../controllers/comfy.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const optionalMulter = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
]);

const conditionalMulter = (req: any, res: any, next: any) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return optionalMulter(req, res, next);
  }
  next();
};

router.post(
  "/ugc-upload-urls",
  requireAuth,
  comfyController.getUGCUploadUrls.bind(comfyController)
);

router.post(
  "/ugc-face-swap",
  requireAuth,
  conditionalMulter,
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
  requireAuth,
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
  requireAuth,
  comfyController.getTeamJobs.bind(comfyController)
);

/**
 * @openapi
 * /comfy/jobs/{jobId}:
 *   delete:
 *     summary: Delete a job
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
 *         description: Job deleted
 *       404:
 *         description: Job not found
 */
router.delete(
  "/jobs/:jobId",
  requireAuth,
  comfyController.deleteJob.bind(comfyController)
);

export default router;
