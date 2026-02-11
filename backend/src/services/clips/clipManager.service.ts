import { db } from "../../db";
import {
  clips,
  clipFolders,
  uploadedRawVideos,
  clipTags,
  tags,
} from "@clipper/shared-db/src/schema";
import { eq, and, desc, isNull, count, notInArray, or, sql, inArray, gte, lte } from "drizzle-orm";
import crypto from "crypto";

export class ClipManagerService {
  async getTeamClipsCount(teamId: number): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(clips)
      .where(
        and(
          eq(clips.team_id, teamId),
          notInArray(clips.status, ["failed", "rejected", "expired"])
        )
      );

    return result?.count || 0;
  }

  // Create a raw video record
  async createRawVideo(data: { teamId: number; videoPath: string }) {
    const [rawVideo] = await db
      .insert(uploadedRawVideos)
      .values({
        team_id: data.teamId,
        video_path: data.videoPath,
      })
      .returning();

    return rawVideo;
  }

  // Get all clips for a team
  async getClipsByTeam(teamId: number) {
    return await db
      .select()
      .from(clips)
      .where(eq(clips.team_id, teamId))
      .orderBy(desc(clips.created_at));
  }

  async getPendingClipsByTeam(teamId: number) {
    const results = await db
      .select({
        clip: clips,
        rawVideoPath: uploadedRawVideos.video_path,
      })
      .from(clips)
      .leftJoin(uploadedRawVideos, eq(clips.raw_video_id, uploadedRawVideos.id))
      .where(and(eq(clips.team_id, teamId), eq(clips.status, "pending")))
      .orderBy(desc(clips.created_at));

    return results.map((r) => ({
      ...r.clip,
      raw_video_path: r.rawVideoPath,
    }));
  }

  async getCompletedClipsByTeam(
    teamId: number,
    limit: number = 20,
    offset: number = 0
  ) {
    return await db
      .select()
      .from(clips)
      .where(and(eq(clips.team_id, teamId), eq(clips.status, "completed")))
      .orderBy(desc(clips.created_at))
      .limit(limit)
      .offset(offset);
  }

  // Get a single clip by ID
  async getClipById(clipId: number, teamId: number) {
    const [clip] = await db
      .select()
      .from(clips)
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .limit(1);

    if (!clip) {
      throw new Error("Clip not found");
    }

    return clip;
  }

  // Create a new clip record
  async createClip(data: {
    teamId: number;
    userId: number;
    clipPath: string;
    sourceVideoPath: string;
    clipMetadata: any;
    inputMetadata?: any;
    prompt?: string;
    message?: string;
    clipScore?: number;
    rawVideoId?: number;
  }) {
    const [clip] = await db
      .insert(clips)
      .values({
        team_id: data.teamId,
        generated_by_user_id: data.userId,
        clip_path: data.clipPath,
        source_video_path: data.sourceVideoPath,
        clip_metadata: data.clipMetadata,
        input_metadata: data.inputMetadata,
        prompt: data.prompt,
        message: data.message,
        clip_score: data.clipScore,
        raw_video_id: data.rawVideoId,
      })
      .returning();

    return clip;
  }

  // Update clip metadata
  async updateClip(
    clipId: number,
    teamId: number,
    updates: {
      title?: string;
      message?: string;
      clipScore?: number;
      folderId?: number | null;
      clipPath?: string;
      clipMetadata?: Record<string, any>;
    }
  ) {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.message !== undefined) updateData.message = updates.message;
    if (updates.clipScore !== undefined)
      updateData.clip_score = updates.clipScore;
    if (updates.folderId !== undefined) updateData.folder_id = updates.folderId;
    if (updates.clipPath !== undefined) updateData.clip_path = updates.clipPath;
    if (updates.clipMetadata !== undefined) updateData.clip_metadata = updates.clipMetadata;

    const [updatedClip] = await db
      .update(clips)
      .set(updateData)
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .returning();

    if (!updatedClip) {
      throw new Error("Clip not found");
    }

    return updatedClip;
  }

  // Get clips by folder
  async getClipsByFolder(teamId: number, folderId: number) {
    return await db
      .select()
      .from(clips)
      .where(and(eq(clips.team_id, teamId), eq(clips.folder_id, folderId)))
      .orderBy(desc(clips.updated_at));
  }

  // Get unorganized clips (no folder)
  async getUnorganizedClips(teamId: number) {
    return await db
      .select()
      .from(clips)
      .where(and(eq(clips.team_id, teamId), isNull(clips.folder_id)))
      .orderBy(desc(clips.updated_at));
  }

  // Delete a clip
  async deleteClip(clipId: number, teamId: number) {
    const [deletedClip] = await db
      .delete(clips)
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .returning();

    if (!deletedClip) {
      throw new Error("Clip not found");
    }

    return deletedClip;
  }

  async createPendingClip(data: {
    teamId: number;
    userId: number;
    rawVideoId?: number;
  }) {
    const [clip] = await db
      .insert(clips)
      .values({
        team_id: data.teamId,
        generated_by_user_id: data.userId,
        status: "pending",
        raw_video_id: data.rawVideoId,
      })
      .returning();

    return clip;
  }

  async updateClipStatus(
    clipId: number,
    teamId: number,
    status: string,
    errorMessage?: string
  ) {
    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const [updatedClip] = await db
      .update(clips)
      .set(updateData)
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .returning();

    if (!updatedClip) {
      throw new Error("Clip not found");
    }

    return updatedClip;
  }

  async updateClipComplete(
    clipId: number,
    teamId: number,
    data: {
      clipPath: string;
      blankVideoPath?: string;
      watermarkedClipPath?: string;
      srtPath?: string;
      captionsData?: any;
      sourceVideoPath: string;
      clipMetadata: any;
      inputMetadata?: any;
      prompt?: string;
      message?: string;
      clipScore?: number;
      title?: string;
    }
  ) {
    const [updatedClip] = await db
      .update(clips)
      .set({
        clip_path: data.clipPath,
        blank_video_path: data.blankVideoPath,
        watermarked_clip_path: data.watermarkedClipPath,
        srt_path: data.srtPath,
        captions_data: data.captionsData,
        source_video_path: data.sourceVideoPath,
        clip_metadata: data.clipMetadata,
        input_metadata: data.inputMetadata,
        prompt: data.prompt,
        message: data.message,
        clip_score: data.clipScore,
        status: "completed",
        updated_at: new Date(),
        title: data.title,
      })
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .returning();

    if (!updatedClip) {
      throw new Error("Clip not found");
    }

    return updatedClip;
  }

  async saveClip(clipId: number, teamId: number) {
    const [updatedClip] = await db
      .update(clips)
      .set({
        saved: true,
        updated_at: new Date(),
      })
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .returning();

    if (!updatedClip) {
      throw new Error("Clip not found");
    }

    return updatedClip;
  }

  async getUnsavedClipsByTeam(teamId: number) {
    return await db
      .select()
      .from(clips)
      .where(
        and(
          eq(clips.team_id, teamId),
          eq(clips.status, "completed"),
          eq(clips.saved, false)
        )
      )
      .orderBy(desc(clips.created_at));
  }

  async getSavedUnorganizedClips(
    teamId: number,
    limit: number = 20,
    offset: number = 0
  ) {
    return await db
      .select()
      .from(clips)
      .where(
        and(
          eq(clips.team_id, teamId),
          eq(clips.status, "completed"),
          eq(clips.saved, true),
          isNull(clips.folder_id)
        )
      )
      .orderBy(desc(clips.created_at))
      .limit(limit)
      .offset(offset);
  }

  async updateClipCaptions(
    clipId: number,
    teamId: number,
    data: {
      clipPath: string;
      captionsData: any;
    }
  ) {
    const [updatedClip] = await db
      .update(clips)
      .set({
        clip_path: data.clipPath,
        captions_data: data.captionsData,
        updated_at: new Date(),
      })
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .returning();

    if (!updatedClip) {
      throw new Error("Clip not found");
    }

    return updatedClip;
  }

  async rejectClip(clipId: number, teamId: number) {
    const [updatedClip] = await db
      .update(clips)
      .set({
        status: "rejected",
        updated_at: new Date(),
      })
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .returning();

    if (!updatedClip) {
      throw new Error("Clip not found");
    }

    return updatedClip;
  }

  // Generate a share token for a clip
  async generateShareToken(clipId: number, teamId: number) {
    const shareToken = crypto.randomBytes(32).toString("hex");

    const [updatedClip] = await db
      .update(clips)
      .set({
        share_token: shareToken,
        updated_at: new Date(),
      })
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .returning();

    if (!updatedClip) {
      throw new Error("Clip not found");
    }

    return updatedClip;
  }

  // Remove share token from a clip (disable sharing)
  async removeShareToken(clipId: number, teamId: number) {
    const [updatedClip] = await db
      .update(clips)
      .set({
        share_token: null,
        updated_at: new Date(),
      })
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .returning();

    if (!updatedClip) {
      throw new Error("Clip not found");
    }

    return updatedClip;
  }

  // Get a clip by its share token (public access, no team validation)
  async getClipByShareToken(shareToken: string) {
    const [clip] = await db
      .select()
      .from(clips)
      .where(eq(clips.share_token, shareToken))
      .limit(1);

    if (!clip) {
      throw new Error("Shared clip not found");
    }

    return clip;
  }

  // Search clips with fuzzy matching and filters
  async searchClips(params: {
    teamId: number;
    query?: string;
    tagIds?: number[];
    status?: string;
    folderId?: number | null;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }) {
    const {
      teamId,
      query,
      tagIds,
      status,
      folderId,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0,
    } = params;

    const conditions: any[] = [eq(clips.team_id, teamId)];

    // Status filter - cast to enum type
    if (status) {
      conditions.push(eq(clips.status, status as "pending" | "completed" | "failed" | "rejected" | "expired"));
    }

    // Folder filter (folderId === null means unorganized)
    if (folderId !== undefined) {
      if (folderId === null) {
        conditions.push(isNull(clips.folder_id));
      } else {
        conditions.push(eq(clips.folder_id, folderId));
      }
    }

    // Date range filters
    if (dateFrom) {
      conditions.push(gte(clips.created_at, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(clips.created_at, dateTo));
    }

    // Tag filter - clips must have ALL specified tags (AND logic)
    if (tagIds && tagIds.length > 0) {
      const tagSubquery = sql`(
        SELECT COUNT(DISTINCT ct.tag_id)::int
        FROM clip_tags ct
        WHERE ct.clip_id = ${clips.id}
        AND ct.tag_id = ANY(${tagIds})
      ) = ${tagIds.length}`;
      conditions.push(tagSubquery);
    }

    // Fuzzy search on title and message using pg_trgm
    const minSimilarity = 0.15;
    const searchTerm = query?.trim() || "";
    let selectFields: any = { clip: clips };

    if (searchTerm) {
      const searchCondition = or(
        sql`similarity(${clips.title}, ${searchTerm}) >= ${minSimilarity}`,
        sql`similarity(${clips.message}, ${searchTerm}) >= ${minSimilarity}`,
        sql`${clips.title} ILIKE ${'%' + searchTerm + '%'}`,
        sql`${clips.message} ILIKE ${'%' + searchTerm + '%'}`
      );
      conditions.push(searchCondition);

      selectFields.similarity_score = sql`GREATEST(
        COALESCE(similarity(${clips.title}, ${searchTerm}), 0),
        COALESCE(similarity(${clips.message}, ${searchTerm}), 0)
      )`.as('similarity_score');
    }

    // Build final where clause
    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(clips)
      .where(whereClause);
    const total = countResult?.count || 0;

    // Determine ordering
    const orderByClause = searchTerm
      ? [
          sql`GREATEST(
            COALESCE(similarity(${clips.title}, ${searchTerm}), 0),
            COALESCE(similarity(${clips.message}, ${searchTerm}), 0)
          ) DESC`,
          desc(clips.updated_at),
        ]
      : [desc(clips.updated_at)];

    // Get paginated results
    const results = await db
      .select(selectFields)
      .from(clips)
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(limit)
      .offset(offset);

    return {
      clips: results.map((r: any) => ({
        ...r.clip,
        similarity_score: r.similarity_score ?? null,
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + results.length < total,
      },
    };
  }
}

export const clipManagerService = new ClipManagerService();
