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
import {
  klingProMotionWithRetry,
  PRO_MOTION_PROMPT,
} from "../../services/ai-ugc/kling.service";
import {
  cutClip,
  mergeClipsGpu,
  extractFirstFrame,
  extractAudio,
  replaceAudioInVideo,
  getVideoDuration,
} from "../../services/clips/videoEditor.service";
import { speechToSpeech } from "../../services/ai-ugc/elevenlabs.service";
import { ComfyJobUpdate } from "../../services/socket.service";
import { teamService } from "../../services/team.service";
import { emailNotiService } from "../../services/emailNoti.service";
import { transcribeVideoService } from "../../services/clips/transcription.service";
import {
  convertWordsToCaptionEntries,
  generateSrtFromCaptions,
} from "../../services/clips/captions.service";
import { falImageService } from "../../services/ai-ugc/falImage.service";
import { POSE_GENERATION_PROMPT } from "../../config/ugcPrompts";

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL || "http://localhost:3001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";
const UGC_CREDIT_COST = 5;
const MAX_CHUNK_DURATION = 10; // Kling Pro Motion with characterOrientation='image' has 10s max
const MIN_CHUNK_DURATION = 3;  // Kling requires minimum 3 seconds

/**
 * Calculate chunk durations ensuring each chunk is between MIN and MAX duration.
 * For a 32s segment: returns [10, 10, 9, 3] instead of [10, 10, 10, 2]
 */
function calculateChunkDurations(totalDuration: number): number[] {
  // If segment fits in one chunk, return as-is
  if (totalDuration <= MAX_CHUNK_DURATION) {
    return [totalDuration];
  }

  const numFullChunks = Math.floor(totalDuration / MAX_CHUNK_DURATION);
  const remainder = totalDuration - (numFullChunks * MAX_CHUNK_DURATION);

  // Perfect division - no remainder
  if (remainder === 0) {
    return Array(numFullChunks).fill(MAX_CHUNK_DURATION);
  }

  // Remainder is large enough to be its own chunk (>= 3s)
  if (remainder >= MIN_CHUNK_DURATION) {
    return [...Array(numFullChunks).fill(MAX_CHUNK_DURATION), remainder];
  }

  // Remainder is too small (< 3s) - borrow from the last full chunk
  // This makes the second-to-last chunk shorter so the last chunk can be >= 3s
  const needed = MIN_CHUNK_DURATION - remainder;
  const lastFullChunkDuration = MAX_CHUNK_DURATION - needed;
  const finalChunkDuration = remainder + needed; // = MIN_CHUNK_DURATION

  if (numFullChunks === 1) {
    return [lastFullChunkDuration, finalChunkDuration];
  }

  return [
    ...Array(numFullChunks - 1).fill(MAX_CHUNK_DURATION),
    lastFullChunkDuration,
    finalChunkDuration,
  ];
}

interface SpliceSegmentInfo {
  s3Key: string;
  type: string;
  start: number;
  end: number;
}

interface SpliceMetadataSegment {
  start: number;
  end: number;
  type: "processed" | "original";
  chunkCount?: number;
}

async function emitJobUpdate(
  teamId: number,
  job: ComfyJobUpdate,
): Promise<void> {
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
      },
    );
    if (!response.ok) {
      console.error(
        `[kling-face-swap] Failed to emit job update: ${response.status}`,
      );
    }
  } catch (err) {
    console.error(
      `[kling-face-swap] Error emitting job update:`,
      (err as Error).message,
    );
  }
}

