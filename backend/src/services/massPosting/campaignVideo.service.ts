import {
  campaigns,
  campaignVideos,
  clips,
  tags,
  clipTags,
} from "@clipper/shared-db";
import { db } from "../../db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { s3Service } from "../s3.service";
import { sanitizeFileName } from "../../utils/fileUtils";

class CampaignVideoService {
  async addClipsFromLibrary(
    campaignId: number,
    teamId: number,
    clipIds: number[],
  ) {
    if (!clipIds.length) return [];

    // Validate clip ownership
    const ownedClips = await db
      .select({ id: clips.id })
      .from(clips)
      .where(
        and(eq(clips.team_id, teamId), inArray(clips.id, clipIds)),
      );

    const ownedIds = new Set(ownedClips.map((c) => c.id));
    const invalidIds = clipIds.filter((id) => !ownedIds.has(id));
    if (invalidIds.length > 0) {
      throw new Error(`Clips not found or not owned: ${invalidIds.join(", ")}`);
    }

    // Filter out clips already in this campaign
    const existing = await db
      .select({ clip_id: campaignVideos.clip_id })
      .from(campaignVideos)
      .where(
        and(
          eq(campaignVideos.campaign_id, campaignId),
          inArray(campaignVideos.clip_id, clipIds),
        ),
      );
    const existingIds = new Set(existing.map((r) => r.clip_id));
    const newClipIds = clipIds.filter((id) => !existingIds.has(id));

    if (newClipIds.length === 0) return [];

    // Bulk insert
    const values = newClipIds.map((clipId) => ({
      campaign_id: campaignId,
      clip_id: clipId,
    }));

    const rows = await db
      .insert(campaignVideos)
      .values(values)
      .returning();

    // Re-check video gate
    await this.checkVideoGate(campaignId);

    return rows;
  }

  async createCustomUpload(
    campaignId: number,
    teamId: number,
    fileName: string,
    contentType: string,
  ) {
    const sanitized = sanitizeFileName(fileName);
    const s3Key = `campaign-videos/${teamId}/${campaignId}/${Date.now()}_${sanitized}`;

    const uploadUrl = await s3Service.getPresignedUploadUrlForKey(
      s3Key,
      contentType,
    );

    const [video] = await db
      .insert(campaignVideos)
      .values({
        campaign_id: campaignId,
        custom_video_key: s3Key,
        custom_video_name: fileName,
      })
      .returning();

    return { video, uploadUrl, s3Key };
  }

  async completeCustomUpload(
    campaignId: number,
    videoId: number,
    teamId: number,
    userId: number,
  ) {
    const [video] = await db
      .select()
      .from(campaignVideos)
      .where(
        and(
          eq(campaignVideos.id, videoId),
          eq(campaignVideos.campaign_id, campaignId),
        ),
      )
      .limit(1);

    if (!video) {
      throw new Error("Video not found");
    }

    // Create a clip in the library so the upload shows in My Clips
    if (video.custom_video_key) {
      try {
        const title = (video.custom_video_name || "Campaign Upload").replace(
          /\.[^.]+$/,
          "",
        );

        const [clip] = await db
          .insert(clips)
          .values({
            team_id: teamId,
            generated_by_user_id: userId,
            clip_path: video.custom_video_key,
            title,
            status: "completed",
            saved: true,
            input_metadata: { source: "campaign_upload" },
          })
          .returning();

        // Link the campaign video to the new clip
        await db
          .update(campaignVideos)
          .set({ clip_id: clip.id })
          .where(eq(campaignVideos.id, videoId));

        // Auto-tag with "Campaign Upload"
        await this.ensureCampaignUploadTag(teamId, clip.id);
      } catch (err) {
        console.error("[CampaignVideo] Failed to create library clip:", err);
      }
    }

    // Re-check video gate after upload completes
    await this.checkVideoGate(campaignId);

    return video;
  }

