import { db } from "../../db";
import { userAccounts, userPosts, viralityGroups, posts } from "@clipper/shared-db/src/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
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

  async getAccountsByTeamFiltered(teamId: number, source?: string) {
    const accounts = await this.getAccountsByTeam(teamId);
    if (!source) return accounts;
    return accounts.filter((a: any) => a.source === source);
  }

  async backfillManagedAccounts(teamId: number): Promise<{ created: number; skipped: number }> {
    const rows = await db
      .select({
        id: posts.id,
        platform: posts.platform,
        accountHandle: posts.accountHandle,
        post_url: posts.post_url,
        content: posts.content,
        posted_time: posts.posted_time,
      })
      .from(posts)
      .where(
        and(
          eq(posts.team_id, teamId),
          eq(posts.status, "posted"),
          isNotNull(posts.accountHandle),
        )
      );

    const TRACKABLE = new Set(["instagram", "tiktok", "x"]);
    const buildProfileUrl = (platform: string, username: string) => {
      if (platform === "instagram") return "https://www.instagram.com/" + username + "/";
      if (platform === "tiktok") return "https://www.tiktok.com/@" + username;
      return "https://x.com/" + username;
    };

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      if (!row.accountHandle || !TRACKABLE.has(row.platform)) {
        skipped++;
        continue;
      }

      const platform = row.platform as "instagram" | "tiktok" | "x";

      const { id: accountId, created: wasCreated } = await this.findOrCreateMassPostingAccount(
        teamId, platform, row.accountHandle, (u: string) => buildProfileUrl(platform, u)
      );

      if (wasCreated) created++;

      if (row.post_url) {
        await this.createMassPostUserPost(
          accountId,
          row.id,
          row.post_url,
          platform,
          row.content,
          row.posted_time ? new Date(row.posted_time) : null,
        );
      }
    }

    return { created, skipped };
  }
}

export const userPerformanceService = new UserPerformanceService();
