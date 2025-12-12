import { Router } from "express";
import {
  getUserTeamsController,
  getDefaultTeamController,
  getTeamUsageStatsController,
  getTeamMembersController,
  addTeamMemberController,
  removeTeamMemberController,
  updateTeamMemberRoleController,
  leaveTeamController,
  updateTeamNameController,
  deleteTeamController,
  createTeamController,
} from "../controllers/team.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireActiveSubscription } from "../middleware/subscription.middleware";

const router = Router();

/**
 * @openapi
 * /teams:
 *   get:
 *     summary: Get all teams for the authenticated user
 *     description: Returns all teams the user is a member of with their role in each team
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved teams
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teams:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       role:
 *                         type: string
 *                         enum: [owner, manager, member]
 *                       teamSubscriptionId:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", requireAuth, getUserTeamsController);

/**
 * @openapi
 * /teams:
 *   post:
 *     summary: Create a new team
 *     description: Create a new team with the authenticated user as owner
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       201:
 *         description: Team created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post("/", requireAuth, createTeamController);

/**
 * @openapi
 * /teams/default:
 *   get:
 *     summary: Get user's default team
 *     description: Returns the first team where the user is an owner
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved default team
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/default", requireAuth, getDefaultTeamController);

/**
 * @openapi
 * /teams/{teamId}/usage-stats:
 *   get:
 *     summary: Get usage statistics for a specific team
 *     description: Returns clip creation usage stats for the specified team
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Successfully retrieved usage stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teamId:
 *                   type: integer
 *                 teamName:
 *                   type: string
 *                 clipsCreated:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 remaining:
 *                   type: integer
 *                 resetsDate:
 *                   type: string
 *                   format: date-time
 *                 rollover:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied to this team
 *       500:
 *         description: Server error
 */
router.get("/:teamId/usage-stats", requireAuth, getTeamUsageStatsController);

/**
 * @openapi
 * /teams/{teamId}/members:
 *   get:
 *     summary: Get all members of a team
 *     description: Returns list of team members with their roles
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Successfully retrieved team members
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied to this team
 *       500:
 *         description: Server error
 */
router.get("/:teamId/members", requireAuth, getTeamMembersController);

/**
 * @openapi
 * /teams/{teamId}/members:
 *   post:
 *     summary: Add a member to a team
 *     description: Add a new member to the team (owners and managers only)
 *     tags:
 *       - Teams
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
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [manager, member]
 *                 default: member
 *     responses:
 *       200:
 *         description: Member added successfully
 *       403:
 *         description: Insufficient permissions
 */
router.post("/:teamId/members", requireAuth, requireActiveSubscription, addTeamMemberController);

/**
 * @openapi
 * /teams/{teamId}/members/{memberId}:
 *   delete:
 *     summary: Remove a member from a team
 *     description: Remove a member from the team (owners and managers only)
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       403:
 *         description: Insufficient permissions
 */
router.delete("/:teamId/members/:memberId", requireAuth, removeTeamMemberController);

/**
 * @openapi
 * /teams/{teamId}/members/{memberId}/role:
 *   patch:
 *     summary: Update a member's role
 *     description: Change a member's role in the team (owners only)
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: memberId
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [owner, manager, member]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       403:
 *         description: Only owners can change roles
 */
router.patch("/:teamId/members/:memberId/role", requireAuth, updateTeamMemberRoleController);

/**
 * @openapi
 * /teams/{teamId}/leave:
 *   post:
 *     summary: Leave a team
 *     description: Remove yourself from a team
 *     tags:
 *       - Teams
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
 *         description: Left team successfully
 *       400:
 *         description: Cannot leave as last owner
 */
router.post("/:teamId/leave", requireAuth, leaveTeamController);

/**
 * @openapi
 * /teams/{teamId}:
 *   patch:
 *     summary: Update team name
 *     description: Rename the team (owners only)
 *     tags:
 *       - Teams
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
 *     responses:
 *       200:
 *         description: Team name updated
 *       403:
 *         description: Only owners can rename team
 */
router.patch("/:teamId", requireAuth, updateTeamNameController);

/**
 * @openapi
 * /teams/{teamId}:
 *   delete:
 *     summary: Delete a team
 *     description: Permanently delete a team (owners only)
 *     tags:
 *       - Teams
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
 *         description: Team deleted successfully
 *       403:
 *         description: Only owners can delete team
 */
router.delete("/:teamId", requireAuth, deleteTeamController);

export default router;
