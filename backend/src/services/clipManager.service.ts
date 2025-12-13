import { db } from "../db";
import { clips, clipFolders, uploadedRawVideos } from "@clipper/shared-db/src/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

export class ClipManagerService {
  // Create a raw video record
  async createRawVideo(data: {
    teamId: number;
    videoPath: string;
  }) {
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
  async updateClip(clipId: number, teamId: number, updates: {
    message?: string;
    clipScore?: number;
    folderId?: number | null;
  }) {
    const updateData: any = {
      updated_at: new Date(),
    };
    
    if (updates.message !== undefined) updateData.message = updates.message;
    if (updates.clipScore !== undefined) updateData.clip_score = updates.clipScore;
    if (updates.folderId !== undefined) updateData.folder_id = updates.folderId;

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
  }) {
    const [clip] = await db
      .insert(clips)
      .values({
        team_id: data.teamId,
        generated_by_user_id: data.userId,
        status: "pending",
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

  async updateClipComplete(clipId: number, teamId: number, data: {
    clipPath: string;
    sourceVideoPath: string;
    clipMetadata: any;
    inputMetadata?: any;
    prompt?: string;
    message?: string;
    clipScore?: number;
    rawVideoId?: number;
  }) {
    const [updatedClip] = await db
      .update(clips)
      .set({
        clip_path: data.clipPath,
        source_video_path: data.sourceVideoPath,
        clip_metadata: data.clipMetadata,
        input_metadata: data.inputMetadata,
        prompt: data.prompt,
        message: data.message,
        clip_score: data.clipScore,
        raw_video_id: data.rawVideoId,
        status: "completed",
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

