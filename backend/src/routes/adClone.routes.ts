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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *               properties:
 *                 success:
 *                   type: boolean
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdCloneCreateResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdCloneUploadUrlsResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - projectId
 *                 - status
 *                 - message
 *               properties:
 *                 success:
 *                   type: boolean
 *                 projectId:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [analyzing]
 *                 message:
 *                   type: string
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - clipId
 *               properties:
 *                 success:
 *                   type: boolean
 *                 clipId:
 *                   type: integer
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *               properties:
 *                 success:
 *                   type: boolean
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdCloneProjectStatus'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - project
 *               properties:
 *                 success:
 *                   type: boolean
 *                 project:
 *                   type: object
 *                   required:
 *                     - id
 *                     - teamId
 *                     - status
 *                     - progress
 *                     - progressMessage
 *                     - selectedVariantIndex
 *                     - createdAt
 *                     - updatedAt
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     teamId:
 *                       type: integer
 *                     productName:
 *                       type: string
 *                     productDescription:
 *                       type: string
 *                     adDirection:
 *                       type: string
 *                     status:
 *                       type: string
 *                     progress:
 *                       type: integer
 *                     progressMessage:
 *                       type: string
 *                     selectedVariantIndex:
 *                       type: integer
 *                     characterId:
 *                       type: integer
 *                       nullable: true
 *                     voiceId:
 *                       type: string
 *                       nullable: true
 *                     referenceVideoUrl:
 *                       type: string
 *                     productImageUrls:
 *                       type: array
 *                       items:
 *                         type: string
 *                     finalVideoUrl:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                 analysis:
 *                   type: object
 *                 scripts:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get(
  "/:projectId",
  requireAuth,
  adCloneController.getProject.bind(adCloneController)
);

export default router;
