import { db } from "../../db";
import { userAccounts, userPosts } from "@clipper/shared-db/src/schema";
import { eq, and } from "drizzle-orm";
import { AccountTrackingService } from "./accountTracking.service";
import {
  USER_ACCOUNT_INITIAL_SYNCS,
  USER_ACCOUNT_SOURCE_MASS_POSTING,
} from "../../config/viralitySyncConstants";

class UserPerformanceService extends AccountTrackingService {
  constructor() {
    super(userAccounts, userPosts);
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
