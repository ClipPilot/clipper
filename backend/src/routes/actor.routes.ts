import { Router } from "express";
import { actorController } from "../controllers/actor.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     AppearanceConfig:
 *       type: object
 *       properties:
 *         hairColor:
 *           type: string
 *           enum: [blonde, brunette, black, red, gray, custom]
 *         hairStyle:
 *           type: string
 *           enum: [short, medium, long, wavy, curly, straight]
 *         skinTone:
 *           type: string
 *           enum: [fair, light, medium, tan, dark]
 *         eyeColor:
 *           type: string
 *           enum: [brown, blue, green, hazel, gray]
 *         bodyType:
 *           type: string
 *           enum: [slim, athletic, average, curvy]
 *     StyleConfig:
 *       type: object
 *       properties:
 *         outfit:
 *           type: string
 *           enum: [casual, gym, office, cozy-home, streetwear, other]
 *         outfitCustom:
 *           type: string
 *           description: Custom outfit description when outfit is 'other'
 *         setting:
 *           type: string
 *           description: Environment/location description
 *         cameraStyle:
 *           type: string
 *           enum: [phone-selfie, tripod, mirror, ring-light]
 *           deprecated: true
 *           description: No longer used in UI
 *         anythingElse:
 *           type: string
 *           description: Additional details for generation
 *     CharacterConfig:
 *       type: object
 *       required:
 *         - gender
 *         - ageRange
 *         - appearance
 *         - style
 *       properties:
 *         gender:
 *           type: string
 *           enum: [male, female]
 *         ageRange:
 *           type: string
 *           enum: [18-25, 25-35, 35-45, 45+]
 *         appearance:
 *           $ref: '#/components/schemas/AppearanceConfig'
 *         style:
 *           $ref: '#/components/schemas/StyleConfig'
 *         referenceImages:
 *           type: array
 *           items:
 *             type: string
 *           description: S3 keys of reference images
 *     Character:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         team_id:
 *           type: integer
 *         name:
 *           type: string
 *         public:
 *           type: boolean
 *         gender:
 *           type: string
 *         age_range:
 *           type: string
 *         appearance_config:
 *           $ref: '#/components/schemas/AppearanceConfig'
 *         style_config:
 *           $ref: '#/components/schemas/StyleConfig'
 *         character_images:
 *           type: array
 *           items:
 *             type: string
 *         primary_image_index:
 *           type: integer
 *         reference_images:
 *           type: array
 *           items:
 *             type: string
 *         generation_prompt:
 *           type: string
 *         parent_character_id:
 *           type: integer
 *         is_variation:
 *           type: boolean
 *         uses_count:
 *           type: integer
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         imageUrls:
 *           type: array
 *           items:
 *             type: string
 *           description: Presigned URLs for character images
 *     GeneratedImage:
 *       type: object
 *       properties:
 *         key:
 *           type: string
 *           description: S3 key of the generated image
 *         url:
 *           type: string
 *           description: Presigned URL for viewing
 *         index:
 *           type: integer
 *           description: Image variant index (0-3)
 */

/**
 * @openapi
 * /actors/generate-preview:
 *   post:
 *     summary: Start character image generation
 *     description: |
 *       Queues a background job to generate 4 AI character image variants.
 *       Returns a job ID immediately. Poll /generation-status/:jobId for progress.
 *     tags:
 *       - Actors
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
 *               - config
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: Team ID
 *               config:
 *                 $ref: '#/components/schemas/CharacterConfig'
 *               parentCharacterId:
 *                 type: integer
 *                 description: Optional parent character ID for variations
 *     responses:
 *       202:
 *         description: Generation job queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobId:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [queued]
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required parameters
 *       401:
 *         description: Authentication required
 *       403:
 *         description: UGC Studio access required
 */
router.post(
  "/generate-preview",
  requireAuth,
  actorController.generatePreview.bind(actorController)
);

/**
 * @openapi
 * /actors/generation-status/{jobId}:
 *   get:
 *     summary: Get character generation job status
 *     description: |
 *       Poll this endpoint to check generation progress. When status is 'completed',
 *       the response includes generated images with presigned URLs.
 *     tags:
 *       - Actors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Generation job ID from generate-preview response
 *     responses:
 *       200:
 *         description: Job status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [queued, generating, completed, failed]
 *                 progress:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 100
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
 *                 images:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GeneratedImage'
 *                   description: Only present when status is 'completed'
 *                 prompt:
 *                   type: string
 *                   description: Generation prompt used (only when completed)
 *                 error:
 *                   type: string
 *                   description: Error message (only when status is 'failed')
 *       404:
 *         description: Job not found
 */
router.get(
  "/generation-status/:jobId",
  requireAuth,
  actorController.getGenerationStatus.bind(actorController)
);

