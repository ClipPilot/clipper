import { Router } from "express";
import { ugcScriptController } from "../controllers/ugcScript.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /ugc/generate-script:
 *   post:
 *     summary: Generate a UGC script
 *     tags:
 *       - UGC Script
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
 *               - productName
 *             properties:
 *               teamId:
 *                 type: number
 *               productName:
 *                 type: string
 *               productDescription:
 *                 type: string
 *               productImageKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Script generation started
 */
router.post(
  "/generate-script",
  requireAuth,
  ugcScriptController.generateScript.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/regenerate-scene:
 *   post:
 *     summary: Regenerate a single scene in a script
 *     tags:
 *       - UGC Script
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
 *               - sceneIndex
 *             properties:
 *               scriptId:
 *                 type: string
 *               sceneIndex:
 *                 type: number
 *               instruction:
 *                 type: string
 *     responses:
 *       200:
 *         description: Scene regenerated
 */
router.post(
  "/regenerate-scene",
  requireAuth,
  ugcScriptController.regenerateScene.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/regenerate-broll-prompt:
 *   post:
 *     summary: Regenerate cinematic prompt for a single B-roll shot
 *     tags:
 *       - UGC Script
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
 *               - bRollShotIndex
 *               - newAction
 *             properties:
 *               scriptId:
 *                 type: string
 *               sceneId:
 *                 type: string
 *               bRollShotIndex:
 *                 type: number
 *               newAction:
 *                 type: string
 *     responses:
 *       200:
 *         description: B-roll prompt regenerated
 */
router.post(
  "/regenerate-broll-prompt",
  requireAuth,
  ugcScriptController.regenerateBRollPrompt.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/regenerate-all-broll-shots:
 *   post:
 *     summary: Regenerate all B-roll shot descriptions from updated scene action
 *     tags:
 *       - UGC Script
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
 *               - newSceneAction
 *               - shotCount
 *               - shotDurations
 *             properties:
 *               scriptId:
 *                 type: string
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bRollShots:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.post(
  "/regenerate-all-broll-shots",
  requireAuth,
  ugcScriptController.regenerateAllBRollShots.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/upload-product-image:
 *   post:
 *     summary: Get a presigned upload URL for a product image
 *     tags:
 *       - UGC Script
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
 *                 type: number
 *               fileName:
 *                 type: string
 *               contentType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Upload URL generated
 */
router.post(
  "/upload-product-image",
  requireAuth,
  ugcScriptController.getUploadUrl.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/script/{scriptId}:
 *   put:
 *     summary: Update a script
 *     tags:
 *       - UGC Script
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: scriptId
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
 *             properties:
 *               scenes:
 *                 type: array
 *               selectedVariantIndex:
 *                 type: number
 *     responses:
 *       200:
 *         description: Script updated
 */
router.put(
  "/script/:scriptId",
  requireAuth,
  ugcScriptController.updateScript.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/script/{scriptId}/full:
 *   get:
 *     summary: Get the full script with all variants
 *     tags:
 *       - UGC Script
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: scriptId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full script data
 */
router.get(
  "/script/:scriptId/full",
  requireAuth,
  ugcScriptController.getFullScript.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/script/{scriptId}/status:
 *   get:
 *     summary: Get script generation status
 *     tags:
 *       - UGC Script
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: scriptId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Script status
 */
router.get(
  "/script/:scriptId/status",
  requireAuth,
  ugcScriptController.getScriptStatus.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/scripts/{teamId}:
 *   get:
 *     summary: List all scripts for a team
 *     tags:
 *       - UGC Script
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: teamId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of scripts
 */
router.get(
  "/scripts/:teamId",
  requireAuth,
  ugcScriptController.listScripts.bind(ugcScriptController)
);

export default router;
