import * as Sentry from "@sentry/node";
import { db } from "../db";
import { teams, teamMembers, users, usageStats, subscriptions } from "@clipper/shared-db/src/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { PLAN_LIMITS, stripe } from "../config/stripe.config";
import { s3Service } from "./s3.service";

class TeamService {
  /**
   * Get all teams for a user by user ID
   */
  async getUserTeams(userId: number) {
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        type: teams.type,
        plan: teams.plan,
        teamSubscriptionId: teams.teamSubscrptionId,
        logo_url: teams.logo_url,
        role: teamMembers.role,
        created_at: teams.created_at,
        updated_at: teams.updated_at,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.team_id, teams.id))
      .where(eq(teamMembers.user_id, userId))
      .orderBy(teams.created_at);

    // Generate presigned URLs for logos
    return Promise.all(
      userTeams.map(async (team) => ({
        ...team,
        logo_url: team.logo_url ? await s3Service.getPresignedUrl(team.logo_url, 3600) : null,
      }))
    );
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
        plan: teams.plan,
        teamSubscriptionId: teams.teamSubscrptionId,
        logo_url: teams.logo_url,
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

    // Generate presigned URL for logo if exists
    return {
      ...defaultTeam,
      logo_url: defaultTeam.logo_url ? await s3Service.getPresignedUrl(defaultTeam.logo_url, 3600) : null,
    };
  }

  /**
   * Get team by ID
   */
  async getTeamById(teamId: number) {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);

    if (!team) {
      throw new Error("Team not found");
    }

    // Generate presigned URL for logo if exists
    return {
      ...team,
      logo_url: team.logo_url ? await s3Service.getPresignedUrl(team.logo_url, 3600) : null,
    };
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
   * Get a specific team member by team and user ID
   */
  async getTeamMember(teamId: number, userId: number) {
    const [member] = await db
      .select({
        id: teamMembers.id,
        userId: users.id,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.user_id, users.id))
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, userId)))
      .limit(1);

    return member || null;
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
   * Increment team usage (charge credits)
   */
  async incrementTeamUsage(teamId: number, count: number = 1) {
    const stats = await this.getTeamUsageStats(teamId);
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    const baseRemaining = Math.max(0, stats.limit - stats.clips_created);
    const addonRemaining = team?.addon_clips_remaining || 0;

    let fromBase = 0;
    let fromAddon = 0;

    if (count <= baseRemaining) {
      fromBase = count;
    } else {
      fromBase = baseRemaining;
      fromAddon = count - baseRemaining;
    }

    if (fromBase > 0) {
      await db
        .update(usageStats)
        .set({
          clips_created: stats.clips_created + fromBase,
          updated_at: new Date(),
        })
        .where(eq(usageStats.id, stats.id));
    }

    if (fromAddon > 0 && team) {
      await db
        .update(teams)
        .set({
          addon_clips_remaining: Math.max(0, addonRemaining - fromAddon),
          updated_at: new Date(),
        })
        .where(eq(teams.id, teamId));
    }

    console.log(`[team-service] Charged ${count} credits to team ${teamId} (base: ${fromBase}, addon: ${fromAddon})`);
  }

  /**
   * Decrement team usage (refund credits)
   */
  async decrementTeamUsage(teamId: number, count: number = 1) {
    const stats = await this.getTeamUsageStats(teamId);
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    const refundableToBase = Math.min(count, stats.clips_created);
    const refundToAddon = count - refundableToBase;

    if (refundableToBase > 0) {
      await db
        .update(usageStats)
        .set({
          clips_created: stats.clips_created - refundableToBase,
          updated_at: new Date(),
        })
        .where(eq(usageStats.id, stats.id));
    }

    if (refundToAddon > 0 && team) {
      const currentAddon = team.addon_clips_remaining || 0;
      await db
        .update(teams)
        .set({
          addon_clips_remaining: currentAddon + refundToAddon,
          updated_at: new Date(),
        })
        .where(eq(teams.id, teamId));
    }

    console.log(`[team-service] Refunded ${count} credits to team ${teamId} (base: ${refundableToBase}, addon: ${refundToAddon})`);
  }

  /**
   * Consume one clip from the team's quota.
   * Order: Base plan clips first, then addon clips.
   * Returns info about whether successful and which pool was used.
   */
  async consumeClip(
    teamId: number
  ): Promise<{ success: boolean; source: "base" | "addon" | null }> {
    const stats = await this.getTeamUsageStats(teamId);
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return { success: false, source: null };
    }

    const baseRemaining = Math.max(0, stats.limit - stats.clips_created);
    const addonRemaining = team.addon_clips_remaining || 0;

    if (baseRemaining > 0) {
      // Consume from base plan
      await db
        .update(usageStats)
        .set({
          clips_created: stats.clips_created + 1,
          updated_at: new Date(),
        })
        .where(eq(usageStats.id, stats.id));
      return { success: true, source: "base" };
    } else if (addonRemaining > 0) {
      // Consume from addon pool
      await db
        .update(teams)
        .set({
          addon_clips_remaining: addonRemaining - 1,
          updated_at: new Date(),
        })
        .where(eq(teams.id, teamId));
      return { success: true, source: "addon" };
    }

    return { success: false, source: null };
  }

  /**
   * Consume multiple credits from the team's quota.
   * Order: Base plan credits first, then addon credits.
   * Returns info about whether successful and breakdown of consumption.
   */
  async consumeMultiple(
    teamId: number,
    count: number
  ): Promise<{
    success: boolean;
    consumed: number;
    fromBase: number;
    fromAddon: number;
    remaining: { base: number; addon: number; total: number };
  }> {
    const stats = await this.getTeamUsageStats(teamId);
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return {
        success: false,
        consumed: 0,
        fromBase: 0,
        fromAddon: 0,
        remaining: { base: 0, addon: 0, total: 0 },
      };
    }

    const baseRemaining = Math.max(0, stats.limit - stats.clips_created);
    const addonRemaining = team.addon_clips_remaining || 0;
    const totalRemaining = baseRemaining + addonRemaining;

    if (totalRemaining < count) {
      return {
        success: false,
        consumed: 0,
        fromBase: 0,
        fromAddon: 0,
        remaining: { base: baseRemaining, addon: addonRemaining, total: totalRemaining },
      };
    }

    let fromBase = 0;
    let fromAddon = 0;

    if (count <= baseRemaining) {
      fromBase = count;
    } else {
      fromBase = baseRemaining;
      fromAddon = count - baseRemaining;
    }

    if (fromBase > 0) {
      await db
        .update(usageStats)
        .set({
          clips_created: stats.clips_created + fromBase,
          updated_at: new Date(),
        })
        .where(eq(usageStats.id, stats.id));
    }

    if (fromAddon > 0) {
      await db
        .update(teams)
        .set({
          addon_clips_remaining: addonRemaining - fromAddon,
          updated_at: new Date(),
        })
        .where(eq(teams.id, teamId));
    }

    return {
      success: true,
      consumed: count,
      fromBase,
      fromAddon,
      remaining: {
        base: baseRemaining - fromBase,
        addon: addonRemaining - fromAddon,
        total: totalRemaining - count,
      },
    };
  }

  /**
   * Create a new team
   * First team gets 15 free credits, additional teams get 0 (must subscribe)
   */
  async createTeam(name: string, creatorUserId: number, type: "personal" | "business" | "enterprise" = "business") {
    // Check if user already owns any teams
    const existingTeams = await db
      .select({ id: teams.id })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.team_id, teams.id))
      .where(and(eq(teamMembers.user_id, creatorUserId), eq(teamMembers.role, "owner")));

    const isFirstTeam = existingTeams.length === 0;

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

    const resetsDate = new Date();
    resetsDate.setDate(resetsDate.getDate() + 30);

    await db.insert(usageStats).values({
      team_id: team.id,
      date: new Date(),
      clips_created: 0,
      limit: isFirstTeam ? PLAN_LIMITS.FREE.clips : 0,
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
   * Get member role by member ID
   */
  async getMemberRoleById(teamId: number, memberId: number): Promise<"owner" | "manager" | "member" | null> {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.id, memberId)))
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
   * Note: Ownership cannot be transferred. If trying to make someone an owner,
   * they will be made a manager instead.
   */
  async updateTeamMemberRole(teamId: number, memberId: number, newRole: "owner" | "manager" | "member") {
    // Ownership cannot be transferred - make them manager instead
    if (newRole === "owner") {
      newRole = "manager";
    }

    // Check if trying to demote last owner
    const [currentMember] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, memberId))
      .limit(1);

    if (currentMember?.role === "owner") {
      throw new Error("Cannot change the owner's role. Ownership is permanent.");
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
   * Update team logo URL
   */
  async updateTeamLogo(teamId: number, logoUrl: string | null) {
    const [updated] = await db
      .update(teams)
      .set({ logo_url: logoUrl, updated_at: new Date() })
      .where(eq(teams.id, teamId))
      .returning();

    return updated;
  }

  /**
   * Delete team (owner only)
   * Automatically cancels any active Stripe subscription
   */
  async deleteTeam(teamId: number) {
    // Check for active subscription and cancel it in Stripe
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.team_id, teamId))
      .limit(1);

    if (subscription && subscription.stripe_subscription_id) {
      try {
        // Cancel the subscription immediately in Stripe
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        console.log(
          `Cancelled Stripe subscription ${subscription.stripe_subscription_id} for team ${teamId}`
        );
      } catch (stripeError) {
        // Log but don't block deletion - subscription might already be cancelled
        console.error(
          `Failed to cancel Stripe subscription for team ${teamId}:`,
          stripeError
        );
        Sentry.captureException(stripeError);
      }
    }

    // Delete the team (cascades to team_members, usage_stats, subscriptions, clips, etc.)
    await db.delete(teams).where(eq(teams.id, teamId));
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

  /**
   * Get seat limit for a plan
   */
  getSeatLimitForPlan(plan: string): number {
    switch (plan) {
      case "enterprise":
        return PLAN_LIMITS.ENTERPRISE.seats;
      case "scale":
        return PLAN_LIMITS.SCALE.seats;
      case "studio":
        return PLAN_LIMITS.STUDIO.seats;
      default:
        return PLAN_LIMITS.FREE.seats;
    }
  }

  /**
   * Check if a member can perform actions based on seat limits.
   * When a team is over their seat limit (e.g., downgraded from Scale to Free),
   * only the owner can perform actions.
   */
  async canMemberPerformActions(
    teamId: number,
    userId: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return { allowed: false, reason: "Team not found" };
    }

    const userRole = await this.getUserTeamRole(teamId, userId);
    if (!userRole) {
      return { allowed: false, reason: "Not a member of this team" };
    }

    // Owners can always perform actions
    if (userRole === "owner") {
      return { allowed: true };
    }

    // Get seat limit for the plan
    const seatLimit = this.getSeatLimitForPlan(team.plan || "free");

    // Unlimited seats (-1) means everyone can perform actions
    if (seatLimit === -1) {
      return { allowed: true };
    }

    // Count current members
    const [memberCount] = await db
      .select({ count: count() })
      .from(teamMembers)
      .where(eq(teamMembers.team_id, teamId));

    const totalMembers = memberCount?.count || 0;

    // If over seat limit, only owner can perform actions
    if (totalMembers > seatLimit) {
      return {
        allowed: false,
        reason: `Your workspace has ${totalMembers} members but your ${team.plan || "free"} plan only allows ${seatLimit}. Only the workspace owner can perform actions until the plan is upgraded or members are removed.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get team member count
   */
  async getTeamMemberCount(teamId: number): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(teamMembers)
      .where(eq(teamMembers.team_id, teamId));

    return result?.count || 0;
  }
}

export const teamService = new TeamService();
