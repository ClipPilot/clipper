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
  getTeamLogoController,
  uploadTeamLogoController,
  removeTeamLogoController,
} from "../controllers/team.controller";
import {
  createInviteController,
  getTeamInvitesController,
  getInviteByTokenController,
  acceptInviteController,
  revokeInviteController,
  resendInviteController,
} from "../controllers/teamInvite.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireActiveSubscription } from "../middleware/subscription.middleware";
import { imageUpload } from "../config/multer";

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
 *                     $ref: '#/components/schemas/Team'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 team:
 *                   $ref: '#/components/schemas/Team'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Team'
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
 *               $ref: '#/components/schemas/TeamUsageStats'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 members:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TeamMember'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 member:
 *                   $ref: '#/components/schemas/TeamMember'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 member:
 *                   $ref: '#/components/schemas/TeamMember'
 *       403:
 *         description: Only owners can change roles
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot leave as last owner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 team:
 *                   $ref: '#/components/schemas/Team'
 *       403:
 *         description: Only owners can rename team
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: Only owners can delete team
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:teamId", requireAuth, deleteTeamController);

/**
 * @openapi
 * /teams/{teamId}/logo:
 *   get:
 *     summary: Get team logo
 *     description: Redirects (302) to a fresh presigned S3 URL for the team's logo. Use this URL directly as an img src.
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
 *       302:
 *         description: Redirect to presigned logo URL
 *       404:
 *         description: Team has no logo
 */
router.get("/:teamId/logo", getTeamLogoController);

/**
 * @openapi
 * /teams/{teamId}/logo:
 *   post:
 *     summary: Upload team logo
 *     description: Upload or update the team's logo image (owners only)
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - logo
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Logo uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 team:
 *                   $ref: '#/components/schemas/Team'
 *       403:
 *         description: Only owners can update team logo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/:teamId/logo", requireAuth, imageUpload.single("logo"), uploadTeamLogoController);

/**
 * @openapi
 * /teams/{teamId}/logo:
 *   delete:
 *     summary: Remove team logo
 *     description: Remove the team's logo image (owners only)
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
 *         description: Logo removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 team:
 *                   $ref: '#/components/schemas/Team'
 *       403:
 *         description: Only owners can remove team logo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:teamId/logo", requireAuth, removeTeamLogoController);

/**
 * @openapi
 * /teams/invites/{token}:
 *   get:
 *     summary: Get invite details by token
 *     tags:
 *       - Team Invites
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invite details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invite:
 *                   $ref: '#/components/schemas/TeamInvite'
 *       400:
 *         description: Invite expired or already used
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Invite not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/invites/:token", getInviteByTokenController);

/**
 * @openapi
 * /teams/invites/{token}/accept:
 *   post:
 *     summary: Accept a team invite
 *     tags:
 *       - Team Invites
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invite accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Invite not found or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/invites/:token/accept", requireAuth, acceptInviteController);

/**
 * @openapi
 * /teams/{teamId}/invites:
 *   get:
 *     summary: List all invites for a team
 *     tags:
 *       - Team Invites
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
 *         description: List of invites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invites:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TeamInvite'
 *       403:
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:teamId/invites", requireAuth, getTeamInvitesController);

/**
 * @openapi
 * /teams/{teamId}/invites:
 *   post:
 *     summary: Create a team invite
 *     tags:
 *       - Team Invites
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: teamId
 *         in: path
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
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *     responses:
 *       201:
 *         description: Invite created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invite:
 *                   $ref: '#/components/schemas/TeamInvite'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/:teamId/invites", requireAuth, requireActiveSubscription, createInviteController);

/**
 * @openapi
 * /teams/{teamId}/invites/{inviteId}:
 *   delete:
 *     summary: Revoke a team invite
 *     tags:
 *       - Team Invites
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: teamId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: inviteId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invite revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:teamId/invites/:inviteId", requireAuth, revokeInviteController);

/**
 * @openapi
 * /teams/{teamId}/invites/{inviteId}/resend:
 *   post:
 *     summary: Resend a team invite email
 *     tags:
 *       - Team Invites
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: teamId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: inviteId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invite resent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/:teamId/invites/:inviteId/resend", requireAuth, resendInviteController);

export default router;
