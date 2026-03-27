import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { teamService } from "../services/team.service";
import { userService } from "../services/user.service";
import { clipManagerService } from "../services/clips/clipManager.service";
import { s3Service } from "../services/s3.service";
import { PLAN_LIMITS } from "../config/stripe.config";
import { handleControllerError, requireUser, verifyTeamAccessOrFail } from "../utils/controllerHelpers";

export const getUserTeamsController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const user = await userService.getUserBySupabaseUid(userId);

    await userService.ensureUserHasTeam(user.id);

    const teams = await teamService.getUserTeams(user.id);

    res.json({ teams });
  } catch (err) {
    return handleControllerError(res, "Error in getUserTeamsController", err, "Failed to get teams");
  }
};

export const getDefaultTeamController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const user = await userService.getUserBySupabaseUid(userId);

    await userService.ensureUserHasTeam(user.id);

    const defaultTeam = await teamService.getUserDefaultTeam(user.id);

    res.json(defaultTeam);
  } catch (err) {
    return handleControllerError(res, "Error in getDefaultTeamController", err, "Failed to get default team");
  }
};

export const getTeamUsageStatsController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await verifyTeamAccessOrFail(req, teamId, res);
    if (!user) return;

    const stats = await teamService.getTeamUsageStats(teamId);
    const team = await teamService.getTeamById(teamId);
    const plan = team.plan || "free";

    const clipsGenerated = await clipManagerService.getTeamClipsCount(teamId);
    const generationLimit = plan === "free" ? (stats.limit === 0 ? 0 : PLAN_LIMITS.FREE.generations) : -1;
    const generationsRemaining = generationLimit === -1 ? -1 : Math.max(0, generationLimit - clipsGenerated);

    const baseRemaining = Math.max(0, stats.limit - stats.clips_created);
    const addonRemaining = team.addon_clips_remaining || 0;
    const totalRemaining = baseRemaining + addonRemaining;

    res.json({
      teamId: team.id,
      teamName: team.name,
      clipsCreated: stats.clips_created,
      baseLimit: stats.limit,
      baseRemaining,
      addonRemaining,
      totalRemaining,
      clipsGenerated,
      generationLimit,
      generationsRemaining,
      resetsDate: stats.resets_date,
      rollover: stats.rollover,
      limit: stats.limit,
      remaining: totalRemaining,
    });
  } catch (err) {
    return handleControllerError(res, "Error in getTeamUsageStatsController", err, "Failed to get usage stats");
  }
};

export const getTeamMembersController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await verifyTeamAccessOrFail(req, teamId, res);
    if (!user) return;

    const members = await teamService.getTeamMembers(teamId);

    res.json({ members });
  } catch (err) {
    return handleControllerError(res, "Error in getTeamMembersController", err, "Failed to get team members");
  }
};

export const addTeamMemberController = async (req: AuthRequest, res: Response) => {
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

    const team = await teamService.getTeamById(teamId);
    if (team.plan !== "scale" && team.plan !== "enterprise") {
      return res.status(403).json({
        error: "Team collaboration requires a Scale or Enterprise plan. Please upgrade to invite team members.",
      });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner" && userRole !== "manager") {
      return res.status(403).json({ error: "Only owners and managers can add members" });
    }

    const member = await teamService.addTeamMember(teamId, email, role || "member");

    res.json({ member });
  } catch (err) {
    return handleControllerError(res, "Error in addTeamMemberController", err, "Failed to add team member");
  }
};

export const removeTeamMemberController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    const memberId = parseInt(req.params.memberId);

    if (isNaN(teamId) || isNaN(memberId)) {
      return res.status(400).json({ error: "Invalid team ID or member ID" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner" && userRole !== "manager") {
      return res.status(403).json({ error: "Only owners and managers can remove members" });
    }

    if (userRole === "manager") {
      const memberRole = await teamService.getMemberRoleById(teamId, memberId);
      if (memberRole === "owner") {
        return res.status(403).json({ error: "Managers cannot remove owners" });
      }
    }

    await teamService.removeTeamMember(teamId, memberId);

    res.json({ message: "Member removed successfully" });
  } catch (err) {
    return handleControllerError(res, "Error in removeTeamMemberController", err, "Failed to remove team member");
  }
};

