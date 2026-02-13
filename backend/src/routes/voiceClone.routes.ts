import { Router } from "express";
import { voiceCloneController } from "../controllers/voiceClone.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { audioUpload } from "../config/multer";

const router = Router();

/**
 * @openapi
 * /voice-clones:
 *   post:
 *     summary: Clone a voice
 *     description: Upload an audio sample to create a cloned voice via ElevenLabs IVC
 *     tags:
 *       - Voice Clones
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - name
 *               - gender
 *               - audio
 *             properties:
 *               teamId:
 *                 type: integer
 *               name:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               audio:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Voice cloned successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  requireAuth,
  audioUpload.single("audio"),
  voiceCloneController.cloneVoice.bind(voiceCloneController),
);

/**
 * @openapi
 * /voice-clones:
 *   get:
 *     summary: List cloned voices
 *     description: Get all cloned voices for a team
 *     tags:
 *       - Voice Clones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of cloned voices
 *       400:
 *         description: Invalid team ID
 *       500:
 *         description: Server error
 */
router.get(
  "/",
  requireAuth,
  voiceCloneController.listClonedVoices.bind(voiceCloneController),
);

/**
 * @openapi
 * /voice-clones/{id}:
 *   delete:
 *     summary: Delete a cloned voice
 *     description: Removes a cloned voice from DB, ElevenLabs, and S3
 *     tags:
 *       - Voice Clones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Voice deleted successfully
 *       404:
 *         description: Voice not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/:id",
  requireAuth,
  voiceCloneController.deleteClonedVoice.bind(voiceCloneController),
);

export default router;
