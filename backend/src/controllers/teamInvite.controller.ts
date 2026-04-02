import { Response, Request } from "express";
import type { TeamInvite, ErrorResponse } from "../types/api.types";
import { AuthRequest } from "../middleware/auth.middleware";
import { teamInviteService } from "../services/teamInvite.service";
import { teamService } from "../services/team.service";
import { userService } from "../services/user.service";
import { handleControllerError, requireUser } from "../utils/controllerHelpers";

export const createInviteController = async (req: AuthRequest, res: Response<{ invite: TeamInvite } | ErrorResponse>) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const { email, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner" && userRole !== "manager") {
      return res.status(403).json({ error: "Only owners and managers can invite members" });
    }

    const invite = await teamInviteService.createInvite(
      teamId,
      user.id,
      email,
      role || "member"
    );

    res.status(201).json({ invite });
  } catch (err) {
    return handleControllerError(res, "Error in createInviteController", err, "Failed to create invite");
  }
};

export const getTeamInvitesController = async (req: AuthRequest, res: Response<{ invites: TeamInvite[] } | ErrorResponse>) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const hasAccess = await teamService.verifyTeamAccess(teamId, user.id);

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this team" });
    }

    const invites = await teamInviteService.getTeamInvites(teamId);

    res.json({ invites });
  } catch (err) {
    return handleControllerError(res, "Error in getTeamInvitesController", err, "Failed to get invites");
  }
};

export const getInviteByTokenController = async (req: Request, res: Response<{ invite: TeamInvite } | ErrorResponse>) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const invite = await teamInviteService.getInviteByToken(token);

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    if (invite.status !== "pending") {
      return res.status(400).json({ error: `Invite has been ${invite.status}` });
    }

    if (new Date() > new Date(invite.expiresAt)) {
      return res.status(400).json({ error: "Invite has expired" });
    }

    res.json({ invite });
  } catch (err) {
    return handleControllerError(res, "Error in getInviteByTokenController", err, "Failed to get invite");
  }
};

export const acceptInviteController = async (req: AuthRequest, res: Response<{ message: string } | ErrorResponse>) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const result = await teamInviteService.acceptInvite(token, user.id);

    res.json({ message: "Invite accepted successfully", ...result });
  } catch (err) {
    return handleControllerError(res, "Error in acceptInviteController", err, "Failed to accept invite");
  }
};

export const revokeInviteController = async (req: AuthRequest, res: Response<{ message: string } | ErrorResponse>) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    const inviteId = parseInt(req.params.inviteId);

    if (isNaN(teamId) || isNaN(inviteId)) {
      return res.status(400).json({ error: "Invalid team ID or invite ID" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner" && userRole !== "manager") {
      return res.status(403).json({ error: "Only owners and managers can revoke invites" });
    }

    await teamInviteService.revokeInvite(inviteId, teamId);

    res.json({ message: "Invite revoked successfully" });
  } catch (err) {
    return handleControllerError(res, "Error in revokeInviteController", err, "Failed to revoke invite");
  }
};

export const resendInviteController = async (req: AuthRequest, res: Response<{ message: string } | ErrorResponse>) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    const inviteId = parseInt(req.params.inviteId);

    if (isNaN(teamId) || isNaN(inviteId)) {
      return res.status(400).json({ error: "Invalid team ID or invite ID" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner" && userRole !== "manager") {
      return res.status(403).json({ error: "Only owners and managers can resend invites" });
    }

    await teamInviteService.resendInvite(inviteId, teamId);

    res.json({ message: "Invite resent successfully" });
  } catch (err) {
    return handleControllerError(res, "Error in resendInviteController", err, "Failed to resend invite");
  }
};
