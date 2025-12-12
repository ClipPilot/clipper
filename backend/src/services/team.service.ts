import { db } from "../db";
import { teams, teamMembers, users, usageStats } from "@clipper/shared-db/src/schema";
import { eq, and, desc } from "drizzle-orm";

class TeamService {
  /**
   * Get all teams for a user by user ID
   */
  async getUserTeams(userId: number) {
    // Get all teams the user is a member of
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        type: teams.type,
        teamSubscriptionId: teams.teamSubscrptionId,
        role: teamMembers.role,
        created_at: teams.created_at,
        updated_at: teams.updated_at,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.team_id, teams.id))
      .where(eq(teamMembers.user_id, userId))
      .orderBy(teams.created_at);

    return userTeams;
  }

  /**
   * Get default team for user (first team where they're owner)
   */
  async getUserDefaultTeam(userId: number) {
    const [defaultTeam] = await db
      .select({
        id: teams.id,
        name: teams.name,
        type: teams.type,
        teamSubscriptionId: teams.teamSubscrptionId,
        role: teamMembers.role,
        created_at: teams.created_at,
        updated_at: teams.updated_at,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.team_id, teams.id))
      .where(and(eq(teamMembers.user_id, userId), eq(teamMembers.role, "owner")))
      .orderBy(teams.created_at)
      .limit(1);

    if (!defaultTeam) {
      throw new Error("No default team found for user");
    }

    return defaultTeam;
  }

  /**
   * Get team by ID
   */
  async getTeamById(teamId: number) {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);

    if (!team) {
      throw new Error("Team not found");
    }

    return team;
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId: number) {
    const members = await db
      .select({
        id: teamMembers.id,
        userId: users.id,
        email: users.email,
        firstName: users.first_name,
        lastName: users.last_name,
        role: teamMembers.role,
        joinedAt: teamMembers.created_at,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.user_id, users.id))
      .where(eq(teamMembers.team_id, teamId));

    return members;
  }

  /**
   * Get team usage stats
   */
  async getTeamUsageStats(teamId: number) {
    const [stats] = await db
      .select()
      .from(usageStats)
      .where(eq(usageStats.team_id, teamId))
      .orderBy(desc(usageStats.created_at))
      .limit(1);

    if (!stats) {
      throw new Error("Usage stats not found for team");
    }

    return stats;
  }

  /**
   * Create a new team
   */
  async createTeam(name: string, creatorUserId: number, type: "personal" | "business" | "enterprise" = "business") {
    const [team] = await db
      .insert(teams)
      .values({
        name,
        type,
      })
      .returning();

    // Add creator as owner
    await db.insert(teamMembers).values({
      team_id: team.id,
      user_id: creatorUserId,
      role: "owner",
    });

    // Create initial usage stats
    const resetsDate = new Date();
    resetsDate.setDate(resetsDate.getDate() + 30);

    await db.insert(usageStats).values({
      team_id: team.id,
      date: new Date(),
      clips_created: 0,
      limit: 3,
      resets_date: resetsDate,
      rollover: false,
    });

    return team;
  }

  /**
   * Verify user has access to a team
   */
  async verifyTeamAccess(teamId: number, userId: number): Promise<boolean> {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, userId)))
      .limit(1);

    return !!member;
  }

  /**
   * Get user's role in a team
   */
  async getUserTeamRole(teamId: number, userId: number): Promise<"owner" | "manager" | "member" | null> {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, userId)))
      .limit(1);

    return member ? member.role : null;
  }

  /**
   * Add member to team
   */
  async addTeamMember(teamId: number, userEmail: string, role: "manager" | "member" = "member") {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      throw new Error("Team not found");
    }

    if (team.type === "personal") {
      throw new Error("Cannot add members to personal teams. Upgrade to a business plan to collaborate.");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    const [existingMember] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.id)))
      .limit(1);

    if (existingMember) {
      throw new Error("User is already a member of this team");
    }

    const [member] = await db
      .insert(teamMembers)
      .values({
        team_id: teamId,
        user_id: user.id,
        role,
      })
      .returning();

    return member;
  }

  /**
   * Remove member from team
   */
  async removeTeamMember(teamId: number, memberId: number) {
    // Check if this is the last owner
    const owners = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, "owner")));

    const [memberToRemove] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, memberId))
      .limit(1);

    if (memberToRemove?.role === "owner" && owners.length === 1) {
      throw new Error("Cannot remove the last owner of the team");
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, memberId));
  }

  /**
   * Update team member role
   */
  async updateTeamMemberRole(teamId: number, memberId: number, newRole: "owner" | "manager" | "member") {
    // Check if trying to remove last owner
    if (newRole !== "owner") {
      const [currentMember] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.id, memberId))
        .limit(1);

      if (currentMember?.role === "owner") {
        const owners = await db
          .select()
          .from(teamMembers)
          .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, "owner")));

        if (owners.length === 1) {
          throw new Error("Cannot change role of the last owner");
        }
      }
    }

    const [updated] = await db
      .update(teamMembers)
      .set({ role: newRole, updated_at: new Date() })
      .where(eq(teamMembers.id, memberId))
      .returning();

    return updated;
  }

  /**
   * Leave team (remove self)
   */
  async leaveTeam(teamId: number, userId: number) {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, userId)))
      .limit(1);

    if (!member) {
      throw new Error("You are not a member of this team");
    }

    // Check if this is the last owner
    if (member.role === "owner") {
      const owners = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, "owner")));

      if (owners.length === 1) {
        throw new Error("Cannot leave team as the last owner. Transfer ownership or delete the team first.");
      }
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, member.id));
  }

  /**
   * Update team name
   */
  async updateTeamName(teamId: number, name: string) {
    const [updated] = await db
      .update(teams)
      .set({ name, updated_at: new Date() })
      .where(eq(teams.id, teamId))
      .returning();

    return updated;
  }

  /**
   * Delete team (owner only)
   */
  async deleteTeam(teamId: number) {
    await db.delete(teams).where(eq(teams.id, teamId));
  }

  /**
   * Check if user can create a new team
   */
  async canUserCreateTeam(userId: number): Promise<{ canCreate: boolean; reason?: string }> {
    const userTeamsData = await db
      .select({
        id: teams.id,
        type: teams.type,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.team_id, teams.id))
      .where(and(eq(teamMembers.user_id, userId), eq(teamMembers.role, "owner")));

    const personalTeam = userTeamsData.find(t => t.type === "personal");

    if (!personalTeam) {
      return { canCreate: true };
    }

    return {
      canCreate: false,
      reason: "You already have a personal team. To create additional teams, you need an active subscription.",
    };
  }

  /**
   * Get team by ID with type info
   */
  async getTeamWithType(teamId: number) {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    return team;
  }
}

export const teamService = new TeamService();
