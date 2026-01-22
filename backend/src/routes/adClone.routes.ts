import { Router } from "express";
import { adCloneController } from "../controllers/adClone.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

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
 * /ad-clone/{projectId}/analysis:
 *   get:
 *     summary: Get video analysis results
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
 *         description: Analysis results returned
 */
router.get(
  "/:projectId/analysis",
  requireAuth,
  adCloneController.getAnalysis.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/{projectId}/generate-script:
 *   post:
 *     summary: Generate adapted script from video analysis
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
 *               - characterId
 *             properties:
 *               teamId:
 *                 type: number
 *               characterId:
 *                 type: number
 *     responses:
 *       202:
 *         description: Script generation started
 */
router.post(
  "/:projectId/generate-script",
  requireAuth,
  adCloneController.generateScript.bind(adCloneController)
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
 * /ad-clone/{projectId}/generate-video:
 *   post:
 *     summary: Queue video generation job
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
 *               - voiceId
 *             properties:
 *               teamId:
 *                 type: number
 *               voiceId:
 *                 type: string
 *     responses:
 *       202:
 *         description: Video generation started
 */
router.post(
  "/:projectId/generate-video",
  requireAuth,
  adCloneController.generateVideo.bind(adCloneController)
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

/**
 * @openapi
 * /ad-clone/{projectId}:
 *   delete:
 *     summary: Delete a project
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
 *         description: Project deleted
 */
router.delete(
  "/:projectId",
  requireAuth,
  adCloneController.deleteProject.bind(adCloneController)
);

export default router;
