import { Router } from "express";
import { adCloneController } from "../controllers/adClone.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /ad-clone/init-structure:
 *   post:
 *     summary: Generate UGC-compatible structure from ad analysis via agent
 *     description: Calls the adDeconstructorAgent with the project's video analysis to generate a UGC-compatible scene structure. If analysis is not yet complete, the agent will respond conversationally.
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
 * /ad-clone/projects:
 *   get:
 *     summary: List all Ad Clone projects for a team
 *     tags:
 *       - Ad Clone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: teamId
 *         in: query
 *         required: true
 *         schema:
 *           type: number
 *       - name: limit
 *         in: query
 *         schema:
 *           type: number
 *           default: 20
 *       - name: offset
 *         in: query
 *         schema:
 *           type: number
 *           default: 0
 *     responses:
 *       200:
 *         description: List of projects
 */
router.get(
  "/projects",
  requireAuth,
  adCloneController.listProjects.bind(adCloneController)
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
 * /ad-clone/{projectId}/analyze-and-script:
 *   post:
 *     summary: Start combined video analysis and script generation
 *     description: Chains video analysis with script generation in a single workflow. Progress updates show both phases (0-50% analyze, 50-100% script).
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
 *         description: Combined analysis and script generation started
 */
router.post(
  "/:projectId/analyze-and-script",
  requireAuth,
  adCloneController.startAnalyzeAndScript.bind(adCloneController)
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
 * /ad-clone/{projectId}/regenerate-broll-prompt:
 *   post:
 *     summary: Regenerate cinematic prompt for a B-roll shot
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
 *               - sceneId
 *               - bRollShotIndex
 *               - newAction
 *             properties:
 *               sceneId:
 *                 type: string
 *               bRollShotIndex:
 *                 type: number
 *               newAction:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cinematic prompt regenerated
 */
router.post(
  "/:projectId/regenerate-broll-prompt",
  requireAuth,
  adCloneController.regenerateBRollPrompt.bind(adCloneController)
);

/**
 * @openapi
 * /ad-clone/{projectId}/regenerate-all-broll-shots:
 *   post:
 *     summary: Regenerate all B-roll shot descriptions from updated scene action
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
 *               - sceneId
 *               - newSceneAction
 *               - shotCount
 *               - shotDurations
 *             properties:
 *               sceneId:
 *                 type: string
 *               newSceneAction:
 *                 type: string
 *               shotCount:
 *                 type: number
 *               shotDurations:
 *                 type: array
 *                 items:
 *                   type: number
 *     responses:
 *       200:
 *         description: All B-roll shots regenerated
 */
router.post(
  "/:projectId/regenerate-all-broll-shots",
  requireAuth,
  adCloneController.regenerateAllBRollShots.bind(adCloneController)
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
 * /ad-clone/{projectId}/finalize:
 *   post:
 *     summary: Finalize project and save to clips library
 *     description: Saves the completed video to the clips library with ad-clone metadata
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
 *                 description: Optional folder ID to save the clip to
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