  /** Find or create the "Campaign Upload" tag and assign it to a clip */
  private async ensureCampaignUploadTag(teamId: number, clipId: number) {
    const TAG_NAME = "Campaign Upload";
    const TAG_COLOR = "#f59e0b"; // amber

    let [tag] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.team_id, teamId), eq(tags.name, TAG_NAME)))
      .limit(1);

    if (!tag) {
      [tag] = await db
        .insert(tags)
        .values({ team_id: teamId, name: TAG_NAME, color: TAG_COLOR })
        .returning();
    }

    await db
      .insert(clipTags)
      .values({ clip_id: clipId, tag_id: tag.id });
  }

  async removeVideo(campaignId: number, videoId: number) {
    const [video] = await db
      .select()
      .from(campaignVideos)
      .where(
        and(
          eq(campaignVideos.id, videoId),
          eq(campaignVideos.campaign_id, campaignId),
        ),
      )
      .limit(1);

    if (!video) {
      throw new Error("Video not found");
    }

    await db
      .delete(campaignVideos)
      .where(eq(campaignVideos.id, videoId));

    // Clean up S3 if it was a custom upload
    if (video.custom_video_key) {
      try {
        await s3Service.deleteObject(video.custom_video_key);
      } catch (err) {
        console.error(`[CampaignVideo] Failed to delete S3 object:`, err);
      }
    }

    // Re-check video gate
    await this.checkVideoGate(campaignId);

    return { deleted: true };
  }

  async listVideos(campaignId: number) {
    const rows = await db
      .select({
        id: campaignVideos.id,
        campaign_id: campaignVideos.campaign_id,
        clip_id: campaignVideos.clip_id,
        custom_video_key: campaignVideos.custom_video_key,
        custom_video_name: campaignVideos.custom_video_name,
        duration_seconds: campaignVideos.duration_seconds,
        created_at: campaignVideos.created_at,
        // Join clip data when available
        clip_path: clips.clip_path,
        clip_title: clips.title,
      })
      .from(campaignVideos)
      .leftJoin(clips, eq(campaignVideos.clip_id, clips.id))
      .where(eq(campaignVideos.campaign_id, campaignId));

    // Generate presigned URLs
    const videosWithUrls = await Promise.all(
      rows.map(async (row) => {
        let videoUrl: string | null = null;
        const key = row.custom_video_key || row.clip_path;
        if (key) {
          try {
            videoUrl = await s3Service.getPresignedUrl(key);
          } catch {}
        }
        return {
          id: row.id,
          campaign_id: row.campaign_id,
          clip_id: row.clip_id,
          file_name: row.custom_video_name,
          title: row.clip_title || row.custom_video_name,
          duration_seconds: row.duration_seconds,
          presigned_url: videoUrl,
          status: "ready" as const,
          created_at: row.created_at,
        };
      }),
    );

    return videosWithUrls;
  }

  async checkVideoGate(campaignId: number): Promise<boolean> {
    const [campaign] = await db
      .select({ video_minimum: campaigns.video_minimum })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) return false;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignVideos)
      .where(eq(campaignVideos.campaign_id, campaignId));

    const ready = count >= (campaign.video_minimum ?? 0);

    await db
      .update(campaigns)
      .set({ videos_ready: ready, updated_at: new Date() })
      .where(eq(campaigns.id, campaignId));

    return ready;
  }

  async getClipIdsForCampaign(campaignId: number): Promise<number[]> {
    const rows = await db
      .select({ clip_id: campaignVideos.clip_id })
      .from(campaignVideos)
      .where(
        and(
          eq(campaignVideos.campaign_id, campaignId),
          sql`${campaignVideos.clip_id} IS NOT NULL`,
        ),
      );
    return rows.map((r) => r.clip_id!);
  }

  async getClipIdsInCampaigns(teamId: number): Promise<{
    clipIds: number[];
    campaignClipMap: Record<number, number[]>;
  }> {
    const rows = await db
      .select({
        clip_id: campaignVideos.clip_id,
        campaign_id: campaignVideos.campaign_id,
      })
      .from(campaignVideos)
      .innerJoin(campaigns, eq(campaigns.id, campaignVideos.campaign_id))
      .where(and(eq(campaigns.team_id, teamId), sql`${campaignVideos.clip_id} IS NOT NULL`));

    const clipIdSet = new Set<number>();
    const campaignClipMap: Record<number, number[]> = {};

    for (const row of rows) {
      clipIdSet.add(row.clip_id!);
      if (!campaignClipMap[row.campaign_id]) {
        campaignClipMap[row.campaign_id] = [];
      }
      campaignClipMap[row.campaign_id].push(row.clip_id!);
    }

    return { clipIds: Array.from(clipIdSet), campaignClipMap };
  }
}

export const campaignVideoService = new CampaignVideoService();
