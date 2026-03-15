import { Router } from "express";
import { ugcScriptController } from "../controllers/ugcScript.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

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
 * /ugc/auto-structure:
 *   post:
 *     summary: Generate an AI-recommended script structure
 *     description: Analyzes script direction and returns an optimal scene pattern with reasoning
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
 *               - scriptDirection
 *             properties:
 *               scriptDirection:
 *                 type: string
 *                 description: Description of the desired script
 *               productName:
 *                 type: string
 *                 description: Optional product name for context
 *     responses:
 *       200:
 *         description: Auto-generated structure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 pattern:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       shot:
 *                         type: string
 *                 reasoning:
 *                   type: string
 *                 name:
 *                   type: string
 */
router.post(
  "/auto-structure",
  requireAuth,
  ugcScriptController.generateAutoStructure.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/generate-script-agent:
 *   post:
 *     summary: Generate a script using the AI script agent
 *     description: Uses the Mastra script agent to generate a full video script from structure, character, voice, and audience context
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
 *               - structure
 *             properties:
 *               teamId:
 *                 type: number
 *               structure:
 *                 type: array
 *                 items:
 *                   type: object
 *               characterId:
 *                 type: number
 *               character:
 *                 type: object
 *               voice:
 *                 type: object
 *               targetAudience:
 *                 type: string
 *               productImageKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *               userDirection:
 *                 type: string
 *               isSilent:
 *                 type: boolean
 *               videoType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generated script
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 scriptId:
 *                   type: string
 *                 script:
 *                   type: object
 */
router.post(
  "/generate-script-agent",
  requireAuth,
  ugcScriptController.generateScriptAgent.bind(ugcScriptController)
);

/**
 * @openapi
 * /ugc/init-structure:
 *   post:
 *     summary: Generate an AI video structure from a chat message
 *     description: Uses the script init agent to analyze a message (with optional product images) and return an optimal video structure, type, and flags
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
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's description of the desired video
 *               productImageKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: S3 keys of uploaded product images
 *     responses:
 *       200:
 *         description: Agent-generated structure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 videoType:
 *                   type: string
 *                 isSilent:
 *                   type: boolean
 *                 character:
 *                   type: boolean
 *                 structure:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sceneType:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       description:
 *                         type: string
 */
router.post(
  "/init-structure",
  requireAuth,
  ugcScriptController.initStructure.bind(ugcScriptController)
);


/**
 * @openapi
 * /ugc/storyboard-chat:
 *   post:
 *     summary: Chat with the storyboard agent to edit a script
 *     description: Send a natural language message to modify scenes, shots, dialogue, or direction in a storyboard
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
 *               - message
 *             properties:
 *               scriptId:
 *                 type: string
 *                 description: UUID of the script to edit
 *               message:
 *                 type: string
 *                 description: Natural language editing instruction
 *               threadId:
 *                 type: string
 *                 description: Optional thread ID for conversational memory
 *     responses:
 *       200:
 *         description: Storyboard edit applied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 updatedScript:
 *                   type: object
 */
router.post(
  "/storyboard-chat",
  requireAuth,
  ugcScriptController.storyboardChat.bind(ugcScriptController)
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
