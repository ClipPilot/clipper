import { db } from "../db";
import { teamMembers, uploadedRawVideos, clips, clipFactoryBatches } from "@clipper/shared-db/src/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { clipManagerService } from "./clips/clipManager.service";
import { s3Service } from "./s3.service";
import { sqsService } from "./sqs.service";
import type { ClipVideoJob } from "./sqs.service";

class AdminClipFactoryService {
  async getTeamOwnerUserId(teamId: number): Promise<number> {
    const [owner] = await db
      .select({ userId: teamMembers.user_id })
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, "owner")))
      .limit(1);

    if (!owner) {
      throw new Error(`No owner found for team ${teamId}`);
    }

    return owner.userId;
  }

  async getPresignedUploadUrl(teamId: number, fileName: string, contentType: string) {
    return s3Service.getPresignedUploadUrl(teamId, fileName, contentType, 3600);
  }

  async initiateMultipartUpload(teamId: number, fileName: string, contentType: string, fileSize: number) {
    const CHUNK_SIZE = 10 * 1024 * 1024;
    const { uploadId, s3Key } = await s3Service.initiateMultipartUpload(teamId, fileName, contentType);
    const totalParts = Math.ceil(fileSize / CHUNK_SIZE);
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
    const partUrls = await s3Service.getPresignedPartUrls(s3Key, uploadId, partNumbers);

    return { uploadId, s3Key, chunkSize: CHUNK_SIZE, totalParts, partUrls };
  }

  async completeMultipartUpload(s3Key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
    await s3Service.completeMultipartUpload(s3Key, uploadId, parts);
    return { success: true, s3Key };
  }

  async startClipJobs(
    teamId: number,
    userId: number,
    videos: { s3Key: string; originalFileName: string; fileSize?: number }[],
    options: ClipVideoJob["options"],
    loops: number = 1
  ) {
    const [batch] = await db
      .insert(clipFactoryBatches)
      .values({
        team_id: teamId,
        user_id: userId,
        videos,
        options,
        loops,
        current_index: 0,
        status: "processing",
        current_clip_ids: [],
        completed_jobs: [],
      })
      .returning();

    const firstVideoJobs = await this.queueVideoAtIndex(batch.id, teamId, userId, videos, options, loops, 0);

    await db
      .update(clipFactoryBatches)
      .set({
        current_clip_ids: firstVideoJobs.clipIds,
        updated_at: new Date(),
      })
      .where(eq(clipFactoryBatches.id, batch.id));

    return { batchId: batch.id, firstVideo: firstVideoJobs };
  }

  private async queueVideoAtIndex(
    batchId: number,
    teamId: number,
    userId: number,
    videos: { s3Key: string; originalFileName: string; fileSize?: number }[],
    options: ClipVideoJob["options"],
    loops: number,
    index: number
  ) {
    const video = videos[index];
    const allClipIds: number[] = [];
    const allPublicIds: string[] = [];

    for (let loop = 0; loop < loops; loop++) {
      const rawVideo = await clipManagerService.createRawVideo({
        teamId,
        videoPath: video.s3Key,
      });

      const clip = await clipManagerService.createPendingClip({
        teamId,
        userId,
        rawVideoId: rawVideo.id,
        saved: true,
      });

      await sqsService.sendClipVideoJob({
        clipIds: [clip.id],
        teamId,
        userId,
        s3Key: video.s3Key,
        options: { ...options, numberOfVideos: 1 },
        originalFileName: video.originalFileName,
        fileSize: video.fileSize,
        clipFactoryBatchId: batchId,
      });

      allClipIds.push(clip.id);
      allPublicIds.push(rawVideo.public_id);
    }

    return {
      rawVideoPublicIds: allPublicIds,
      fileName: video.originalFileName,
      clipIds: allClipIds,
    };
  }

  async advanceBatchIfReady(batchId: number) {
    const [batch] = await db
      .select()
      .from(clipFactoryBatches)
      .where(eq(clipFactoryBatches.id, batchId))
      .limit(1);

    if (!batch || batch.status !== "processing") return;

    const currentClipIds = batch.current_clip_ids as number[];
    if (currentClipIds.length === 0) return;

    const clipRows = await db
      .select({ id: clips.id, status: clips.status })
      .from(clips)
      .where(inArray(clips.id, currentClipIds));

    const allDone = clipRows.length === currentClipIds.length &&
      clipRows.every((c) => c.status === "completed" || c.status === "failed");

    if (!allDone) return;

    const videos = batch.videos as { s3Key: string; originalFileName: string; fileSize?: number }[];
    const options = batch.options as ClipVideoJob["options"];
    const completedJobs = batch.completed_jobs as { rawVideoPublicIds: string[]; fileName: string; clipIds: number[] }[];

    const currentVideoPublicIds = await this.getPublicIdsForClips(currentClipIds);
    completedJobs.push({
      rawVideoPublicIds: currentVideoPublicIds,
      fileName: videos[batch.current_index].originalFileName,
      clipIds: currentClipIds,
    });

    const nextIndex = batch.current_index + 1;

    if (nextIndex >= videos.length) {
      await db
        .update(clipFactoryBatches)
        .set({
          status: "completed",
          current_index: nextIndex,
          current_clip_ids: [],
          completed_jobs: completedJobs,
          updated_at: new Date(),
        })
        .where(and(eq(clipFactoryBatches.id, batchId), eq(clipFactoryBatches.current_index, batch.current_index)));

      console.log(`[ClipFactory] Batch ${batchId} completed (${videos.length} videos)`);
      return;
    }

    const nextVideoJobs = await this.queueVideoAtIndex(
      batchId, batch.team_id, batch.user_id, videos, options, batch.loops, nextIndex
    );

    const updated = await db
      .update(clipFactoryBatches)
      .set({
        current_index: nextIndex,
        current_clip_ids: nextVideoJobs.clipIds,
        completed_jobs: completedJobs,
        updated_at: new Date(),
      })
      .where(and(eq(clipFactoryBatches.id, batchId), eq(clipFactoryBatches.current_index, batch.current_index)))
      .returning();

    if (updated.length === 0) {
      console.log(`[ClipFactory] Batch ${batchId} advance skipped (concurrent update)`);
      return;
    }

    console.log(`[ClipFactory] Batch ${batchId} advanced to video ${nextIndex + 1}/${videos.length}`);
  }

  private async getPublicIdsForClips(clipIds: number[]): Promise<string[]> {
    const rows = await db
      .select({ publicId: uploadedRawVideos.public_id })
      .from(clips)
      .innerJoin(uploadedRawVideos, eq(clips.raw_video_id, uploadedRawVideos.id))
      .where(inArray(clips.id, clipIds));

    return [...new Set(rows.map((r) => r.publicId))];
  }

  async getBatchStatus(batchId: number) {
    const [batch] = await db
      .select()
      .from(clipFactoryBatches)
      .where(eq(clipFactoryBatches.id, batchId))
      .limit(1);

    if (!batch) throw new Error("Batch not found");

    const completedJobs = batch.completed_jobs as { rawVideoPublicIds: string[]; fileName: string; clipIds: number[] }[];
    const currentClipIds = batch.current_clip_ids as number[];
    const videos = batch.videos as { s3Key: string; originalFileName: string; fileSize?: number }[];

    const allClipIds = [
      ...completedJobs.flatMap((j) => j.clipIds),
      ...currentClipIds,
    ];
    const allPublicIds = [
      ...completedJobs.flatMap((j) => j.rawVideoPublicIds),
      ...(currentClipIds.length > 0 ? await this.getPublicIdsForClips(currentClipIds) : []),
    ];

    let totalCompleted = 0;
    let totalFailed = 0;
    let totalPending = 0;

    const videoResults: {
      rawVideoPublicId: string;
      status: string;
      clips: { clipId: number; status: string; title: string | null; downloadUrl: string | null; errorMessage: string | null }[];
    }[] = [];

    for (const publicId of allPublicIds) {
      const clipRows = await clipManagerService.getClipsByPublicId(publicId, batch.team_id);

      const clipsData = await Promise.all(
        clipRows.map(async (clip) => {
          let downloadUrl: string | null = null;
          if (clip.status === "completed" && clip.clip_path) {
            downloadUrl = await s3Service.getPresignedUrl(clip.clip_path, 604800);
          }

          if (clip.status === "completed") totalCompleted++;
          else if (clip.status === "failed") totalFailed++;
          else totalPending++;

          return {
            clipId: clip.id,
            status: clip.status,
            title: clip.title,
            downloadUrl,
            errorMessage: clip.error_message,
          };
        })
      );

      const videoStatus = clipsData.every((c) => c.status === "completed")
        ? "completed"
        : clipsData.every((c) => c.status === "failed")
          ? "failed"
          : "processing";

      videoResults.push({ rawVideoPublicId: publicId, status: videoStatus, clips: clipsData });
    }

    const remainingCount = videos.length - batch.current_index - (batch.status === "completed" ? 0 : 1);
    const total = totalCompleted + totalFailed + totalPending;

    const overallStatus = batch.status === "completed"
      ? (totalFailed === 0 ? "completed" : "partial")
      : "processing";

    return {
      batchId: batch.id,
      status: overallStatus,
      videos: videoResults,
      progress: {
        total: total + (remainingCount * batch.loops),
        completed: totalCompleted,
        failed: totalFailed,
        pending: totalPending + (remainingCount * batch.loops),
      },
      videoProgress: {
        total: videos.length,
        completed: completedJobs.length,
        current: batch.status === "completed" ? null : batch.current_index,
      },
    };
  }

  async getJobStatuses(rawVideoPublicIds: string[], teamId: number) {
    const videos: {
      rawVideoPublicId: string;
      status: string;
      clips: { clipId: number; status: string; title: string | null; downloadUrl: string | null; errorMessage: string | null }[];
    }[] = [];

    let totalCompleted = 0;
    let totalFailed = 0;
    let totalPending = 0;

    for (const publicId of rawVideoPublicIds) {
      const clipRows = await clipManagerService.getClipsByPublicId(publicId, teamId);

      const clipsData = await Promise.all(
        clipRows.map(async (clip) => {
          let downloadUrl: string | null = null;
          if (clip.status === "completed" && clip.clip_path) {
            downloadUrl = await s3Service.getPresignedUrl(clip.clip_path, 604800);
          }

          if (clip.status === "completed") totalCompleted++;
          else if (clip.status === "failed") totalFailed++;
          else totalPending++;

          return {
            clipId: clip.id,
            status: clip.status,
            title: clip.title,
            downloadUrl,
            errorMessage: clip.error_message,
          };
        })
      );

      const videoStatus = clipsData.every((c) => c.status === "completed")
        ? "completed"
        : clipsData.every((c) => c.status === "failed")
          ? "failed"
          : "processing";

      videos.push({ rawVideoPublicId: publicId, status: videoStatus, clips: clipsData });
    }

    const total = totalCompleted + totalFailed + totalPending;
    const overallStatus =
      totalPending === 0 && totalFailed === 0
        ? "completed"
        : totalPending === 0 && totalCompleted > 0
          ? "partial"
          : totalPending === 0
            ? "failed"
            : "processing";

    return {
      status: overallStatus,
      videos,
      progress: { total, completed: totalCompleted, failed: totalFailed, pending: totalPending },
    };
  }

  async getActiveJobs(teamId: number) {
    const pendingClipRows = await db
      .select({
        clipId: clips.id,
        clipStatus: clips.status,
        clipTitle: clips.title,
        clipPath: clips.clip_path,
        errorMessage: clips.error_message,
        rawVideoId: uploadedRawVideos.id,
        rawVideoPublicId: uploadedRawVideos.public_id,
        rawVideoPath: uploadedRawVideos.video_path,
        createdAt: clips.created_at,
      })
      .from(clips)
      .innerJoin(uploadedRawVideos, eq(clips.raw_video_id, uploadedRawVideos.id))
      .where(
        and(
          eq(clips.team_id, teamId),
          inArray(clips.status, ["pending"]),
          eq(clips.saved, true)
        )
      )
      .orderBy(desc(clips.created_at))
      .limit(500);

    const grouped = new Map<string, {
      rawVideoPublicId: string;
      fileName: string;
      clips: { clipId: number; status: string; title: string | null }[];
    }>();

    for (const row of pendingClipRows) {
      const fileName = row.rawVideoPath.split("/").pop() || row.rawVideoPath;
      const existing = grouped.get(fileName);
      const clipData = { clipId: row.clipId, status: row.clipStatus, title: row.clipTitle };

      if (existing) {
        existing.clips.push(clipData);
      } else {
        grouped.set(fileName, {
          rawVideoPublicId: row.rawVideoPublicId,
          fileName,
          clips: [clipData],
        });
      }
    }

    return Array.from(grouped.values());
  }
}

export const adminClipFactoryService = new AdminClipFactoryService();
