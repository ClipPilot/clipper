import { db } from "../db";
import { users, teamMembers } from "@clipper/shared-db/src/schema";
import { eq } from "drizzle-orm";
import { teamService } from "./team.service";
class UserService {
  async getUserBySupabaseUid(supabaseUid: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.supabase_uid, supabaseUid))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  async getUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  async getUserById(userId: number) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  /**
   * Check if user has a default team, create one if not (migration helper)
   */
  async ensureUserHasTeam(userId: number) {
    const user = await this.getUserById(userId);

    // Check if user has any teams
    const [teamMember] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.user_id, user.id))
      .limit(1);

    if (!teamMember) {
      // User has no teams, need to create default team
      const teamName = `${user.first_name}'s Workspace`;
      await teamService.createTeam(teamName, user.id, "personal");
    }

    return user;
  }
}

export const userService = new UserService();
