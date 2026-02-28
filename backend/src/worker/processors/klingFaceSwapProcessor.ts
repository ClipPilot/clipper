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
  mergeClipsFaceSwap,
  extractFirstFrame,
  extractFrameAtTime,
  extractAudio,
  replaceAudioInVideo,
  prependPoseFrame,
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
const MAX_CHUNK_DURATION = 25;
const MIN_CHUNK_DURATION = 3;

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
  const remainder = totalDuration - numFullChunks * MAX_CHUNK_DURATION;

  // Perfect division - no remainder
  if (remainder === 0) {
    return Array(numFullChunks).fill(MAX_CHUNK_DURATION);
  }

  // Remainder is large enough to be its own chunk (>= 3s)
  if (remainder >= MIN_CHUNK_DURATION) {
    return [...Array(numFullChunks).fill(MAX_CHUNK_DURATION), remainder];
  }

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
  errorMessage?: string,
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

    await updateProgress(jobId, teamId, 10, "Preparing");
    await s3Service.downloadFile(imageS3Key, localImagePath);
    console.log(`[kling-face-swap] Downloaded reference image`);
    const fullVideoPath = path.join(outDir, `full_video_${Date.now()}.mp4`);
    if (!originalVideoS3Key) {
      throw new Error(
        "originalVideoS3Key is required - worker handles all video cutting",
      );
    }
    await s3Service.downloadFile(originalVideoS3Key, fullVideoPath);
    console.log(
      `[kling-face-swap] Downloaded full video from ${originalVideoS3Key}`,
    );

    const videoDuration = await getVideoDuration(fullVideoPath);
    console.log(
      `[kling-face-swap] Video duration: ${videoDuration.toFixed(2)}s, segments to process: ${segments.length}`,
    );

    await updateProgress(jobId, teamId, 15, "Processing");
    const faceImageUrl = await s3Service.getPresignedUrl(imageS3Key, 3600);
    const PARALLEL_SEGMENTS = 3;
    const PARALLEL_CHUNKS = 3;
    let firstPoseUrl: string | null = null;

    async function processSegment(segIdx: number): Promise<string> {
      const seg = segments[segIdx];
      const segmentDuration = seg.end - seg.start;
      const timestamp = Date.now() + segIdx;

      console.log(`[kling-face-swap] Segment ${segIdx + 1}/${segments.length}: ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s`);

      const segmentPath = path.join(outDir, `segment_${segIdx}_${timestamp}.mp4`);
      await cutClip(fullVideoPath, segmentPath, seg.start, seg.end);

      const frameOutputPath = path.join(outDir, `frame_seg${segIdx}_${timestamp}.jpg`);
      await extractFrameAtTime(segmentPath, frameOutputPath, 0.1);

      const frameS3Key = `face-swap-assets/${teamId}/${jobId}/frame_seg${segIdx}_${timestamp}.jpg`;
      await s3Service.uploadFile(frameOutputPath, frameS3Key, "image/jpeg");
      const frameUrl = await s3Service.getPresignedUrl(frameS3Key, 3600);

      const referenceImageUrl = segIdx === 0 ? faceImageUrl : firstPoseUrl!;

      const poseResult = await falImageService.generateImageWithReferences({
        prompt: POSE_GENERATION_PROMPT,
        imageUrls: [referenceImageUrl, frameUrl],
        aspectRatio: "auto",
        numImages: 1,
      });

      const poseImagePath = path.join(outDir, `pose_seg${segIdx}_${timestamp}.png`);
      const poseResponse = await fetch(poseResult.imageUrl);
      const poseBuffer = Buffer.from(await poseResponse.arrayBuffer());
      fs.writeFileSync(poseImagePath, poseBuffer);

      const poseS3Key = `face-swap-assets/${teamId}/${jobId}/pose_seg${segIdx}_${timestamp}.png`;
      await s3Service.uploadBuffer(poseBuffer, poseS3Key, "image/png");
      const poseUrl = await s3Service.getPresignedUrl(poseS3Key, 3600);

      if (segIdx === 0) {
        firstPoseUrl = poseUrl;
      }

      const prependedSegmentPath = path.join(outDir, `prepended_seg${segIdx}_${timestamp}.mp4`);
      await prependPoseFrame(segmentPath, poseImagePath, prependedSegmentPath);

      const prependedDuration = await getVideoDuration(prependedSegmentPath);
      const chunkDurations = calculateChunkDurations(prependedDuration);

      const chunkPaths: string[] = [];
      let currentTime = 0;
      for (let chunkIdx = 0; chunkIdx < chunkDurations.length; chunkIdx++) {
        const chunkDuration = chunkDurations[chunkIdx];
        const chunkPath = path.join(outDir, `seg${segIdx}_chunk${chunkIdx}_${timestamp}.mp4`);
        await cutClip(prependedSegmentPath, chunkPath, currentTime, currentTime + chunkDuration);
        chunkPaths.push(chunkPath);
        currentTime += chunkDuration;
      }

      const processedChunks: string[] = new Array(chunkPaths.length);

      async function processChunk(chunkIdx: number): Promise<void> {
        const chunkPath = chunkPaths[chunkIdx];
        const tempChunkKey = `face-swap-assets/${teamId}/${jobId}/seg${segIdx}_chunk${chunkIdx}_${timestamp}.mp4`;

        await s3Service.uploadFile(chunkPath, tempChunkKey, "video/mp4");
        const chunkUrl = await s3Service.getPresignedUrl(tempChunkKey, 3600);

        const result = await klingProMotionWithRetry({
          imageUrl: poseUrl,
          videoUrl: chunkUrl,
          keepOriginalSound: true,
          characterOrientation: "video",
        });

        const processedPath = path.join(outDir, `processed_seg${segIdx}_chunk${chunkIdx}_${timestamp}.mp4`);
        await s3Service.downloadVideoFromUrl(result.videoUrl, processedPath);
        processedChunks[chunkIdx] = processedPath;

        console.log(`[kling-face-swap] Segment ${segIdx + 1} chunk ${chunkIdx + 1}/${chunkPaths.length}: Complete`);
        await s3Service.deleteObject(tempChunkKey).catch(() => {});
      }

      for (let batchStart = 0; batchStart < chunkPaths.length; batchStart += PARALLEL_CHUNKS) {
        const batchEnd = Math.min(batchStart + PARALLEL_CHUNKS, chunkPaths.length);
        const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i);
        await Promise.all(batchIndices.map(i => processChunk(i)));
      }

      const processedSegmentPath = path.join(outDir, `processed_segment_${segIdx}_${timestamp}.mp4`);
      if (processedChunks.length === 1) {
        fs.copyFileSync(processedChunks[0], processedSegmentPath);
      } else {
        await mergeClipsFaceSwap(processedChunks, processedSegmentPath);
      }

      console.log(`[kling-face-swap] Segment ${segIdx + 1}/${segments.length} complete`);
      return processedSegmentPath;
    }

    const processedSegmentPaths: string[] = new Array(segments.length);

    await updateProgress(jobId, teamId, 15, "Processing");
    processedSegmentPaths[0] = await processSegment(0);

    if (segments.length > 1) {
      for (let batchStart = 1; batchStart < segments.length; batchStart += PARALLEL_SEGMENTS) {
        const batchEnd = Math.min(batchStart + PARALLEL_SEGMENTS, segments.length);
        const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i);

        const progressPercent = 15 + Math.floor((batchStart / segments.length) * 65);
        await updateProgress(jobId, teamId, progressPercent, "Processing");

        const results = await Promise.all(batchIndices.map(i => processSegment(i)));
        results.forEach((path, idx) => {
          processedSegmentPaths[batchIndices[idx]] = path;
        });
      }
    }

    console.log(`[kling-face-swap] All ${processedSegmentPaths.length} segments processed`);

    let finalOutputPath: string;

    if (spliceMode && spliceMetadata) {
      // SPLICE MODE: Interleave processed segments with original (unprocessed) segments
      console.log(
        `[kling-face-swap] Splice mode: assembling interleaved video...`,
      );
      await updateProgress(jobId, teamId, 82, "Assembling");

      const spliceSegmentPaths: string[] = [];
      let processedSegIdx = 0;
      const typedSegments = spliceMetadata.segments as SpliceMetadataSegment[];

      const { execSync } = require("child_process");

      for (let i = 0; i < typedSegments.length; i++) {
        const seg = typedSegments[i];
        const rawPath = path.join(outDir, `splice_seg_${i}_raw.mp4`);
        const segPath = path.join(outDir, `splice_seg_${i}.mp4`);

        if (seg.type === "processed") {
          console.log(`[kling-face-swap] Splice segment ${i}: PROCESSED ${seg.start.toFixed(2)}-${seg.end.toFixed(2)}s`);
          fs.copyFileSync(processedSegmentPaths[processedSegIdx], rawPath);
          processedSegIdx++;
        } else {
          console.log(`[kling-face-swap] Splice segment ${i}: ORIGINAL ${seg.start.toFixed(2)}-${seg.end.toFixed(2)}s`);
          await cutClip(fullVideoPath, rawPath, seg.start, seg.end);
        }

        execSync(`ffmpeg -y -i "${rawPath}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -ar 48000 -ac 2 "${segPath}"`, { stdio: "pipe" });
        fs.unlinkSync(rawPath);

        spliceSegmentPaths.push(segPath);

        const segBuffer = fs.readFileSync(segPath);
        const segS3Key = `comfy-outputs/${teamId}/${jobId}/segment_${i}_${seg.type}.mp4`;
        await s3Service.uploadBuffer(segBuffer, segS3Key, "video/mp4");
        spliceSegmentS3Keys.push({ s3Key: segS3Key, type: seg.type, start: seg.start, end: seg.end });
      }

      console.log(
        `[kling-face-swap] Merging ${spliceSegmentPaths.length} splice segments...`,
      );

      for (const segPath of spliceSegmentPaths) {
        if (!fs.existsSync(segPath)) {
          throw new Error(`Splice segment missing: ${segPath}`);
        }
      }

      await updateProgress(jobId, teamId, 85, "Finalizing");

      finalOutputPath = path.join(outDir, `final_${Date.now()}.mp4`);

      if (spliceSegmentPaths.length === 1) {
        fs.copyFileSync(spliceSegmentPaths[0], finalOutputPath);
        console.log(`[kling-face-swap] Single splice segment, copied directly`);
      } else {
        await mergeClipsFaceSwap(spliceSegmentPaths, finalOutputPath);
        console.log(`[kling-face-swap] Merged ${spliceSegmentPaths.length} splice segments`);
      }
    } else {
      console.log(`[kling-face-swap] Merging ${processedSegmentPaths.length} segments...`);
      console.log(`[kling-face-swap] Segment paths:`, processedSegmentPaths);

      for (const segPath of processedSegmentPaths) {
        if (!fs.existsSync(segPath)) {
          throw new Error(`Processed segment missing: ${segPath}`);
        }
        console.log(`[kling-face-swap] Verified: ${segPath} exists`);
      }

      await updateProgress(jobId, teamId, 85, "Finalizing");

      finalOutputPath = path.join(outDir, `final_${Date.now()}.mp4`);

      if (processedSegmentPaths.length === 1) {
        fs.copyFileSync(processedSegmentPaths[0], finalOutputPath);
        console.log(`[kling-face-swap] Single segment, copied directly`);
      } else {
        await mergeClipsFaceSwap(processedSegmentPaths, finalOutputPath);
        console.log(`[kling-face-swap] Merged ${processedSegmentPaths.length} segments`);
      }
    }

    // Update splice metadata in DB if we have processed segments
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

    // Speech-to-Speech voice conversion if voiceId is provided
    if (voiceId) {
      console.log(
        `[kling-face-swap] Voice conversion requested with voiceId: ${voiceId}`,
      );
      await updateProgress(jobId, teamId, 92, "Converting voice");

      try {
        // Extract audio from the final video
        const extractedAudioPath = path.join(
          outDir,
          `extracted_audio_${Date.now()}.wav`,
        );
        await extractAudio(finalOutputPath, extractedAudioPath);
        console.log(`[kling-face-swap] Extracted audio from video`);

        // Convert to MP3 for ElevenLabs (it expects mp3/mpeg format)
        const mp3AudioPath = path.join(
          outDir,
          `audio_for_sts_${Date.now()}.mp3`,
        );
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

        // Read the audio and send to ElevenLabs Speech-to-Speech
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
    await updateProgress(jobId, teamId, 95, "Uploading");

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

        // Emit updated job with clipId so frontend can show Edit button
        emitJobUpdate(teamId, {
          id: jobId,
          status: "completed",
          progress: 100,
          progressMessage: "Completed",
          outputUrl: outputUrl || null,
          errorMessage: null,
          finishedAt: new Date().toISOString(),
          clipId: clip.id,
        });

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
