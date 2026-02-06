import * as Sentry from "@sentry/node";
import { db } from "../../db";
import {
  viralityTargets,
  viralityPosts,
  teams,
} from "@clipper/shared-db/src/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { apifyService, InstagramPost, InstagramProfile } from "./apify.service";

const MAX_TARGETS_PER_TEAM = 10;
const MAX_POSTS_PER_SYNC = 20;

class ViralityService {
  async getTargetsByTeam(teamId: number) {
    return db
      .select()
      .from(viralityTargets)
      .where(eq(viralityTargets.team_id, teamId))
      .orderBy(desc(viralityTargets.created_at));
  }

  async getTargetById(targetId: number) {
    const [target] = await db
      .select()
      .from(viralityTargets)
      .where(eq(viralityTargets.id, targetId))
      .limit(1);
    return target || null;
  }

  async getTargetCount(teamId: number): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(viralityTargets)
      .where(eq(viralityTargets.team_id, teamId));
    return result?.count || 0;
  }

  async addTarget(teamId: number, platform: "instagram", profileUrl: string) {
    // Check target limit
    const currentCount = await this.getTargetCount(teamId);
    if (currentCount >= MAX_TARGETS_PER_TEAM) {
      throw new Error(
        `Maximum of ${MAX_TARGETS_PER_TEAM} targets per team reached`
      );
    }

    const username = apifyService.parseInstagramUsername(profileUrl);

    // Check if target already exists
    const [existing] = await db
      .select()
      .from(viralityTargets)
      .where(
        and(
          eq(viralityTargets.team_id, teamId),
          eq(viralityTargets.platform, platform),
          eq(viralityTargets.username, username)
        )
      )
      .limit(1);

    if (existing) {
      throw new Error(`Target @${username} is already being tracked`);
    }

    const [target] = await db
      .insert(viralityTargets)
      .values({
        team_id: teamId,
        platform,
        username,
        profile_url: `https://www.instagram.com/${username}/`,
        sync_status: "pending",
      })
      .returning();

    return target;
  }

  async deleteTarget(targetId: number, teamId: number) {
    // Verify ownership
    const target = await this.getTargetById(targetId);
    if (!target || target.team_id !== teamId) {
      throw new Error("Target not found or access denied");
    }

    await db.delete(viralityTargets).where(eq(viralityTargets.id, targetId));
  }

  async syncTarget(targetId: number, teamId: number) {
    // Verify ownership
    const target = await this.getTargetById(targetId);
    if (!target || target.team_id !== teamId) {
      throw new Error("Target not found or access denied");
    }

    // Update status to syncing
    await db
      .update(viralityTargets)
      .set({
        sync_status: "syncing",
        sync_error: null,
        updated_at: new Date(),
      })
      .where(eq(viralityTargets.id, targetId));

    try {
      // Scrape Instagram posts using Apify SDK
      const { posts, profile } = await apifyService.scrapeInstagramPosts(
        target.username,
        MAX_POSTS_PER_SYNC
      );
      console.log(`Scraped ${posts.length} posts for @${target.username}`);

      // Update profile info if available
      if (profile) {
        await this.updateTargetProfile(targetId, profile);
      }

      // Process and store posts
      for (const postData of posts) {
        await this.upsertPost(targetId, postData);
      }

      // Update sync status
      await db
        .update(viralityTargets)
        .set({
          sync_status: "completed",
          last_synced_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(viralityTargets.id, targetId));

      return { success: true, postsProcessed: posts.length };
    } catch (error: any) {
      console.error(`Sync failed for target ${targetId}:`, error);
      Sentry.captureException(error);

      await db
        .update(viralityTargets)
        .set({
          sync_status: "failed",
          sync_error: error.message || "Unknown error",
          updated_at: new Date(),
        })
        .where(eq(viralityTargets.id, targetId));

      throw error;
    }
  }

  private async updateTargetProfile(
    targetId: number,
    profileData: Partial<InstagramProfile>
  ) {
    await db
      .update(viralityTargets)
      .set({
        display_name: profileData.fullName,
        avatar_url: profileData.profilePicUrl,
        bio: profileData.biography,
        follower_count: profileData.followersCount,
        following_count: profileData.followsCount,
        post_count: profileData.postsCount,
        is_verified: profileData.isVerified || false,
        updated_at: new Date(),
      })
      .where(eq(viralityTargets.id, targetId));
  }

  private async upsertPost(
    targetId: number,
    postData: Partial<InstagramPost>
  ) {
    if (!postData.id) return;

    const [existingPost] = await db
      .select()
      .from(viralityPosts)
      .where(
        and(
          eq(viralityPosts.target_id, targetId),
          eq(viralityPosts.platform_post_id, postData.id)
        )
      )
      .limit(1);

    const postValues = {
      target_id: targetId,
      platform_post_id: postData.id,
      post_url: postData.url || `https://www.instagram.com/p/${postData.shortCode}/`,
      thumbnail_url: postData.displayUrl,
      caption: postData.caption,
      hashtags: postData.hashtags || [],
      post_type: postData.type,
      posted_at: postData.timestamp ? new Date(postData.timestamp) : null,
      like_count: postData.likesCount || 0,
      comment_count: postData.commentsCount || 0,
      video_view_count: postData.videoViewCount,
      video_play_count: postData.videoPlayCount,
      updated_at: new Date(),
    };

    if (existingPost) {
      await db
        .update(viralityPosts)
        .set(postValues)
        .where(eq(viralityPosts.id, existingPost.id));
    } else {
      await db.insert(viralityPosts).values({
        ...postValues,
        created_at: new Date(),
      });
    }
  }

  async getPostsByTarget(
    targetId: number,
    teamId: number,
    limit: number = 20,
    offset: number = 0
  ) {
    // Verify ownership
    const target = await this.getTargetById(targetId);
    if (!target || target.team_id !== teamId) {
      throw new Error("Target not found or access denied");
    }

    return db
      .select()
      .from(viralityPosts)
      .where(eq(viralityPosts.target_id, targetId))
      .orderBy(desc(viralityPosts.posted_at))
      .limit(limit)
      .offset(offset);
  }

  async getDashboardStats(teamId: number) {
    const targets = await this.getTargetsByTeam(teamId);

    let totalFollowers = 0;
    let totalLikes = 0;
    let totalPosts = 0;

    for (const target of targets) {
      totalFollowers += target.follower_count || 0;
      totalLikes += target.total_likes || 0;
      totalPosts += target.post_count || 0;
    }

    return {
      targetsCount: targets.length,
      maxTargets: MAX_TARGETS_PER_TEAM,
      totalFollowers,
      totalLikes,
      totalPosts,
      targets,
    };
  }

  async checkTeamPlanAccess(teamId: number): Promise<boolean> {
    const [team] = await db
      .select({ plan: teams.plan })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) return false;

    // Studio+ plans only
    const allowedPlans = ["studio", "scale", "enterprise"];
    return allowedPlans.includes(team.plan);
  }
}

export const viralityService = new ViralityService();
