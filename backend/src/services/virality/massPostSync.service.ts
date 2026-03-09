import { db } from "../../db";
import { userPosts, userAccounts } from "@clipper/shared-db/src/schema";
import { eq, and, gt, isNotNull, sql } from "drizzle-orm";
import { getApifyService } from "./apify.service";
import { MAX_METRICS_HISTORY } from "../../config/virality";

const CONCURRENCY = 5;

interface MetricsEntry {
  recorded_at: string;
  likes: number;
  comments: number;
  views: number | null;
}

export async function syncMassPostAnalytics(teamId?: number): Promise<{ synced: number; skipped: number }> {
  const conditions = [
    isNotNull(userPosts.mass_post_id),
    gt(userPosts.syncs_remaining, 0),
  ];
  if (teamId) {
    conditions.push(eq(userAccounts.team_id, teamId));
  }

  const postsToSync = await db
    .select({
      id: userPosts.id,
      post_url: userPosts.post_url,
      syncs_remaining: userPosts.syncs_remaining,
      metrics_history: userPosts.metrics_history,
      platform: userAccounts.platform,
    })
    .from(userPosts)
    .innerJoin(userAccounts, eq(userPosts.account_id, userAccounts.id))
    .where(and(...conditions));

  let synced = 0;
  let skipped = 0;

  for (let i = 0; i < postsToSync.length; i += CONCURRENCY) {
    const batch = postsToSync.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (post) => {
        try {
          const apify = getApifyService();
          const metrics = await apify.scrapePostMetrics(post.post_url, post.platform);
          if (!metrics) {
            skipped++;
            return;
          }

          const history: MetricsEntry[] = Array.isArray(post.metrics_history)
            ? [...(post.metrics_history as MetricsEntry[])]
            : [];

          history.push({
            recorded_at: new Date().toISOString(),
            likes: metrics.likesCount,
            comments: metrics.commentsCount,
            views: metrics.viewCount,
          });

          const trimmed = history.length > MAX_METRICS_HISTORY
            ? history.slice(-MAX_METRICS_HISTORY)
            : history;

          await db
            .update(userPosts)
            .set({
              like_count: metrics.likesCount,
              comment_count: metrics.commentsCount,
              video_play_count: metrics.viewCount,
              thumbnail_url: metrics.thumbnailUrl,
              metrics_history: trimmed,
              syncs_remaining: sql`${userPosts.syncs_remaining} - 1`,
              updated_at: new Date(),
            })
            .where(eq(userPosts.id, post.id));

          synced++;
        } catch (err) {
          console.error(`[MassPostSync] Failed to sync post ${post.id}:`, err);
          skipped++;
        }
      })
    );
  }

  console.log(`[MassPostSync] Done: synced=${synced}, skipped=${skipped}`);
  return { synced, skipped };
}
