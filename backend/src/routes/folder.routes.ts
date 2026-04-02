import { Router } from "express";
import { folderController } from "../controllers/folder.controller";
import { requireAuth, requireSeatAccess } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /folders/teams/{teamId}/folders:
 *   get:
 *     summary: Get all folders for a team
 *     description: Retrieves all clip folders/collections for organizing videos
 *     tags:
 *       - Folders Management
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
 *         description: Successfully retrieved folders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 folders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Folder'
 *       400:
 *         description: Invalid team ID
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/folders", requireAuth, folderController.getFolders.bind(folderController));

/**
 * @openapi
 * /folders/teams/{teamId}/folders/tree:
 *   get:
 *     summary: Get folder tree for a team
 *     description: Retrieves hierarchical tree structure of all folders
 *     tags:
 *       - Folders Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved folder tree
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tree:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Folder'
 *                       - type: object
 *                         properties:
 *                           children:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/Folder'
 *       400:
 *         description: Invalid team ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/teams/:teamId/folders/tree", requireAuth, folderController.getFolderTree.bind(folderController));

/**
 * @openapi
 * /folders/teams/{teamId}/folders/{folderId}:
 *   get:
 *     summary: Get a specific folder
 *     description: Retrieves details of a single folder by ID
 *     tags:
 *       - Folders Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved folder
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 folder:
 *                   $ref: '#/components/schemas/Folder'
 *       404:
 *         description: Folder not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/teams/:teamId/folders/:folderId", requireAuth, folderController.getFolder.bind(folderController));

/**
 * @openapi
 * /folders/teams/{teamId}/folders/{folderId}/path:
 *   get:
 *     summary: Get folder path (breadcrumb)
 *     description: Returns array of folders from root to specified folder
 *     tags:
 *       - Folders Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved folder path
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 path:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Folder'
 *       404:
 *         description: Folder not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/teams/:teamId/folders/:folderId/path", requireAuth, folderController.getFolderPath.bind(folderController));

/**
 * @openapi
 * /folders/teams/{teamId}/folders:
 *   post:
 *     summary: Create a new folder
 *     description: Create a new folder/collection for organizing clips
 *     tags:
 *       - Folders Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               color:
 *                 type: string
 *               message:
 *                 type: string
 *               parentFolderId:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Folder created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 folder:
 *                   $ref: '#/components/schemas/Folder'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Plan does not support folders
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/teams/:teamId/folders", requireAuth, requireSeatAccess, folderController.createFolder.bind(folderController));

/**
 * @openapi
 * /folders/teams/{teamId}/folders/{folderId}:
 *   patch:
 *     summary: Update a folder
 *     description: Update folder name, color, or description
 *     tags:
 *       - Folders Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: folderId
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
 *               color:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Folder updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 folder:
 *                   $ref: '#/components/schemas/Folder'
 *       403:
 *         description: Plan does not support folders
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Folder not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/teams/:teamId/folders/:folderId", requireAuth, requireSeatAccess, folderController.updateFolder.bind(folderController));

/**
 * @openapi
 * /folders/teams/{teamId}/folders/{folderId}/move:
 *   patch:
 *     summary: Move a folder to a new parent
 *     description: Moves folder to a new parent folder or to root level
 *     tags:
 *       - Folders Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               parentFolderId:
 *                 type: integer
 *                 nullable: true
 *                 description: New parent folder ID, or null to move to root
 *     responses:
 *       200:
 *         description: Folder moved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 folder:
 *                   $ref: '#/components/schemas/Folder'
 *       400:
 *         description: Cannot move folder into itself or descendant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Plan does not support folders
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Folder not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/teams/:teamId/folders/:folderId/move", requireAuth, requireSeatAccess, folderController.moveFolder.bind(folderController));

/**
 * @openapi
 * /folders/teams/{teamId}/folders/{folderId}:
 *   delete:
 *     summary: Delete a folder
 *     description: Permanently delete a folder (clips inside are not deleted)
 *     tags:
 *       - Folders Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Folder deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: Plan does not support folders
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Folder not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/teams/:teamId/folders/:folderId", requireAuth, requireSeatAccess, folderController.deleteFolder.bind(folderController));

export default router;