export const updateTeamMemberRoleController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    const memberId = parseInt(req.params.memberId);
    const { role } = req.body;

    if (isNaN(teamId) || isNaN(memberId)) {
      return res.status(400).json({ error: "Invalid team ID or member ID" });
    }

    if (!role || !["owner", "manager", "member"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner") {
      return res.status(403).json({ error: "Only owners can change member roles" });
    }

    const updated = await teamService.updateTeamMemberRole(teamId, memberId, role);

    res.json({ member: updated });
  } catch (err) {
    return handleControllerError(res, "Error in updateTeamMemberRoleController", err, "Failed to update member role");
  }
};

export const leaveTeamController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    await teamService.leaveTeam(teamId, user.id);

    res.json({ message: "Left team successfully" });
  } catch (err) {
    return handleControllerError(res, "Error in leaveTeamController", err, "Failed to leave team");
  }
};

export const updateTeamNameController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    const { name } = req.body;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner") {
      return res.status(403).json({ error: "Only owners can rename the team" });
    }

    const updated = await teamService.updateTeamName(teamId, name.trim());

    res.json({ team: updated });
  } catch (err) {
    return handleControllerError(res, "Error in updateTeamNameController", err, "Failed to update team name");
  }
};

export const deleteTeamController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner") {
      return res.status(403).json({ error: "Only owners can delete the team" });
    }

    await teamService.deleteTeam(teamId);

    res.json({ message: "Team deleted successfully" });
  } catch (err) {
    return handleControllerError(res, "Error in deleteTeamController", err, "Failed to delete team");
  }
};

export const createTeamController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const user = await userService.getUserBySupabaseUid(userId);

    const team = await teamService.createTeam(name.trim(), user.id, "business");

    res.status(201).json({ team });
  } catch (err) {
    return handleControllerError(res, "Error in createTeamController", err, "Failed to create team");
  }
};

export const getTeamLogoController = async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const team = await teamService.getTeamWithType(teamId);
    if (!team?.logo_url) {
      return res.status(404).json({ error: "No logo found" });
    }

    const presignedUrl = await s3Service.getPresignedUrl(team.logo_url, 60);
    res.redirect(302, presignedUrl);
  } catch (err) {
    return handleControllerError(res, "Error in getTeamLogoController", err, "Failed to get logo");
  }
};

export const uploadTeamLogoController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const membership = await teamService.getTeamMember(teamId, user.id);

    if (!membership || membership.role !== "owner") {
      return res.status(403).json({ error: "Only team owners can update the logo" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const logoKey = await s3Service.uploadTeamLogo(
      req.file.buffer,
      teamId,
      req.file.mimetype
    );

    const updatedTeam = await teamService.updateTeamLogo(teamId, logoKey);

    res.json({ team: { ...updatedTeam, logo_url: logoKey, role: membership.role } });
  } catch (err) {
    return handleControllerError(res, "Error in uploadTeamLogoController", err, "Failed to upload logo");
  }
};

export const removeTeamLogoController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await userService.getUserBySupabaseUid(userId);
    const membership = await teamService.getTeamMember(teamId, user.id);

    if (!membership || membership.role !== "owner") {
      return res.status(403).json({ error: "Only team owners can remove the logo" });
    }

    const updatedTeam = await teamService.updateTeamLogo(teamId, null);

    res.json({ team: { ...updatedTeam, role: membership.role } });
  } catch (err) {
    return handleControllerError(res, "Error in removeTeamLogoController", err, "Failed to remove logo");
  }
};
