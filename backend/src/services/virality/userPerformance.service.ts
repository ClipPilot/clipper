import { db } from "../../db";
import { userAccounts, userPosts, viralityGroups } from "@clipper/shared-db/src/schema";
import { eq, and, inArray } from "drizzle-orm";
import { AccountTrackingService } from "./accountTracking.service";
import {
  USER_ACCOUNT_INITIAL_SYNCS,
  USER_ACCOUNT_SOURCE_MASS_POSTING,
} from "../../config/viralitySyncConstants";

const MY_PERFORMANCE_GROUP_NAME = "My Performance";

class UserPerformanceService extends AccountTrackingService {
  constructor() {
    super(userAccounts, userPosts);
  }

  async getAccountsByTeam(teamId: number) {
    const accounts = await super.getAccountsByTeam(teamId);

    const ungrouped = accounts.filter((a: any) => a.group_id == null);
    if (ungrouped.length > 0) {
      const group = await this.findOrCreateMyPerformanceGroup(teamId);
      const ids = ungrouped.map((a: any) => a.id);
      await db
        .update(userAccounts)
        .set({ group_id: group.id })
        .where(inArray(userAccounts.id, ids));

      for (const a of accounts) {
        if ((a as any).group_id == null) (a as any).group_id = group.id;
      }
    }

    return accounts;
  }

  async findOrCreateMyPerformanceGroup(teamId: number) {
    const [existing] = await db
      .select()
      .from(viralityGroups)
      .where(
        and(
          eq(viralityGroups.team_id, teamId),
          eq(viralityGroups.competitor, false),
          eq(viralityGroups.name, MY_PERFORMANCE_GROUP_NAME),
        )
      )
      .limit(1);

    if (existing) return existing;

    const [created] = await db
      .insert(viralityGroups)
      .values({
        team_id: teamId,
        name: MY_PERFORMANCE_GROUP_NAME,
        competitor: false,
      })
      .returning();

    return created;
  }

  async findOrCreateMassPostingAccount(
    teamId: number,
    platform: "instagram" | "tiktok" | "x",
    username: string,
    buildProfileUrl: (u: string) => string
  ): Promise<{ id: number; created: boolean }> {
    const existing = await db
      .select({ id: userAccounts.id })
      .from(userAccounts)
      .where(
        and(
          eq(userAccounts.team_id, teamId),
          eq(userAccounts.platform, platform),
          eq(userAccounts.username, username)
        )
      )
      .limit(1);

    if (existing.length > 0) return { id: existing[0].id, created: false };

    const [inserted] = await db
      .insert(userAccounts)
      .values({
        team_id: teamId,
        platform,
        username,
        profile_url: buildProfileUrl(username),
        source: USER_ACCOUNT_SOURCE_MASS_POSTING,
        is_active: true,
        syncs_remaining: USER_ACCOUNT_INITIAL_SYNCS,
      })
      .returning({ id: userAccounts.id });

    return { id: inserted.id, created: true };
  }
}

export const userPerformanceService = new UserPerformanceService();
