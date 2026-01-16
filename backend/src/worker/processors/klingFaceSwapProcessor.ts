import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import { db } from "../../db";
import {
  comfyJobs,
  teamMembers,
  clips,
  users,
} from "@clipper/shared-db/src/schema";
import { eq } from "drizzle-orm";
import { KlingFaceSwapJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { klingProMotionWithRetry } from "../../services/kling.service";
import {
  cutClip,
  mergeClipsGpu,
  extractFirstFrame,
} from "../../services/videoEditor.service";
import { ComfyJobUpdate } from "../../services/socket.service";
import { teamService } from "../../services/team.service";
import { emailNotiService } from "../../services/emailNoti.service";
import { transcribeVideoService } from "../../services/transcription.service";
import {
  convertWordsToCaptionEntries,
  generateSrtFromCaptions,
} from "../../services/captions.service";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";
const UGC_CREDIT_COST = 5;
const CHUNK_DURATION = 25;
const CHUNK_LEEWAY = 5;

interface SpliceSegmentInfo {
  s3Key: string;
  type: string;
  start: number;
  end: number;
}

async function emitJobUpdate(teamId: number, job: ComfyJobUpdate): Promise<void> {
  try {
    const response = await fetch(
      `${API_INTERNAL_URL}/internal/notify/comfy-job-update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": INTERNAL_API_KEY,
        },
        body: JSON.stringify({ teamId, job }),
      }
    );
    if (!response.ok) {
      console.error(`[kling-face-swap] Failed to emit job update: ${response.status}`);
    }
  } catch (err) {
    console.error(`[kling-face-swap] Error emitting job update:`, (err as Error).message);
  }
}

async function updateProgress(
  jobId: string,
  teamId: number,
  progress: number,
  message?: string
): Promise<void> {
  await db
    .update(comfyJobs)
    .set({
      progress,
      progressMessage: message || null,
    })
    .where(eq(comfyJobs.id, jobId));

  emitJobUpdate(teamId, {
    id: jobId,
    status: "running",
    progress,
    progressMessage: message || null,
    outputUrl: null,
    errorMessage: null,
    finishedAt: null,
  });
}

async function completeJob(
  jobId: string,
  teamId: number,
  success: boolean,
  outputFile?: string,
  outputUrl?: string,
  errorMessage?: string
): Promise<void> {
  const finishedAt = new Date();
  await db
    .update(comfyJobs)
    .set({
      status: success ? "completed" : "failed",
      progress: success ? 100 : null,
      progressMessage: success ? "Completed" : errorMessage || null,
      outputFile: outputFile || null,
      errorMessage: errorMessage || null,
      finishedAt,
    })
    .where(eq(comfyJobs.id, jobId));

  emitJobUpdate(teamId, {
    id: jobId,
    status: success ? "completed" : "failed",
    progress: success ? 100 : null,
    progressMessage: success ? "Completed" : errorMessage || null,
    outputUrl: outputUrl || null,
    errorMessage: errorMessage || null,
    finishedAt: finishedAt.toISOString(),
  });
}

function getChunkCount(duration: number): number {
  if (duration <= CHUNK_DURATION + CHUNK_LEEWAY) return 1;
  let count = 0;
  let start = 0;
  while (start < duration) {
    count++;
    const remaining = duration - start;
    if (remaining <= CHUNK_DURATION + CHUNK_LEEWAY) break;
    start += CHUNK_DURATION;
  }
  return count;
}

export async function processKlingFaceSwapJob(job: KlingFaceSwapJob): Promise<void> {
  const {
    jobId,
    teamId,
    userId,
    imageS3Key,
    chunkS3Keys,
    originalVideoS3Key,
    spliceMode,
    spliceMetadata,
  } = job;

  const outDir = path.join(process.cwd(), "output", `kling-swap-${Date.now()}`);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const localImagePath = path.join(outDir, `reference_${Date.now()}.jpg`);
  let spliceSegmentS3Keys: SpliceSegmentInfo[] = [];

  try {
    console.log(`[kling-face-swap] Starting job: ${jobId}`);

    // Update status to running
    await db
      .update(comfyJobs)
      .set({
        status: "running",
        progress: 5,
        progressMessage: "Starting Kling motion transfer",
        startedAt: new Date(),
      })
      .where(eq(comfyJobs.id, jobId));

    emitJobUpdate(teamId, {
      id: jobId,
      status: "running",
      progress: 5,
      progressMessage: "Starting Kling motion transfer",
      outputUrl: null,
      errorMessage: null,
      finishedAt: null,
    });

    // Download reference image
    await updateProgress(jobId, teamId, 10, "Downloading files from S3");
    await s3Service.downloadFile(imageS3Key, localImagePath);
    console.log(`[kling-face-swap] Downloaded reference image`);

    // Download all chunks
    const chunkLocalPaths: string[] = [];
    for (let i = 0; i < chunkS3Keys.length; i++) {
      const chunkPath = path.join(outDir, `chunk_${i}.mp4`);
      await s3Service.downloadFile(chunkS3Keys[i], chunkPath);
      if (fs.existsSync(chunkPath) && fs.statSync(chunkPath).size > 0) {
        chunkLocalPaths.push(chunkPath);
      } else {
        throw new Error(`Failed to download chunk ${i}`);
      }
    }
    console.log(`[kling-face-swap] Downloaded ${chunkLocalPaths.length} chunks`);

    await updateProgress(
      jobId,
      teamId,
      15,
      `Processing ${chunkLocalPaths.length} video segments with Kling`
    );

    // Get presigned URL for reference image (once for all chunks)
    const imageUrl = await s3Service.getPresignedUrl(imageS3Key, 3600);

    const processedChunkPaths: string[] = [];
    let goldenReferencePath: string | null = null;
    let currentImageUrl = imageUrl;

    // Process each chunk with Kling Pro Motion
    for (let i = 0; i < chunkLocalPaths.length; i++) {
      const chunkPath = chunkLocalPaths[i];
      console.log(`[kling-face-swap] Processing chunk ${i + 1}/${chunkLocalPaths.length}...`);

      // Upload chunk temporarily to get a presigned URL
      const tempChunkKey = `temp-kling/${teamId}/${jobId}/chunk_${i}_${Date.now()}.mp4`;
      await s3Service.uploadFile(chunkPath, tempChunkKey, "video/mp4");
      const chunkUrl = await s3Service.getPresignedUrl(tempChunkKey, 3600);

      // Call Kling Pro Motion API (with retry for network timeouts)
      const result = await klingProMotionWithRetry({
        imageUrl: currentImageUrl,
        videoUrl: chunkUrl,
        keepOriginalSound: true,
        characterOrientation: "video",
      });

      // Download processed video
      const processedPath = path.join(outDir, `processed_${i}.mp4`);
      await s3Service.downloadVideoFromUrl(result.videoUrl, processedPath);
      processedChunkPaths.push(processedPath);

      // Extract golden reference from first chunk for consistency
      if (i === 0 && chunkLocalPaths.length > 1) {
        goldenReferencePath = path.join(outDir, `golden_reference.jpg`);
        await extractFirstFrame(processedPath, goldenReferencePath);
        // Upload golden reference and get presigned URL for subsequent chunks
        const goldenRefKey = `temp-kling/${teamId}/${jobId}/golden_reference.jpg`;
        await s3Service.uploadFile(goldenReferencePath, goldenRefKey, "image/jpeg");
        currentImageUrl = await s3Service.getPresignedUrl(goldenRefKey, 3600);
        console.log(`[kling-face-swap] Extracted golden reference from chunk 1`);
      }

      // Clean up temp chunk from S3
      await s3Service.deleteObject(tempChunkKey).catch(() => {});

      const chunkProgress = Math.round(20 + ((i + 1) / chunkLocalPaths.length) * 60);
      await updateProgress(
        jobId,
        teamId,
        chunkProgress,
        `Processing: ${i + 1}/${chunkLocalPaths.length} segments complete`
      );
      console.log(`[kling-face-swap] Chunk ${i + 1} processed successfully`);
    }

    // Merge all processed chunks
    console.log(`[kling-face-swap] Stitching final video...`);
    await updateProgress(jobId, teamId, 85, "Stitching video segments");

    let finalOutputPath = path.join(outDir, `final_${Date.now()}.mp4`);
    await mergeClipsGpu(processedChunkPaths, finalOutputPath);
    console.log(`[kling-face-swap] Stitched ${processedChunkPaths.length} chunks`);

    // Handle splice mode if enabled
    if (spliceMode && spliceMetadata && originalVideoS3Key) {
      console.log(`[kling-face-swap] Splice mode enabled, assembling full video...`);
      await updateProgress(jobId, teamId, 90, "Assembling final video with splice");

      const originalPath = path.join(outDir, `original_${Date.now()}.mp4`);
      await s3Service.downloadFile(originalVideoS3Key, originalPath);
      console.log(`[kling-face-swap] Downloaded original video for splice`);

      const spliceSegmentPaths: string[] = [];
      let processedIndex = 0;

      for (let i = 0; i < spliceMetadata.segments.length; i++) {
        const seg = spliceMetadata.segments[i];
        const segPath = path.join(outDir, `splice_seg_${i}.mp4`);

        if (seg.type === "processed") {
          const duration = seg.end - seg.start;
          const numChunks = getChunkCount(duration);
          const chunksForSegment = processedChunkPaths.slice(
            processedIndex,
            processedIndex + numChunks
          );
          processedIndex += numChunks;

          console.log(
            `[kling-face-swap] Splice segment ${i}: PROCESSED ${seg.start}-${seg.end}s (${duration}s) using ${numChunks} chunks`
          );

          if (chunksForSegment.length === 1) {
            fs.copyFileSync(chunksForSegment[0], segPath);
          } else {
            await mergeClipsGpu(chunksForSegment, segPath);
          }
        } else {
          console.log(`[kling-face-swap] Splice segment ${i}: ORIGINAL ${seg.start}-${seg.end}s`);
          await cutClip(originalPath, segPath, seg.start, seg.end);
        }
        spliceSegmentPaths.push(segPath);

        // Upload segment to S3
        const segBuffer = fs.readFileSync(segPath);
        const segS3Key = `comfy-outputs/${teamId}/${jobId}/segment_${i}_${seg.type}.mp4`;
        await s3Service.uploadBuffer(segBuffer, segS3Key, "video/mp4");
        spliceSegmentS3Keys.push({
          s3Key: segS3Key,
          type: seg.type,
          start: seg.start,
          end: seg.end,
        });
        console.log(`[kling-face-swap] Uploaded segment ${i} to S3: ${segS3Key}`);
      }

      const splicedPath = path.join(outDir, `spliced_final_${Date.now()}.mp4`);
      await mergeClipsGpu(spliceSegmentPaths, splicedPath);
      finalOutputPath = splicedPath;
      console.log(`[kling-face-swap] Spliced ${spliceSegmentPaths.length} segments into full video`);

      // Update job with splice segment info
      await db
        .update(comfyJobs)
        .set({
          spliceMetadata: {
            ...spliceMetadata,
            processedSegments: spliceSegmentS3Keys,
          },
        })
        .where(eq(comfyJobs.id, jobId));
    }

    // Upload final video to S3
    console.log(`[kling-face-swap] Uploading final video to S3...`);
    await updateProgress(jobId, teamId, 95, "Uploading final video");

    const finalBuffer = fs.readFileSync(finalOutputPath);
    const s3Key = `comfy-outputs/${teamId}/${jobId}/final.mp4`;
    await s3Service.uploadBuffer(finalBuffer, s3Key, "video/mp4");

    // Complete the job
    const outputUrl = await s3Service.getPresignedUrl(s3Key, 3600);
    await completeJob(jobId, teamId, true, s3Key, outputUrl);

    console.log(`[kling-face-swap] Job ${jobId} completed successfully!`);

    // Create clip record and send notifications
    try {
      const [member] = await db
        .select({ userId: teamMembers.user_id })
        .from(teamMembers)
        .where(eq(teamMembers.team_id, teamId))
        .limit(1);

      if (member) {
        const clipMetadata: Record<string, unknown> = {
          type: "face-swap",
          comfyJobId: jobId,
        };
        if (spliceSegmentS3Keys.length > 0) {
          clipMetadata.spliceSegments = spliceSegmentS3Keys;
        }

        const [clip] = await db
          .insert(clips)
          .values({
            team_id: teamId,
            generated_by_user_id: member.userId,
            clip_path: s3Key,
            blank_video_path: s3Key,
            source_video_path: chunkS3Keys[0],
            status: "completed",
            saved: true,
            clip_metadata: clipMetadata,
            title: "UGC Face Swap",
          })
          .returning();
        console.log(`[kling-face-swap] Created clip ${clip.id} in library`);

        // Transcribe and add captions
        try {
          const tempDir = path.join(process.cwd(), "output", `transcribe-${Date.now()}`);
          fs.mkdirSync(tempDir, { recursive: true });
          const tempVideoPath = path.join(tempDir, "video.mp4");

          await s3Service.downloadFile(s3Key, tempVideoPath);
          const transcriptionData = await transcribeVideoService(tempVideoPath);
          const words = transcriptionData.results.channels[0].alternatives[0].words;
          const captionsData = convertWordsToCaptionEntries(words);
          const srtContent = generateSrtFromCaptions(captionsData);
          const srtPath = path.join(tempDir, `captions_${clip.id}.srt`);
          fs.writeFileSync(srtPath, srtContent);
          const srtS3Key = await s3Service.uploadSrtFile(srtPath, teamId, clip.id);

          await db
            .update(clips)
            .set({
              captions_data: captionsData,
              srt_path: srtS3Key,
            })
            .where(eq(clips.id, clip.id));

          fs.rmSync(tempDir, { recursive: true, force: true });
          console.log(`[kling-face-swap] Added captions to clip ${clip.id}`);
        } catch (transcribeErr) {
          console.error(`[kling-face-swap] Transcription failed:`, (transcribeErr as Error).message);
        }

        // Send UGC ready email notification
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, member.userId))
          .limit(1);

        if (user) {
          const frontendUrl = process.env.FRONTEND_URL || "https://platform.cuttr.com";
          await emailNotiService.sendUgcReady(user.email, {
            userName: user.first_name || "there",
            ugcUrl: `${frontendUrl}/dashboard/ugc-studio`,
          });
          console.log(`[kling-face-swap] Sent UGC ready email to ${user.email}`);
        }
      }
    } catch (clipErr) {
      console.error(`[kling-face-swap] Failed to create clip or notify:`, (clipErr as Error).message);
    }
  } catch (err) {
    console.error(`[kling-face-swap] Job failed:`, (err as Error).message);
    Sentry.captureException(err);

    await completeJob(jobId, teamId, false, undefined, undefined, (err as Error).message);

    // Refund credits on failure
    try {
      await teamService.decrementTeamUsage(teamId, UGC_CREDIT_COST);
      console.log(`[kling-face-swap] Refunded ${UGC_CREDIT_COST} credits to team ${teamId}`);
    } catch (refundErr) {
      console.error(`[kling-face-swap] Failed to refund credits:`, refundErr);
    }

    throw err;
  } finally {
    // Cleanup local files
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
      console.log(`[kling-face-swap] Cleaned up temp directory: ${outDir}`);
    }
  }
}
