import { Router } from "express";
import { sceneBuilderController } from "../controllers/sceneBuilder.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /scene-builder/generate-scene-images:
 *   post:
 *     summary: Generate images for a single scene
 *     description: |
 *       Queues a background job to generate 4 AI images for a specific scene.
 *       Returns a job ID immediately. Poll /scene-generation-status/:jobId for progress.
 *     tags:
 *       - Scene Builder
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
 *               - scriptId
 *               - sceneId
 *               - sceneNumber
 *             properties:
 *               teamId:
 *                 type: integer
 *               scriptId:
 *                 type: string
 *                 format: uuid
 *               sceneId:
 *                 type: string
 *               sceneNumber:
 *                 type: integer
 *               userRefinement:
 *                 type: string
 *                 description: Optional additional direction for the scene
 *               supportingImageKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional S3 keys of supporting reference images
 *     responses:
 *       202:
 *         description: Generation job queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GenerateSceneImagesResponse'
 *       400:
 *         description: Missing required parameters
 *       403:
 *         description: UGC Studio access required
 *       404:
 *         description: Script or scene not found
 */
router.post(
  "/generate-scene-images",
  requireAuth,
  sceneBuilderController.generateSceneImages.bind(sceneBuilderController)
);

/**
 * @openapi
 * /scene-builder/generate-all-scene-images:
 *   post:
 *     summary: Generate images for all scenes in a script
 *     description: |
 *       Queues background jobs to generate images for multiple scenes.
 *       Returns an array of job IDs. Poll each job for status.
 *     tags:
 *       - Scene Builder
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
 *               - scriptId
 *               - scenes
 *             properties:
 *               teamId:
 *                 type: integer
 *               scriptId:
 *                 type: string
 *                 format: uuid
 *               scenes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - sceneId
 *                     - sceneNumber
 *                   properties:
 *                     sceneId:
 *                       type: string
 *                     sceneNumber:
 *                       type: integer
 *                     userRefinement:
 *                       type: string
 *                     supportingImageKeys:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       202:
 *         description: Generation jobs queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GenerateAllSceneImagesResponse'
 *       400:
 *         description: Missing required parameters
 *       403:
 *         description: UGC Studio access required
 */
router.post(
  "/generate-all-scene-images",
  requireAuth,
  sceneBuilderController.generateAllSceneImages.bind(sceneBuilderController)
);

/**
 * @openapi
 * /scene-builder/scene-generation-status/{jobId}:
 *   get:
 *     summary: Get scene image generation job status
 *     description: |
 *       Poll this endpoint to check generation progress. When status is 'completed',
 *       the response includes generated images with presigned URLs.
 *     tags:
 *       - Scene Builder
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
 *         description: Job status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SceneGenerationStatus'
 *       404:
 *         description: Job not found
 */
router.get(
  "/scene-generation-status/:jobId",
  requireAuth,
  sceneBuilderController.getGenerationStatus.bind(sceneBuilderController)
);

/**
 * @openapi
 * /scene-builder/cancel-job/{jobId}:
 *   post:
 *     summary: Cancel a generating or stuck job
 *     description: Marks a job as failed so the user can retry generation
 *     tags:
 *       - Scene Builder
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
 *         description: Job cancelled successfully
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
 *       400:
 *         description: Cannot cancel completed job
 *       404:
 *         description: Job not found
 */
router.post(
  "/cancel-job/:jobId",
  requireAuth,
  sceneBuilderController.cancelJob.bind(sceneBuilderController)
);

/**
 * @openapi
 * /scene-builder/script/{scriptId}/scene-images:
 *   get:
 *     summary: Get all saved scene images for a script
 *     description: Returns selected images for each scene in the script
 *     tags:
 *       - Scene Builder
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scriptId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scene images retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SceneImagesResponse'
 */
router.get(
  "/script/:scriptId/scene-images",
  requireAuth,
  sceneBuilderController.getSceneImages.bind(sceneBuilderController)
);

/**
 * @openapi
 * /scene-builder/select-scene-image:
 *   post:
 *     summary: Select/save an image for a scene
 *     description: Saves the user's selected image for a specific scene
 *     tags:
 *       - Scene Builder
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scriptId
 *               - sceneId
 *               - sceneNumber
 *               - imageKey
 *             properties:
 *               scriptId:
 *                 type: string
 *                 format: uuid
 *               sceneId:
 *                 type: string
 *               sceneNumber:
 *                 type: integer
 *               imageKey:
 *                 type: string
 *               generationJobId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Scene image updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - sceneImage
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sceneImage:
 *                   type: object
 *       201:
 *         description: Scene image created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - sceneImage
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sceneImage:
 *                   type: object
 *       400:
 *         description: Missing required parameters
 */
router.post(
  "/select-scene-image",
  requireAuth,
  sceneBuilderController.selectSceneImage.bind(sceneBuilderController)
);

/**
 * @openapi
 * /scene-builder/upload-supporting-image:
 *   post:
 *     summary: Get presigned URL for supporting image upload
 *     description: Returns a presigned S3 URL for uploading supporting images
 *     tags:
 *       - Scene Builder
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
 *               - fileName
 *             properties:
 *               teamId:
 *                 type: integer
 *               fileName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Presigned URL generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SceneUploadUrlResponse'
 */
router.post(
  "/upload-supporting-image",
  requireAuth,
  sceneBuilderController.getUploadUrl.bind(sceneBuilderController)
);

/**
 * @openapi
 * /scene-builder/upload-to-key:
 *   post:
 *     summary: Get presigned URL to upload to a specific S3 key
 *     description: Returns a presigned S3 URL for uploading to replace an existing image (e.g., custom B-roll)
 *     tags:
 *       - Scene Builder
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - s3Key
 *             properties:
 *               s3Key:
 *                 type: string
 *                 description: The exact S3 key to upload to
 *               contentType:
 *                 type: string
 *                 default: image/jpeg
 *     responses:
 *       200:
 *         description: Presigned URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - uploadUrl
 *                 - s3Key
 *               properties:
 *                 success:
 *                   type: boolean
 *                 uploadUrl:
 *                   type: string
 *                   format: uri
 *                 s3Key:
 *                   type: string
 */
router.post(
  "/upload-to-key",
  requireAuth,
  sceneBuilderController.getUploadUrlForKey.bind(sceneBuilderController)
);

export default router;
