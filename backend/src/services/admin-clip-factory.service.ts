import { db } from "../db";
import { teamMembers, uploadedRawVideos, clips } from "@clipper/shared-db/src/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
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
    const jobs: { rawVideoPublicIds: string[]; fileName: string; clipIds: number[] }[] = [];
    let totalClipsQueued = 0;

    for (const video of videos) {
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
        });

        allClipIds.push(clip.id);
        allPublicIds.push(rawVideo.public_id);
      }

      jobs.push({
        rawVideoPublicIds: allPublicIds,
        fileName: video.originalFileName,
        clipIds: allClipIds,
      });
      totalClipsQueued += allClipIds.length;
    }

    return { jobs, totalClipsQueued };
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
