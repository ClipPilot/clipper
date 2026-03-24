import { Router } from "express";
import { requireAdminAuth } from "../middleware/admin.middleware";
import {
  getPresignedUrl,
  initiateMultipart,
  completeMultipart,
  startClipFactory,
  getClipFactoryStatus,
  getClipFactoryBatchStatus,
  cancelClipFactoryBatch,
  getActiveJobs,
} from "../controllers/admin-clip-factory.controller";

const router = Router();

/**
 * @openapi
 * /api/admin/clip-factory/presigned-url:
 *   post:
 *     summary: Get presigned S3 upload URL for a video
 *     tags: [Admin - Clip Factory]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamId, fileName, contentType]
 *             properties:
 *               teamId:
 *                 type: integer
 *               fileName:
 *                 type: string
 *               contentType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Presigned URL generated
 *       400:
 *         description: Invalid input
 */
router.post("/presigned-url", requireAdminAuth, getPresignedUrl);

/**
 * @openapi
 * /api/admin/clip-factory/multipart/initiate:
 *   post:
 *     summary: Initiate multipart upload for large video files
 *     tags: [Admin - Clip Factory]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamId, fileName, contentType, fileSize]
 *             properties:
 *               teamId:
 *                 type: integer
 *               fileName:
 *                 type: string
 *               contentType:
 *                 type: string
 *               fileSize:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Multipart upload initiated
 */
router.post("/multipart/initiate", requireAdminAuth, initiateMultipart);

/**
 * @openapi
 * /api/admin/clip-factory/multipart/complete:
 *   post:
 *     summary: Complete multipart upload
 *     tags: [Admin - Clip Factory]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [s3Key, uploadId, parts]
 *             properties:
 *               s3Key:
 *                 type: string
 *               uploadId:
 *                 type: string
 *               parts:
 *                 type: array
 *     responses:
 *       200:
 *         description: Upload completed
 */
router.post("/multipart/complete", requireAdminAuth, completeMultipart);

/**
 * @openapi
 * /api/admin/clip-factory/start:
 *   post:
 *     summary: Start clip generation jobs for uploaded videos
 *     description: Creates raw video records, pending clips, and dispatches SQS jobs. Bypasses billing.
 *     tags: [Admin - Clip Factory]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamId, videos, options]
 *             properties:
 *               teamId:
 *                 type: integer
 *               videos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     s3Key:
 *                       type: string
 *                     originalFileName:
 *                       type: string
 *                     fileSize:
 *                       type: integer
 *               options:
 *                 type: object
 *                 properties:
 *                   numberOfVideos:
 *                     type: integer
 *                   promptType:
 *                     type: string
 *                   conversionMode:
 *                     type: string
 *                   captions:
 *                     type: boolean
 *                   captionColor:
 *                     type: string
 *                   captionFont:
 *                     type: string
 *                   autoHeading:
 *                     type: boolean
 *                   headingInstructions:
 *                     type: string
 *     responses:
 *       200:
 *         description: Jobs started successfully
 *       400:
 *         description: Invalid input
 */
router.post("/start", requireAdminAuth, startClipFactory);

/**
 * @openapi
 * /api/admin/clip-factory/status:
 *   post:
 *     summary: Get clip generation status for a batch
 *     tags: [Admin - Clip Factory]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rawVideoPublicIds, teamId]
 *             properties:
 *               rawVideoPublicIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               teamId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Job statuses
 */
router.post("/status", requireAdminAuth, getClipFactoryStatus);

/**
 * @openapi
 * /api/admin/clip-factory/batch/{batchId}:
 *   get:
 *     summary: Get batch processing status by batch ID
 *     tags: [Admin - Clip Factory]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Batch status
 */
router.get("/batch/:batchId", requireAdminAuth, getClipFactoryBatchStatus);

/**
 * @openapi
 * /api/admin/clip-factory/batch/{batchId}/cancel:
 *   post:
 *     summary: Cancel a running clip factory batch
 *     tags: [Admin - Clip Factory]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Batch cancelled
 *       400:
 *         description: Invalid batchId
 */
router.post("/batch/:batchId/cancel", requireAdminAuth, cancelClipFactoryBatch);

/**
 * @openapi
 * /api/admin/clip-factory/active-jobs:
 *   get:
 *     summary: Get currently active/pending clip jobs for a team
 *     tags: [Admin - Clip Factory]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Active jobs
 */
router.get("/active-jobs", requireAdminAuth, getActiveJobs);

export default router;
