import { Router } from "express";
import { folderController } from "../controllers/folder.controller";
import { requireAuth } from "../middleware/auth.middleware";

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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       team_id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       color:
 *                         type: string
 *                       message:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid team ID
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/folders", requireAuth, folderController.getFolders.bind(folderController));

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
 *                   type: object
 *       404:
 *         description: Folder not found
 */
router.get("/teams/:teamId/folders/:folderId", requireAuth, folderController.getFolder.bind(folderController));

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
 *                 description: Folder name
 *                 example: "Product Demos"
 *               color:
 *                 type: string
 *                 description: Optional color tag for the folder
 *                 example: "#3B82F6"
 *               message:
 *                 type: string
 *                 description: Optional description or note
 *                 example: "All product demo clips for Q1"
 *     responses:
 *       201:
 *         description: Folder created successfully
 *       400:
 *         description: Invalid input
 */
router.post("/teams/:teamId/folders", requireAuth, folderController.createFolder.bind(folderController));

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
 *       404:
 *         description: Folder not found
 */
router.patch("/teams/:teamId/folders/:folderId", requireAuth, folderController.updateFolder.bind(folderController));

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
 *       404:
 *         description: Folder not found
 */
router.delete("/teams/:teamId/folders/:folderId", requireAuth, folderController.deleteFolder.bind(folderController));

export default router;