/**
 * @openapi
 * /actors/create:
 *   post:
 *     summary: Save a new character/actor
 *     description: |
 *       Creates a character from previously generated images.
 *       Credits are charged based on number of selected images.
 *     tags:
 *       - Actors
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
 *               - name
 *               - selectedImageKeys
 *             properties:
 *               teamId:
 *                 type: integer
 *               name:
 *                 type: string
 *                 description: Character name
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *                 description: Make character visible to community
 *               gender:
 *                 type: string
 *               ageRange:
 *                 type: string
 *               appearanceConfig:
 *                 $ref: '#/components/schemas/AppearanceConfig'
 *               styleConfig:
 *                 $ref: '#/components/schemas/StyleConfig'
 *               selectedImageKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: S3 keys of images to save
 *               generationPrompt:
 *                 type: string
 *               referenceImages:
 *                 type: array
 *                 items:
 *                   type: string
 *               parentCharacterId:
 *                 type: integer
 *                 description: Parent character ID if this is a variation
 *     responses:
 *       201:
 *         description: Character created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 character:
 *                   $ref: '#/components/schemas/Character'
 *                 creditCost:
 *                   type: integer
 *                   description: Number of credits charged
 *       400:
 *         description: Missing required parameters
 *       403:
 *         description: UGC Studio access required
 */
router.post(
  "/create",
  requireAuth,
  actorController.create.bind(actorController)
);

/**
 * @openapi
 * /actors:
 *   get:
 *     summary: List team's actors
 *     description: Returns all characters/actors belonging to the specified team
 *     tags:
 *       - Actors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID to list actors for
 *     responses:
 *       200:
 *         description: List of actors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 characters:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Character'
 *       400:
 *         description: teamId is required
 */
router.get(
  "/",
  requireAuth,
  actorController.list.bind(actorController)
);

/**
 * @openapi
 * /actors/community:
 *   get:
 *     summary: List public community actors
 *     description: Returns public characters available for use, sorted by popularity
 *     tags:
 *       - Actors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: List of community actors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 characters:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Character'
 *                       - type: object
 *                         properties:
 *                           primaryImageUrl:
 *                             type: string
 *                             description: Presigned URL for primary image
 */
router.get(
  "/community",
  requireAuth,
  actorController.listCommunity.bind(actorController)
);

/**
 * @openapi
 * /actors/{id}:
 *   get:
 *     summary: Get actor by ID
 *     description: Returns a single character with presigned image URLs
 *     tags:
 *       - Actors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Character ID
 *     responses:
 *       200:
 *         description: Character details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 character:
 *                   $ref: '#/components/schemas/Character'
 *       404:
 *         description: Character not found
 */
router.get(
  "/:id",
  requireAuth,
  actorController.getById.bind(actorController)
);

/**
 * @openapi
 * /actors/{id}:
 *   put:
 *     summary: Update actor
 *     description: Update character name, public status, or primary image
 *     tags:
 *       - Actors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Character ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *               primaryImageIndex:
 *                 type: integer
 *                 description: Index of image to set as primary (0-3)
 *     responses:
 *       200:
 *         description: Character updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 character:
 *                   $ref: '#/components/schemas/Character'
 *       404:
 *         description: Character not found
 */
router.put(
  "/:id",
  requireAuth,
  actorController.update.bind(actorController)
);

/**
 * @openapi
 * /actors/{id}:
 *   delete:
 *     summary: Delete actor
 *     description: Permanently delete a character
 *     tags:
 *       - Actors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Character ID
 *     responses:
 *       200:
 *         description: Character deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Character not found
 */
router.delete(
  "/:id",
  requireAuth,
  actorController.delete.bind(actorController)
);

/**
 * @openapi
 * /actors/{id}/use:
 *   post:
 *     summary: Increment actor usage count
 *     description: Track when a character is used in video generation
 *     tags:
 *       - Actors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Character ID
 *     responses:
 *       200:
 *         description: Usage count incremented
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.post(
  "/:id/use",
  requireAuth,
  actorController.incrementUse.bind(actorController)
);

/**
 * @openapi
 * /actors/{id}/create-variation:
 *   post:
 *     summary: Create variation of existing actor
 *     description: |
 *       Generate new images based on an existing character's appearance
 *       but with different style settings (outfit, setting, etc.)
 *     tags:
 *       - Actors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Parent character ID to create variation from
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - styleConfig
 *             properties:
 *               teamId:
 *                 type: integer
 *               styleConfig:
 *                 $ref: '#/components/schemas/StyleConfig'
 *     responses:
 *       200:
 *         description: Variation images generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 tempCharacterId:
 *                   type: string
 *                 images:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GeneratedImage'
 *                 originalCharacterId:
 *                   type: integer
 *                 originalAppearance:
 *                   $ref: '#/components/schemas/AppearanceConfig'
 *       404:
 *         description: Parent character not found
 *       403:
 *         description: UGC Studio access required
 */
router.post(
  "/:id/create-variation",
  requireAuth,
  actorController.createVariation.bind(actorController)
);

/**
 * @openapi
 * /actors/upload-reference:
 *   post:
 *     summary: Get presigned URL for reference image upload
 *     description: Returns a presigned S3 URL for uploading reference images
 *     tags:
 *       - Actors
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
 *                 description: Original file name
 *     responses:
 *       200:
 *         description: Presigned URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 uploadUrl:
 *                   type: string
 *                   description: Presigned PUT URL for S3 upload
 *                 s3Key:
 *                   type: string
 *                   description: S3 key where file will be stored
 *       400:
 *         description: Missing required parameters
 */
router.post(
  "/upload-reference",
  requireAuth,
  actorController.getPresignedUploadUrl.bind(actorController)
);

export default router;
