import { Router } from "express";
import { ugcScriptController } from "../controllers/ugcScript.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /ugc/generate-script:
 *   post:
 *     summary: Generate a UGC script
 *     description: Queues an AI-powered UGC script generation job for a team and character
 *     tags:
 *       - UGC Scripts
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
 *               - characterId
 *             properties:
 *               teamId:
 *                 type: integer
 *               characterId:
 *                 type: integer
 *               productImageKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 5
 *               productName:
 *                 type: string
 *               scriptDirection:
 *                 type: string
 *               targetDuration:
 *                 type: integer
 *                 default: 30
 *               numberOfVariations:
 *                 type: integer
 *                 default: 2
 *               structureId:
 *                 type: string
 *                 default: classic
 *               customPattern:
 *                 type: string
 *     responses:
 *       202:
 *         description: Script generation queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 scriptId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: UGC Studio access required
 *       404:
 *         description: Character not found
 *       500:
 *         description: Server error
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
 *     summary: Regenerate a single scene
 *     description: Regenerates dialogue, emotion, or full content for a specific scene in a script
 *     tags:
 *       - UGC Scripts
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
 *             properties:
 *               teamId:
 *                 type: integer
 *               scriptId:
 *                 type: string
 *               sceneId:
 *                 type: string
 *               currentDialogue:
 *                 type: string
 *               currentEmotion:
 *                 type: string
 *               regenerationType:
 *                 type: string
 *                 default: full
 *     responses:
 *       200:
 *         description: Scene regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 scene:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
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
 *     summary: Regenerate a B-roll prompt
 *     description: Regenerates the B-roll prompt for a specific shot within a scene
 *     tags:
 *       - UGC Scripts
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
 *                 type: integer
 *               newAction:
 *                 type: string
 *     responses:
 *       200:
 *         description: B-roll prompt regenerated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/regenerate-broll-prompt",
  requireAuth,
  ugcScriptController.regenerateBRollPrompt.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/upload-product-image:
 *   post:
 *     summary: Get a presigned upload URL for a product image
 *     description: Returns a presigned S3 URL to upload a product image for UGC script generation
 *     tags:
 *       - UGC Scripts
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
 *               contentType:
 *                 type: string
 *                 default: image/jpeg
 *     responses:
 *       200:
 *         description: Upload URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 uploadUrl:
 *                   type: string
 *                 s3Key:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: UGC Studio access required
 *       500:
 *         description: Server error
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
 *     description: Updates scenes or selected variant index for a script
 *     tags:
 *       - UGC Scripts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scriptId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scenes:
 *                 type: array
 *                 items:
 *                   type: object
 *               selectedVariantIndex:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Script updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 scripts:
 *                   type: array
 *                   items:
 *                     type: object
 *                 selectedVariantIndex:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Script not found
 *       500:
 *         description: Server error
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
 *     summary: Get full script data
 *     description: Retrieves the complete script including all variants and scene data
 *     tags:
 *       - UGC Scripts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scriptId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full script data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 scripts:
 *                   type: array
 *                   items:
 *                     type: object
 *                 selectedVariantIndex:
 *                   type: integer
 *                 characterId:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Script not found
 *       500:
 *         description: Server error
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
 *     description: Polls the current status and progress of a script generation job
 *     tags:
 *       - UGC Scripts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scriptId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Script status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 scriptId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [queued, processing, completed, failed]
 *                 progress:
 *                   type: integer
 *                 progressMessage:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 startedAt:
 *                   type: string
 *                   format: date-time
 *                 completedAt:
 *                   type: string
 *                   format: date-time
 *                 scripts:
 *                   type: array
 *                   items:
 *                     type: object
 *                   description: Only present when status is completed
 *                 selectedVariantIndex:
 *                   type: integer
 *                 error:
 *                   type: string
 *                   description: Only present when status is failed
 *       400:
 *         description: Missing scriptId
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Script not found
 *       500:
 *         description: Server error
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
 *     summary: List scripts for a team
 *     description: Returns a paginated list of completed scripts for the given team
 *     tags:
 *       - UGC Scripts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Scripts list retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 scripts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       scriptDirection:
 *                         type: string
 *                       structureId:
 *                         type: string
 *                       characterId:
 *                         type: integer
 *                       characterName:
 *                         type: string
 *                       sceneCount:
 *                         type: integer
 *                       totalDuration:
 *                         type: number
 *                       title:
 *                         type: string
 *                       hook:
 *                         type: string
 *                       viralScore:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 hasMore:
 *                   type: boolean
 *       400:
 *         description: Missing teamId
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: UGC Studio access required
 *       500:
 *         description: Server error
 */
router.get(
  "/scripts/:teamId",
  requireAuth,
  ugcScriptController.listScripts.bind(ugcScriptController)
);

export default router;
