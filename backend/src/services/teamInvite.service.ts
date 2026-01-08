import * as Sentry from "@sentry/node";
import { db } from "../db";
import { teams, teamMembers, teamInvites, users } from "@clipper/shared-db/src/schema";
import { eq, and, lt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { emailNotiService } from "./emailNoti.service";
import { canInviteMembers } from "../utils/plans";

const INVITE_EXPIRY_DAYS = 7;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

class TeamInviteService {
  private generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  private getExpiryDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + INVITE_EXPIRY_DAYS);
    return date;
  }

  async createInvite(
    teamId: number,
    invitedByUserId: number,
    email: string,
    role: "manager" | "member" = "member"
  ) {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      throw new Error("Team not found");
    }

    if (team.type === "personal" && !canInviteMembers(team.plan)) {
      throw new Error("Cannot invite members to personal workspaces. Upgrade to Scale plan to invite team members.");
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      const [existingMember] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, existingUser.id)))
        .limit(1);

      if (existingMember) {
        throw new Error("User is already a member of this team");
      }
    }

    const [existingInvite] = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.team_id, teamId),
          eq(teamInvites.email, email.toLowerCase()),
          eq(teamInvites.status, "pending")
        )
      )
      .limit(1);

    if (existingInvite) {
      await db
        .update(teamInvites)
        .set({ status: "revoked", updated_at: new Date() })
        .where(eq(teamInvites.id, existingInvite.id));
    }

    const [inviter] = await db
      .select()
      .from(users)
      .where(eq(users.id, invitedByUserId))
      .limit(1);

    if (!inviter) {
      throw new Error("Inviter not found");
    }

    const token = this.generateToken();
    const expiresAt = this.getExpiryDate();

    const [invite] = await db
      .insert(teamInvites)
      .values({
        team_id: teamId,
        invited_by_user_id: invitedByUserId,
        email: email.toLowerCase(),
        role,
        token,
        status: "pending",
        expires_at: expiresAt,
      })
      .returning();

    const inviteUrl = `${FRONTEND_URL}/invite/${token}`;

    try {
      await emailNotiService.sendTeamInvite(email, {
        inviterName: `${inviter.first_name} ${inviter.last_name}`,
        teamName: team.name,
        inviteUrl,
        role: role.charAt(0).toUpperCase() + role.slice(1),
        expiresIn: `${INVITE_EXPIRY_DAYS} days`,
      });
    } catch (error) {
      console.error("Failed to send invite email:", error);
      Sentry.captureException(error);
    }

    return invite;
  }

  async getTeamInvites(teamId: number) {
    const invites = await db
      .select({
        id: teamInvites.id,
        email: teamInvites.email,
        role: teamInvites.role,
        status: teamInvites.status,
        expiresAt: teamInvites.expires_at,
        createdAt: teamInvites.created_at,
        invitedBy: {
          id: users.id,
          firstName: users.first_name,
          lastName: users.last_name,
          email: users.email,
        },
      })
      .from(teamInvites)
      .innerJoin(users, eq(teamInvites.invited_by_user_id, users.id))
      .where(eq(teamInvites.team_id, teamId))
      .orderBy(teamInvites.created_at);

    return invites;
  }

  async getInviteByToken(token: string) {
    const [invite] = await db
      .select({
        id: teamInvites.id,
        email: teamInvites.email,
        role: teamInvites.role,
        status: teamInvites.status,
        expiresAt: teamInvites.expires_at,
        team: {
          id: teams.id,
          name: teams.name,
          type: teams.type,
          plan: teams.plan,
        },
        invitedBy: {
          firstName: users.first_name,
          lastName: users.last_name,
        },
      })
      .from(teamInvites)
      .innerJoin(teams, eq(teamInvites.team_id, teams.id))
      .innerJoin(users, eq(teamInvites.invited_by_user_id, users.id))
      .where(eq(teamInvites.token, token))
      .limit(1);

    return invite || null;
  }

  async acceptInvite(token: string, userId: number) {
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.token, token))
      .limit(1);

    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.status !== "pending") {
      throw new Error(`Invite has already been ${invite.status}`);
    }

    if (new Date() > invite.expires_at) {
      await db
        .update(teamInvites)
        .set({ status: "expired", updated_at: new Date() })
        .where(eq(teamInvites.id, invite.id));
      throw new Error("Invite has expired");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("This invite was sent to a different email address");
    }

    const [existingMember] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, invite.team_id), eq(teamMembers.user_id, userId)))
      .limit(1);

    if (existingMember) {
      await db
        .update(teamInvites)
        .set({ status: "accepted", accepted_at: new Date(), updated_at: new Date() })
        .where(eq(teamInvites.id, invite.id));
      throw new Error("You are already a member of this team");
    }

    await db.insert(teamMembers).values({
      team_id: invite.team_id,
      user_id: userId,
      role: invite.role,
    });

    await db
      .update(teamInvites)
      .set({ status: "accepted", accepted_at: new Date(), updated_at: new Date() })
      .where(eq(teamInvites.id, invite.id));

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, invite.team_id))
      .limit(1);

    return { team, role: invite.role };
  }

  async revokeInvite(inviteId: number, teamId: number) {
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(and(eq(teamInvites.id, inviteId), eq(teamInvites.team_id, teamId)))
      .limit(1);

    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.status !== "pending") {
      throw new Error("Can only revoke pending invites");
    }

    await db
      .update(teamInvites)
      .set({ status: "revoked", updated_at: new Date() })
      .where(eq(teamInvites.id, inviteId));
  }

  async resendInvite(inviteId: number, teamId: number) {
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(and(eq(teamInvites.id, inviteId), eq(teamInvites.team_id, teamId)))
      .limit(1);

    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.status !== "pending") {
      throw new Error("Can only resend pending invites");
    }

    const newToken = this.generateToken();
    const newExpiresAt = this.getExpiryDate();

    await db
      .update(teamInvites)
      .set({ token: newToken, expires_at: newExpiresAt, updated_at: new Date() })
      .where(eq(teamInvites.id, inviteId));

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    const [inviter] = await db
      .select()
      .from(users)
      .where(eq(users.id, invite.invited_by_user_id))
      .limit(1);

    if (team && inviter) {
      const inviteUrl = `${FRONTEND_URL}/invite/${newToken}`;
      await emailNotiService.sendTeamInvite(invite.email, {
        inviterName: `${inviter.first_name} ${inviter.last_name}`,
        teamName: team.name,
        inviteUrl,
        role: invite.role.charAt(0).toUpperCase() + invite.role.slice(1),
        expiresIn: `${INVITE_EXPIRY_DAYS} days`,
      });
    }
  }

  async getPendingInvitesForEmail(email: string) {
    const invites = await db
      .select({
        id: teamInvites.id,
        token: teamInvites.token,
        role: teamInvites.role,
        team: {
          id: teams.id,
          name: teams.name,
        },
      })
      .from(teamInvites)
      .innerJoin(teams, eq(teamInvites.team_id, teams.id))
      .where(
        and(
          eq(teamInvites.email, email.toLowerCase()),
          eq(teamInvites.status, "pending")
        )
      );

    return invites.filter((invite) => new Date() <= new Date(invite.id));
  }

  async acceptAllPendingInvitesForUser(userId: number, email: string) {
    const pendingInvites = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.email, email.toLowerCase()),
          eq(teamInvites.status, "pending")
        )
      );

    const acceptedTeams: { teamId: number; role: string }[] = [];

    for (const invite of pendingInvites) {
      if (new Date() > invite.expires_at) {
        await db
          .update(teamInvites)
          .set({ status: "expired", updated_at: new Date() })
          .where(eq(teamInvites.id, invite.id));
        continue;
      }

      const [existingMember] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.team_id, invite.team_id), eq(teamMembers.user_id, userId)))
        .limit(1);

      if (!existingMember) {
        await db.insert(teamMembers).values({
          team_id: invite.team_id,
          user_id: userId,
          role: invite.role,
        });
        acceptedTeams.push({ teamId: invite.team_id, role: invite.role });
      }

      await db
        .update(teamInvites)
        .set({ status: "accepted", accepted_at: new Date(), updated_at: new Date() })
        .where(eq(teamInvites.id, invite.id));
    }

    return acceptedTeams;
  }

  async cleanupExpiredInvites() {
    await db
      .update(teamInvites)
      .set({ status: "expired", updated_at: new Date() })
      .where(
        and(
          eq(teamInvites.status, "pending"),
          lt(teamInvites.expires_at, new Date())
        )
      );
  }
}

export const teamInviteService = new TeamInviteService();
