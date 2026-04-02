import { Router } from "express";
import { tagController } from "../controllers/tag.controller";
import { requireAuth, requireSeatAccess } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /tags/teams/{teamId}/tags:
 *   get:
 *     summary: Get all tags for a team
 *     description: Retrieves all tags that belong to a specific team
 *     tags:
 *       - Tags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *     responses:
 *       200:
 *         description: Successfully retrieved tags
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid team ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  "/teams/:teamId/tags",
  requireAuth,
  tagController.getTags.bind(tagController)
);

/**
 * @openapi
 * /tags/teams/{teamId}/tags:
 *   post:
 *     summary: Create a new tag
 *     description: Creates a new tag for a specific team
 *     tags:
 *       - Tags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: Tag name
 *               color:
 *                 type: string
 *                 maxLength: 50
 *                 description: Tag color (hex code)
 *                 default: "#6366f1"
 *     responses:
 *       201:
 *         description: Tag created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 tag:
 *                   $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/teams/:teamId/tags",
  requireAuth,
  requireSeatAccess,
  tagController.createTag.bind(tagController)
);

/**
 * @openapi
 * /tags/teams/{teamId}/tags/{tagId}:
 *   get:
 *     summary: Get a specific tag
 *     description: Retrieves a single tag by ID
 *     tags:
 *       - Tags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved tag
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tag:
 *                   $ref: '#/components/schemas/Tag'
 *       404:
 *         description: Tag not found
 */
router.get(
  "/teams/:teamId/tags/:tagId",
  requireAuth,
  tagController.getTag.bind(tagController)
);

/**
 * @openapi
 * /tags/teams/{teamId}/tags/{tagId}:
 *   patch:
 *     summary: Update a tag
 *     description: Updates a tag's name or color
 *     tags:
 *       - Tags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               color:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       200:
 *         description: Tag updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 tag:
 *                   $ref: '#/components/schemas/Tag'
 *       404:
 *         description: Tag not found
 */
router.patch(
  "/teams/:teamId/tags/:tagId",
  requireAuth,
  requireSeatAccess,
  tagController.updateTag.bind(tagController)
);

/**
 * @openapi
 * /tags/teams/{teamId}/tags/{tagId}:
 *   delete:
 *     summary: Delete a tag
 *     description: Permanently deletes a tag
 *     tags:
 *       - Tags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Tag not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/teams/:teamId/tags/:tagId",
  requireAuth,
  requireSeatAccess,
  tagController.deleteTag.bind(tagController)
);

/**
 * @openapi
 * /tags/clips/{clipId}/tags:
 *   get:
 *     summary: Get tags for a clip
 *     description: Retrieves all tags assigned to a specific clip
 *     tags:
 *       - Clip Tags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clipId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved clip tags
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid clip ID
 *       500:
 *         description: Server error
 */
router.get(
  "/clips/:clipId/tags",
  requireAuth,
  tagController.getClipTags.bind(tagController)
);

/**
 * @openapi
 * /tags/clips/{clipId}/tags:
 *   put:
 *     summary: Set clip tags
 *     description: Replaces all tags on a clip with the provided list
 *     tags:
 *       - Clip Tags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clipId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tagIds
 *             properties:
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of tag IDs to assign to the clip
 *     responses:
 *       200:
 *         description: Clip tags updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.put(
  "/clips/:clipId/tags",
  requireAuth,
  tagController.setClipTags.bind(tagController)
);

/**
 * @openapi
 * /tags/clips/{clipId}/tags/{tagId}:
 *   post:
 *     summary: Add tag to clip
 *     description: Adds a single tag to a clip
 *     tags:
 *       - Clip Tags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clipId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag added to clip
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid IDs
 *       500:
 *         description: Server error
 */
router.post(
  "/clips/:clipId/tags/:tagId",
  requireAuth,
  tagController.addTagToClip.bind(tagController)
);

/**
 * @openapi
 * /tags/clips/{clipId}/tags/{tagId}:
 *   delete:
 *     summary: Remove tag from clip
 *     description: Removes a single tag from a clip
 *     tags:
 *       - Clip Tags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clipId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag removed from clip
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid IDs
 *       500:
 *         description: Server error
 */
router.delete(
  "/clips/:clipId/tags/:tagId",
  requireAuth,
  tagController.removeTagFromClip.bind(tagController)
);

export default router;