async function updateProgress(
  jobId: string,
  teamId: number,
  progress: number,
  message?: string,
): Promise<void> {
  try {
    await db
      .update(comfyJobs)
      .set({
        progress,
        progressMessage: message || null,
      })
      .where(eq(comfyJobs.id, jobId));
  } catch (err) {
    console.warn(`[kling-face-swap] Progress update failed (non-fatal): ${(err as Error).message}`);
  }

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
  errorMessage?: string,
): Promise<void> {
  const finishedAt = new Date();
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
      break;
    } catch (err) {
      console.warn(`[kling-face-swap] completeJob DB update failed (attempt ${attempt}/${maxRetries}): ${(err as Error).message}`);
      if (attempt === maxRetries) {
        console.error(`[kling-face-swap] completeJob failed after ${maxRetries} attempts`);
      } else {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

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
  return calculateChunkDurations(duration).length;
}

export async function processKlingFaceSwapJob(
  job: KlingFaceSwapJob,
): Promise<void> {
  const {
    jobId,
    teamId,
    userId,
    imageS3Key,
    chunkS3Keys,
    originalVideoS3Key,
    segments,
    videoDuration: jobVideoDuration,
    spliceMode,
    spliceMetadata,
    voiceId,
  } = job;

  const outDir = path.join(process.cwd(), "output", `kling-swap-${Date.now()}`);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const localImagePath = path.join(outDir, `reference_${Date.now()}.jpg`);
  let spliceSegmentS3Keys: SpliceSegmentInfo[] = [];

  try {
    console.log(`[kling-face-swap] Starting job: ${jobId}`);

    await db
      .update(comfyJobs)
      .set({
        status: "running",
        progress: 5,
        progressMessage: "Starting Job",
        startedAt: new Date(),
      })
      .where(eq(comfyJobs.id, jobId));

    emitJobUpdate(teamId, {
      id: jobId,
      status: "running",
      progress: 5,
      progressMessage: "Starting Job",
      outputUrl: null,
      errorMessage: null,
      finishedAt: null,
    });

    await updateProgress(jobId, teamId, 10, "Downloading files.");
    await s3Service.downloadFile(imageS3Key, localImagePath);
    console.log(`[kling-face-swap] Downloaded reference image`);

    const fullVideoPath = path.join(outDir, `full_video_${Date.now()}.mp4`);
    if (!originalVideoS3Key) {
      throw new Error("originalVideoS3Key is required");
    }
    await s3Service.downloadFile(originalVideoS3Key, fullVideoPath);
    console.log(`[kling-face-swap] Downloaded video: ${originalVideoS3Key}`);

    const actualVideoDuration = await getVideoDuration(fullVideoPath);
    console.log(`[kling-face-swap] Actual video duration: ${actualVideoDuration.toFixed(2)}s`);
    console.log(`[kling-face-swap] Face segments (job.segments): ${segments.map(s => `${s.start.toFixed(2)}-${s.end.toFixed(2)}`).join(', ')}`);

    if (spliceMode && spliceMetadata) {
      const metaSegs = spliceMetadata.segments as SpliceMetadataSegment[];
      console.log(`[kling-face-swap] Splice segments BEFORE adjustment: ${metaSegs.map(s => `${s.type}:${s.start.toFixed(2)}-${s.end.toFixed(2)}`).join(', ')} (metadataDuration: ${spliceMetadata.videoDuration})`);
    }

    if (spliceMode && spliceMetadata) {
      const metadataDuration = spliceMetadata.videoDuration || 0;
      if (actualVideoDuration > metadataDuration + 0.1) {
        const typedSegs = spliceMetadata.segments as SpliceMetadataSegment[];
        const lastSeg = typedSegs[typedSegs.length - 1];
        if (lastSeg.type === "original") {
          lastSeg.end = actualVideoDuration;
        } else {
          typedSegs.push({ start: lastSeg.end, end: actualVideoDuration, type: "original" });
        }
        spliceMetadata.videoDuration = actualVideoDuration;
        console.log(`[kling-face-swap] Extended to actual duration: ${actualVideoDuration.toFixed(2)}s (was ${metadataDuration.toFixed(2)}s)`);
      }
      const adjustedSegs = spliceMetadata.segments as SpliceMetadataSegment[];
      console.log(`[kling-face-swap] Splice segments AFTER adjustment: ${adjustedSegs.map(s => `${s.type}:${s.start.toFixed(2)}-${s.end.toFixed(2)}`).join(', ')}`);
    }

    const chunkLocalPaths: string[] = [];
    const chunkSegmentMap: number[] = [];

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const seg = segments[segIdx];
      const segmentDuration = seg.end - seg.start;

      const chunkDurations = calculateChunkDurations(segmentDuration);

      console.log(`[kling-face-swap] Segment ${segIdx + 1}/${segments.length}: ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s (${segmentDuration.toFixed(2)}s, ${chunkDurations.length} chunks: [${chunkDurations.map(d => d.toFixed(1)).join(', ')}]s)`);

      let currentTime = seg.start;
      for (let chunkIdx = 0; chunkIdx < chunkDurations.length; chunkIdx++) {
        const chunkDuration = chunkDurations[chunkIdx];
        const chunkStart = currentTime;
        const chunkEnd = currentTime + chunkDuration;
        const chunkPath = path.join(outDir, `seg${segIdx}_chunk${chunkIdx}.mp4`);

        await cutClip(fullVideoPath, chunkPath, chunkStart, chunkEnd);
        chunkLocalPaths.push(chunkPath);
        chunkSegmentMap.push(segIdx);
        console.log(`[kling-face-swap] Cut segment ${segIdx + 1} chunk ${chunkIdx + 1}/${chunkDurations.length}: ${chunkStart.toFixed(2)}s - ${chunkEnd.toFixed(2)}s (${chunkDuration.toFixed(1)}s)`);

        currentTime = chunkEnd;
      }
    }

    console.log(`[kling-face-swap] Total chunks to process: ${chunkLocalPaths.length}`);

    await updateProgress(jobId, teamId, 15, `Generating pose image`);

    const frameOutputPath = path.join(outDir, `frame_${Date.now()}.jpg`);
    await extractFirstFrame(chunkLocalPaths[0], frameOutputPath);

    const frameS3Key = `face-swap-assets/${teamId}/${jobId}/frame_${Date.now()}.jpg`;
    await s3Service.uploadFile(frameOutputPath, frameS3Key, "image/jpeg");
    const frameUrl = await s3Service.getPresignedUrl(frameS3Key, 3600);
    const faceImageUrl = await s3Service.getPresignedUrl(imageS3Key, 3600);
    const poseResult = await falImageService.generateImageWithReferences({
      prompt: POSE_GENERATION_PROMPT,
      imageUrls: [faceImageUrl, frameUrl],
      aspectRatio: "auto",
      numImages: 1,
      usePro: true,
    });

    const poseImagePath = path.join(outDir, `pose_${Date.now()}.png`);
    const poseResponse = await fetch(poseResult.imageUrl);
    const poseBuffer = Buffer.from(await poseResponse.arrayBuffer());
    fs.writeFileSync(poseImagePath, poseBuffer);

    const poseS3Key = `face-swap-assets/${teamId}/${jobId}/pose_${Date.now()}.png`;
    await s3Service.uploadBuffer(poseBuffer, poseS3Key, "image/png");
    const initialPoseUrl = await s3Service.getPresignedUrl(poseS3Key, 3600);
    console.log(`[kling-face-swap] Uploaded pose image to S3: ${poseS3Key}`);

    await updateProgress(jobId, teamId, 20, `Processing video chunks`);

    // Process chunks in parallel batches (same pose for all = no dependencies)
    const PARALLEL_BATCH_SIZE = 3;
    const processedChunkPaths: string[] = new Array(chunkLocalPaths.length);

    async function processChunk(index: number): Promise<void> {
      const chunkPath = chunkLocalPaths[index];
      const tempChunkKey = `face-swap-assets/${teamId}/${jobId}/chunk_${index}_${Date.now()}.mp4`;

      try {
        await s3Service.uploadFile(chunkPath, tempChunkKey, "video/mp4");
        const chunkUrl = await s3Service.getPresignedUrl(tempChunkKey, 3600);

        console.log(`[kling-face-swap] Chunk ${index + 1}/${chunkLocalPaths.length}: Starting`);

        const result = await klingProMotionWithRetry({
          imageUrl: initialPoseUrl,
          videoUrl: chunkUrl,
          keepOriginalSound: true,
          characterOrientation: "image",
        });

        const processedPath = path.join(outDir, `processed_${index}.mp4`);
        await s3Service.downloadVideoFromUrl(result.videoUrl, processedPath);
        processedChunkPaths[index] = processedPath;

        console.log(`[kling-face-swap] Chunk ${index + 1}/${chunkLocalPaths.length}: Complete`);
        await s3Service.deleteObject(tempChunkKey).catch(() => {});
      } catch (error) {
        await s3Service.deleteObject(tempChunkKey).catch(() => {});
        throw new Error(`Chunk ${index + 1} failed: ${(error as Error).message}`);
      }
    }

    for (let batchStart = 0; batchStart < chunkLocalPaths.length; batchStart += PARALLEL_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + PARALLEL_BATCH_SIZE, chunkLocalPaths.length);
      const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i);

      const progressPercent = 20 + Math.floor((batchStart / chunkLocalPaths.length) * 60);
      await updateProgress(jobId, teamId, progressPercent, `Processing chunks ${batchStart + 1}-${batchEnd}/${chunkLocalPaths.length}`);

      console.log(`[kling-face-swap] Processing batch: chunks ${batchStart + 1}-${batchEnd} in parallel`);
      await Promise.all(batchIndices.map(i => processChunk(i)));
    }

    console.log(
      `[kling-face-swap] All ${processedChunkPaths.length} chunks processed successfully`,
    );

    let finalOutputPath: string;

    if (spliceMode && spliceMetadata) {
      await updateProgress(jobId, teamId, 82, "Assembling spliced video");

      const spliceSegmentPaths: string[] = [];
      let processedChunkIdx = 0;
      const typedSegments = spliceMetadata.segments as SpliceMetadataSegment[];

      const totalSpliceDuration = typedSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
      console.log(`[kling-face-swap] Splice mode: ${typedSegments.length} segments, total duration: ${totalSpliceDuration.toFixed(2)}s (actual video: ${actualVideoDuration.toFixed(2)}s)`);

      for (let i = 0; i < typedSegments.length; i++) {
        const seg = typedSegments[i];
        const segPath = path.join(outDir, `splice_seg_${i}.mp4`);

        if (seg.type === "processed") {
          const segmentDuration = seg.end - seg.start;
          const numChunks = calculateChunkDurations(segmentDuration).length;
          const chunksForSegment = processedChunkPaths.slice(processedChunkIdx, processedChunkIdx + numChunks);
          processedChunkIdx += numChunks;

          console.log(`[kling-face-swap] Splice ${i}: PROCESSED ${seg.start.toFixed(2)}-${seg.end.toFixed(2)}s (${numChunks} chunks)`);

          if (chunksForSegment.length === 0) {
            throw new Error(`No chunks available for processed segment ${i}`);
          }

          await mergeClipsGpu(chunksForSegment, segPath);
        } else {
          console.log(`[kling-face-swap] Splice ${i}: ORIGINAL ${seg.start.toFixed(2)}-${seg.end.toFixed(2)}s`);
          await cutClip(fullVideoPath, segPath, seg.start, seg.end);
        }

        spliceSegmentPaths.push(segPath);

        const segBuffer = fs.readFileSync(segPath);
        const segS3Key = `comfy-outputs/${teamId}/${jobId}/segment_${i}_${seg.type}.mp4`;
        await s3Service.uploadBuffer(segBuffer, segS3Key, "video/mp4");
        spliceSegmentS3Keys.push({
          s3Key: segS3Key,
          type: seg.type,
          start: seg.start,
          end: seg.end,
        });
      }

      if (processedChunkIdx !== processedChunkPaths.length) {
        console.warn(`[kling-face-swap] WARNING: Used ${processedChunkIdx}/${processedChunkPaths.length} chunks - some may be missing!`);
      }

      console.log(`[kling-face-swap] Merging ${spliceSegmentPaths.length} splice segments...`);
      await updateProgress(jobId, teamId, 85, "Merging segments");

      finalOutputPath = path.join(outDir, `final_${Date.now()}.mp4`);
      await mergeClipsGpu(spliceSegmentPaths, finalOutputPath);

      const finalDuration = await getVideoDuration(finalOutputPath);
      console.log(`[kling-face-swap] Final output: ${finalDuration.toFixed(2)}s (expected: ${actualVideoDuration.toFixed(2)}s, diff: ${(actualVideoDuration - finalDuration).toFixed(2)}s)`);

    } else {
      console.log(`[kling-face-swap] Non-splice: merging ${processedChunkPaths.length} chunks...`);
      await updateProgress(jobId, teamId, 82, "Combining video");

      finalOutputPath = path.join(outDir, `final_${Date.now()}.mp4`);
      await mergeClipsGpu(processedChunkPaths, finalOutputPath);

      const finalDuration = await getVideoDuration(finalOutputPath);
      const expectedDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
      console.log(`[kling-face-swap] Final output: ${finalDuration.toFixed(2)}s (expected: ${expectedDuration.toFixed(2)}s)`);
    }

    if (spliceMode && spliceSegmentS3Keys.length > 0) {
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

    if (voiceId) {
      console.log(`[kling-face-swap] Voice conversion: ${voiceId}`);
      await updateProgress(jobId, teamId, 92, "Converting voice...");

      try {
        const extractedAudioPath = path.join(outDir, `extracted_audio_${Date.now()}.wav`);
        await extractAudio(finalOutputPath, extractedAudioPath);

        const mp3AudioPath = path.join(outDir, `audio_for_sts_${Date.now()}.mp3`);
        await new Promise<void>((resolve, reject) => {
          const { execSync } = require("child_process");
          try {
            execSync(
              `ffmpeg -y -i "${extractedAudioPath}" -acodec libmp3lame -ar 44100 -ac 2 -b:a 192k "${mp3AudioPath}"`,
              { stdio: "pipe" },
            );
            resolve();
          } catch (err) {
            reject(err);
          }
        });

        const audioBuffer = fs.readFileSync(mp3AudioPath);
        const convertedAudioBuffer = await speechToSpeech({
          voiceId,
          audioBuffer,
        });
        const convertedAudioPath = path.join(
          outDir,
          `converted_audio_${Date.now()}.mp3`,
        );
        fs.writeFileSync(convertedAudioPath, convertedAudioBuffer);
        const voiceConvertedVideoPath = path.join(
          outDir,
          `voice_converted_${Date.now()}.mp4`,
        );
        await replaceAudioInVideo(
          finalOutputPath,
          convertedAudioPath,
          voiceConvertedVideoPath,
        );
        finalOutputPath = voiceConvertedVideoPath;
      } catch (voiceErr) {
        console.error(
          `[kling-face-swap] Voice conversion failed, using original audio:`,
          (voiceErr as Error).message,
        );
      }
    }

    console.log(`[kling-face-swap] Uploading final video to S3...`);
    await updateProgress(jobId, teamId, 95, "Uploading.");

    const finalBuffer = fs.readFileSync(finalOutputPath);
    const s3Key = `comfy-outputs/${teamId}/${jobId}/final.mp4`;
    await s3Service.uploadBuffer(finalBuffer, s3Key, "video/mp4");

    const outputUrl = await s3Service.getPresignedUrl(s3Key, 3600);
    await completeJob(jobId, teamId, true, s3Key, outputUrl);

    console.log(`[kling-face-swap] Job ${jobId} completed successfully!`);

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
            folder_id: job.folderId || null,
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

        try {
          const tempDir = path.join(
            process.cwd(),
            "output",
            `transcribe-${Date.now()}`,
          );
          fs.mkdirSync(tempDir, { recursive: true });
          const tempVideoPath = path.join(tempDir, "video.mp4");

          await s3Service.downloadFile(s3Key, tempVideoPath);
          const transcriptionData = await transcribeVideoService(tempVideoPath);
          const words =
            transcriptionData.results.channels[0].alternatives[0].words;
          const captionsData = convertWordsToCaptionEntries(words);
          const srtContent = generateSrtFromCaptions(captionsData);
          const srtPath = path.join(tempDir, `captions_${clip.id}.srt`);
          fs.writeFileSync(srtPath, srtContent);
          const srtS3Key = await s3Service.uploadSrtFile(
            srtPath,
            teamId,
            clip.id,
          );

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
          console.error(
            `[kling-face-swap] Transcription failed:`,
            (transcribeErr as Error).message,
          );
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, member.userId))
          .limit(1);

        if (user) {
          const frontendUrl =
            process.env.FRONTEND_URL || "https://platform.cuttr.com";
          await emailNotiService.sendUgcReady(user.email, {
            userName: user.first_name || "there",
            ugcUrl: `${frontendUrl}/dashboard/ugc-studio`,
          });
          console.log(
            `[kling-face-swap] Sent UGC ready email to ${user.email}`,
          );
        }
      }
    } catch (clipErr) {
      console.error(
        `[kling-face-swap] Failed to create clip or notify:`,
        (clipErr as Error).message,
      );
    }
  } catch (err) {
    console.error(`[kling-face-swap] Job failed:`, (err as Error).message);
    Sentry.captureException(err);

    await completeJob(
      jobId,
      teamId,
      false,
      undefined,
      undefined,
      (err as Error).message,
    );

    try {
      await teamService.decrementTeamUsage(teamId, UGC_CREDIT_COST);
      console.log(
        `[kling-face-swap] Refunded ${UGC_CREDIT_COST} credits to team ${teamId}`,
      );
    } catch (refundErr) {
      console.error(`[kling-face-swap] Failed to refund credits:`, refundErr);
    }

    throw err;
  } finally {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
      console.log(`[kling-face-swap] Cleaned up temp directory: ${outDir}`);
    }
  }
}
