import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { teamService } from "../services/team.service";
import { userService } from "../services/user.service";
import { clipManagerService } from "../services/clipManager.service";
import { s3Service } from "../services/s3.service";
import { PLAN_LIMITS } from "../config/stripe.config";

export const getUserTeamsController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await userService.getUserBySupabaseUid(req.user.id);

    // Ensure user has at least one team (migration helper)
    await userService.ensureUserHasTeam(user.id);

    const teams = await teamService.getUserTeams(user.id);

    res.json({ teams });
  } catch (err) {
    console.error("Error in getUserTeamsController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get teams",
    });
  }
};

export const getDefaultTeamController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await userService.getUserBySupabaseUid(req.user.id);

    // Ensure user has at least one team (migration helper)
    await userService.ensureUserHasTeam(user.id);

    const defaultTeam = await teamService.getUserDefaultTeam(user.id);

    res.json(defaultTeam);
  } catch (err) {
    console.error("Error in getDefaultTeamController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get default team",
    });
  }
};

export const getTeamUsageStatsController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    // Get user to verify access
    const user = await userService.getUserBySupabaseUid(req.user.id);

    // Verify user has access to this team
    const hasAccess = await teamService.verifyTeamAccess(teamId, user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this team" });
    }

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
      // Legacy fields for backward compatibility
      limit: stats.limit,
      remaining: totalRemaining,
    });
  } catch (err) {
    console.error("Error in getTeamUsageStatsController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get usage stats",
    });
  }
};

export const getTeamMembersController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    // Get user to verify access
    const user = await userService.getUserBySupabaseUid(req.user.id);

    // Verify user has access to this team
    const hasAccess = await teamService.verifyTeamAccess(teamId, user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this team" });
    }

    const members = await teamService.getTeamMembers(teamId);

    res.json({ members });
  } catch (err) {
    console.error("Error in getTeamMembersController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get team members",
    });
  }
};

export const addTeamMemberController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const { email, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if team is on Scale or Enterprise plan (only Scale/Enterprise allows team members)
    const team = await teamService.getTeamById(teamId);
    if (team.plan !== "scale" && team.plan !== "enterprise") {
      return res.status(403).json({
        error: "Team collaboration requires a Scale or Enterprise plan. Please upgrade to invite team members.",
      });
    }

    // Get user to verify permissions
    const user = await userService.getUserBySupabaseUid(req.user.id);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner" && userRole !== "manager") {
      return res.status(403).json({ error: "Only owners and managers can add members" });
    }

    const member = await teamService.addTeamMember(teamId, email, role || "member");

    res.json({ member });
  } catch (err) {
    console.error("Error in addTeamMemberController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to add team member",
    });
  }
};

export const removeTeamMemberController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const teamId = parseInt(req.params.teamId);
    const memberId = parseInt(req.params.memberId);

    if (isNaN(teamId) || isNaN(memberId)) {
      return res.status(400).json({ error: "Invalid team ID or member ID" });
    }

    // Get user to verify permissions
    const user = await userService.getUserBySupabaseUid(req.user.id);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner" && userRole !== "manager") {
      return res.status(403).json({ error: "Only owners and managers can remove members" });
    }

    // Check if manager is trying to remove an owner
    if (userRole === "manager") {
      const memberRole = await teamService.getMemberRoleById(teamId, memberId);
      if (memberRole === "owner") {
        return res.status(403).json({ error: "Managers cannot remove owners" });
      }
    }

    await teamService.removeTeamMember(teamId, memberId);

    res.json({ message: "Member removed successfully" });
  } catch (err) {
    console.error("Error in removeTeamMemberController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to remove team member",
    });
  }
};

export const updateTeamMemberRoleController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const teamId = parseInt(req.params.teamId);
    const memberId = parseInt(req.params.memberId);
    const { role } = req.body;

    if (isNaN(teamId) || isNaN(memberId)) {
      return res.status(400).json({ error: "Invalid team ID or member ID" });
    }

    if (!role || !["owner", "manager", "member"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Get user to verify permissions (only owners can change roles)
    const user = await userService.getUserBySupabaseUid(req.user.id);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner") {
      return res.status(403).json({ error: "Only owners can change member roles" });
    }

    const updated = await teamService.updateTeamMemberRole(teamId, memberId, role);

    res.json({ member: updated });
  } catch (err) {
    console.error("Error in updateTeamMemberRoleController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to update member role",
    });
  }
};

export const leaveTeamController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await userService.getUserBySupabaseUid(req.user.id);
    await teamService.leaveTeam(teamId, user.id);

    res.json({ message: "Left team successfully" });
  } catch (err) {
    console.error("Error in leaveTeamController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to leave team",
    });
  }
};

export const updateTeamNameController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const teamId = parseInt(req.params.teamId);
    const { name } = req.body;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Team name is required" });
    }

    // Get user to verify permissions (only owners can rename)
    const user = await userService.getUserBySupabaseUid(req.user.id);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner") {
      return res.status(403).json({ error: "Only owners can rename the team" });
    }

    const updated = await teamService.updateTeamName(teamId, name.trim());

    res.json({ team: updated });
  } catch (err) {
    console.error("Error in updateTeamNameController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to update team name",
    });
  }
};

export const deleteTeamController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await userService.getUserBySupabaseUid(req.user.id);
    const userRole = await teamService.getUserTeamRole(teamId, user.id);

    if (userRole !== "owner") {
      return res.status(403).json({ error: "Only owners can delete the team" });
    }

    await teamService.deleteTeam(teamId);

    res.json({ message: "Team deleted successfully" });
  } catch (err) {
    console.error("Error in deleteTeamController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to delete team",
    });
  }
};

export const createTeamController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const user = await userService.getUserBySupabaseUid(req.user.id);

    const { canCreate, reason } = await teamService.canUserCreateTeam(user.id);
    if (!canCreate) {
      return res.status(403).json({
        error: reason,
        requiresSubscription: true,
      });
    }

    const team = await teamService.createTeam(name.trim(), user.id, "business");

    res.status(201).json({ team });
  } catch (err) {
    console.error("Error in createTeamController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create team",
    });
  }
};

export const uploadTeamLogoController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await userService.getUserBySupabaseUid(req.user.id);
    const membership = await teamService.getTeamMember(teamId, user.id);

    if (!membership || membership.role !== "owner") {
      return res.status(403).json({ error: "Only team owners can update the logo" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload to S3
    const logoKey = await s3Service.uploadTeamLogo(
      req.file.buffer,
      teamId,
      req.file.mimetype
    );

    // Store the S3 key in database (not presigned URL)
    const updatedTeam = await teamService.updateTeamLogo(teamId, logoKey);

    // Generate a presigned URL for the response (1 hour)
    const logoUrl = await s3Service.getPresignedUrl(logoKey, 3600);

    res.json({ team: { ...updatedTeam, logo_url: logoUrl, role: membership.role } });
  } catch (err) {
    console.error("Error in uploadTeamLogoController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to upload logo",
    });
  }
};

export const removeTeamLogoController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const user = await userService.getUserBySupabaseUid(req.user.id);
    const membership = await teamService.getTeamMember(teamId, user.id);

    if (!membership || membership.role !== "owner") {
      return res.status(403).json({ error: "Only team owners can remove the logo" });
    }

    // Update team with null logo URL
    const updatedTeam = await teamService.updateTeamLogo(teamId, null);

    res.json({ team: { ...updatedTeam, role: membership.role } });
  } catch (err) {
    console.error("Error in removeTeamLogoController:", err);
    Sentry.captureException(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to remove logo",
    });
  }
};
