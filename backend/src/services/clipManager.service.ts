import { db } from "../db";
import {
  clips,
  clipFolders,
  uploadedRawVideos,
} from "@clipper/shared-db/src/schema";
import { eq, and, desc, isNull, count } from "drizzle-orm";

export class ClipManagerService {
  async getTeamClipsCount(teamId: number): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(clips)
      .where(eq(clips.team_id, teamId));

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
      message?: string;
      clipScore?: number;
      folderId?: number | null;
      clipPath?: string;
    }
  ) {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (updates.message !== undefined) updateData.message = updates.message;
    if (updates.clipScore !== undefined)
      updateData.clip_score = updates.clipScore;
    if (updates.folderId !== undefined) updateData.folder_id = updates.folderId;
    if (updates.clipPath !== undefined) updateData.clip_path = updates.clipPath;

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
}

export const clipManagerService = new ClipManagerService();
