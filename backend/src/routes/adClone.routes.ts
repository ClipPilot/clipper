import { Router } from "express";
import { adCloneController } from "../controllers/adClone.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /ad-clone/init-structure:
 *   post:
 *     summary: Generate UGC-compatible structure from ad analysis via agent
 *     tags:
 *       - Ad Clone
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - message
 *             properties:
 *               projectId:
 *                 type: string
 *               message:
 *                 type: string
 *               productImageKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *               threadId:
 *                 type: string
 *               conversationHistory:
 *                 type: array
 *     responses:
 *       200:
 *         description: Structure or conversation response from agent
 */
router.post(
  "/init-structure",
  requireAuth,
  adCloneController.initStructure.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/create:
 *   post:
 *     summary: Create a new Ad Clone project
 *     tags:
 *       - Ad Clone
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
 *             properties:
 *               teamId:
 *                 type: number
 *               productName:
 *                 type: string
 *               productDescription:
 *                 type: string
 *               adDirection:
 *                 type: string
 *     responses:
 *       201:
 *         description: Project created with upload URLs
 */
router.post(
  "/create",
  requireAuth,
  adCloneController.createProject.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/upload-urls:
 *   post:
 *     summary: Get presigned upload URLs for video and product images
 *     tags:
 *       - Ad Clone
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
 *               - projectId
 *               - videoFileName
 *             properties:
 *               teamId:
 *                 type: number
 *               projectId:
 *                 type: string
 *               videoFileName:
 *                 type: string
 *               productImageFileNames:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Upload URLs returned
 */
router.post(
  "/upload-urls",
  requireAuth,
  adCloneController.getUploadUrls.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/{projectId}/confirm-upload:
 *   post:
 *     summary: Confirm that files have been uploaded to S3
 *     tags:
 *       - Ad Clone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - referenceVideoKey
 *             properties:
 *               referenceVideoKey:
 *                 type: string
 *               productImageKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Upload confirmed
 */
router.post(
  "/:projectId/confirm-upload",
  requireAuth,
  adCloneController.confirmUpload.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/{projectId}/analyze:
 *   post:
 *     summary: Start video analysis with Gemini
 *     tags:
 *       - Ad Clone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
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
 *                 type: number
 *     responses:
 *       202:
 *         description: Analysis started
 */
router.post(
  "/:projectId/analyze",
  requireAuth,
  adCloneController.startAnalysis.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/{projectId}/script:
 *   put:
 *     summary: Update/edit the adapted script
 *     tags:
 *       - Ad Clone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - script
 *             properties:
 *               script:
 *                 type: object
 *               selectedVariantIndex:
 *                 type: number
 *     responses:
 *       200:
 *         description: Script updated
 */
router.put(
  "/:projectId/script",
  requireAuth,
  adCloneController.updateScript.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/{projectId}/finalize:
 *   post:
 *     summary: Finalize project and save to clips library
 *     tags:
 *       - Ad Clone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
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
 *                 type: number
 *               folderId:
 *                 type: number
 *     responses:
 *       200:
 *         description: Project finalized and saved to library
 */
router.post(
  "/:projectId/finalize",
  requireAuth,
  adCloneController.finalizeProject.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/{projectId}/link-video-job:
 *   post:
 *     summary: Link a UGC video generation job to this ad clone project
 *     tags:
 *       - Ad Clone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoJobId
 *             properties:
 *               videoJobId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Video job linked
 */
router.post(
  "/:projectId/link-video-job",
  requireAuth,
  adCloneController.linkVideoJob.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/{projectId}/status:
 *   get:
 *     summary: Get project status and progress
 *     tags:
 *       - Ad Clone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status returned
 */
router.get(
  "/:projectId/status",
  requireAuth,
  adCloneController.getStatus.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/{projectId}:
 *   get:
 *     summary: Get full project details
 *     tags:
 *       - Ad Clone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project details returned
 */
router.get(
  "/:projectId",
  requireAuth,
  adCloneController.getProject.bind(adCloneController)
);

export default router;
