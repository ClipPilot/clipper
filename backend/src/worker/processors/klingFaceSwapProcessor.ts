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
  extractLastFrame,
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

    await updateProgress(jobId, teamId, 10, "Downloading files.");
    await s3Service.downloadFile(imageS3Key, localImagePath);
    console.log(`[kling-face-swap] Downloaded reference image`);

    // Download the full original video (worker handles all cutting)
    const fullVideoPath = path.join(outDir, `full_video_${Date.now()}.mp4`);
    if (!originalVideoS3Key) {
      throw new Error("originalVideoS3Key is required - worker handles all video cutting");
    }
    await s3Service.downloadFile(originalVideoS3Key, fullVideoPath);
    console.log(`[kling-face-swap] Downloaded full video from ${originalVideoS3Key}`);

    // Step 1: Extract audio from the FULL original video FIRST (preserves continuous audio across all segments)
    // Note: extractAudio uses pcm_s16le codec which outputs WAV format
    const originalAudioPath = path.join(outDir, `original_audio_${Date.now()}.wav`);
    await extractAudio(fullVideoPath, originalAudioPath);
    console.log(`[kling-face-swap] Extracted original audio for later restoration`);

    // Step 2: Get video duration
    const videoDuration = await getVideoDuration(fullVideoPath);
    console.log(`[kling-face-swap] Video duration: ${videoDuration.toFixed(2)}s, segments to process: ${segments.length}`);

    // Step 3: Cut each segment from the full video, then chunk each segment into 10s pieces
    // All cutting happens here in the worker
    const chunkLocalPaths: string[] = [];
    const chunkSegmentMap: number[] = []; // Track which segment each chunk belongs to

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const seg = segments[segIdx];
      const segmentDuration = seg.end - seg.start;

      // Calculate chunk durations ensuring each is between 3-10 seconds
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

    // Step 4: Generate nano-banana pose image from first frame
    const frameOutputPath = path.join(outDir, `frame_${Date.now()}.jpg`);
    await extractFirstFrame(chunkLocalPaths[0], frameOutputPath);
    console.log(`[kling-face-swap] Extracted first frame from video`);

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

    // Step 5: Process chunks SEQUENTIALLY with chained reference images
    // First chunk uses nano-banana pose, subsequent chunks use last frame of previous processed chunk
    const processedChunkPaths: string[] = [];
    let currentReferenceUrl = initialPoseUrl;

    for (let i = 0; i < chunkLocalPaths.length; i++) {
      const chunkPath = chunkLocalPaths[i];
      const tempChunkKey = `face-swap-assets/${teamId}/${jobId}/chunk_${i}_${Date.now()}.mp4`;

      const progressPercent = 20 + Math.floor((i / chunkLocalPaths.length) * 60);
      await updateProgress(jobId, teamId, progressPercent, `Processing chunk ${i + 1}/${chunkLocalPaths.length}`);

      try {
        await s3Service.uploadFile(chunkPath, tempChunkKey, "video/mp4");
        const chunkUrl = await s3Service.getPresignedUrl(tempChunkKey, 3600);

        console.log(`[kling-face-swap] Chunk ${i + 1}/${chunkLocalPaths.length}: Using reference from ${i === 0 ? 'nano-banana pose' : 'previous chunk last frame'}`);

        const result = await klingProMotionWithRetry({
          imageUrl: currentReferenceUrl,
          videoUrl: chunkUrl,
          keepOriginalSound: false, // We'll replace with original audio later
          characterOrientation: "image",
        });

        const processedPath = path.join(outDir, `processed_${i}.mp4`);
        await s3Service.downloadVideoFromUrl(result.videoUrl, processedPath);
        processedChunkPaths.push(processedPath);

        console.log(`[kling-face-swap] Chunk ${i + 1}/${chunkLocalPaths.length}: Complete`);

        // For next chunk, extract last frame from this processed chunk as the new reference
        if (i < chunkLocalPaths.length - 1) {
          const lastFramePath = path.join(outDir, `last_frame_${i}_${Date.now()}.jpg`);
          await extractLastFrame(processedPath, lastFramePath);

          const lastFrameS3Key = `face-swap-assets/${teamId}/${jobId}/last_frame_${i}_${Date.now()}.jpg`;
          await s3Service.uploadFile(lastFramePath, lastFrameS3Key, "image/jpeg");
          currentReferenceUrl = await s3Service.getPresignedUrl(lastFrameS3Key, 3600);
          console.log(`[kling-face-swap] Extracted last frame from chunk ${i + 1} for next chunk reference`);
        }

        await s3Service.deleteObject(tempChunkKey).catch(() => {});
      } catch (error) {
        await s3Service.deleteObject(tempChunkKey).catch(() => {});
        throw new Error(`Chunk ${i + 1} failed: ${(error as Error).message}`);
      }
    }

    console.log(
      `[kling-face-swap] All ${processedChunkPaths.length} chunks processed successfully`,
    );

    let finalOutputPath: string;

    if (spliceMode && spliceMetadata) {
      // SPLICE MODE: Interleave processed segments with original (unprocessed) segments
      console.log(`[kling-face-swap] Splice mode: assembling interleaved video...`);
      await updateProgress(jobId, teamId, 82, "Assembling spliced video");

      const spliceSegmentPaths: string[] = [];
      let processedChunkIdx = 0;
      const typedSegments = spliceMetadata.segments as SpliceMetadataSegment[];

      for (let i = 0; i < typedSegments.length; i++) {
        const seg = typedSegments[i];
        const segPath = path.join(outDir, `splice_seg_${i}.mp4`);

        if (seg.type === "processed") {
          // Calculate how many chunks belong to this processed segment (using same logic as cutting)
          const segmentDuration = seg.end - seg.start;
          const numChunks = calculateChunkDurations(segmentDuration).length;

          const chunksForSegment = processedChunkPaths.slice(
            processedChunkIdx,
            processedChunkIdx + numChunks,
          );
          processedChunkIdx += numChunks;

          console.log(
            `[kling-face-swap] Splice segment ${i}: PROCESSED ${seg.start.toFixed(2)}-${seg.end.toFixed(2)}s using ${numChunks} chunks`,
          );

          if (chunksForSegment.length === 0) {
            throw new Error(`No chunks available for processed segment ${i}`);
          }

          // Merge this segment's processed chunks
          await mergeClipsGpu(chunksForSegment, segPath);
        } else {
          // Original segment - cut from the full video (already downloaded)
          console.log(
            `[kling-face-swap] Splice segment ${i}: ORIGINAL ${seg.start.toFixed(2)}-${seg.end.toFixed(2)}s`,
          );
          await cutClip(fullVideoPath, segPath, seg.start, seg.end);
        }

        spliceSegmentPaths.push(segPath);

        // Upload each segment to S3 for debugging/reference
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

      // Merge all splice segments (processed + original interleaved)
      console.log(`[kling-face-swap] Merging ${spliceSegmentPaths.length} splice segments...`);
      await updateProgress(jobId, teamId, 85, "Merging segments");

      const splicedVideoPath = path.join(outDir, `spliced_${Date.now()}.mp4`);
      await mergeClipsGpu(spliceSegmentPaths, splicedVideoPath);

      // Replace audio with original continuous audio track
      console.log(`[kling-face-swap] Restoring original audio...`);
      await updateProgress(jobId, teamId, 87, "Restoring audio");

      finalOutputPath = path.join(outDir, `final_${Date.now()}.mp4`);
      await replaceAudioInVideo(splicedVideoPath, originalAudioPath, finalOutputPath);
      console.log(`[kling-face-swap] Spliced ${spliceSegmentPaths.length} segments with restored audio`);

    } else {
      // NON-SPLICE MODE: Simple merge of all processed chunks
      console.log(`[kling-face-swap] Non-splice mode: merging ${processedChunkPaths.length} chunks...`);
      await updateProgress(jobId, teamId, 82, "Combining video");

      const mergedVideoPath = path.join(outDir, `merged_${Date.now()}.mp4`);
      await mergeClipsGpu(processedChunkPaths, mergedVideoPath);
      console.log(`[kling-face-swap] Merged ${processedChunkPaths.length} chunks`);

      // Replace audio with original continuous audio track
      console.log(`[kling-face-swap] Restoring original audio...`);
      await updateProgress(jobId, teamId, 85, "Restoring audio");

      finalOutputPath = path.join(outDir, `final_${Date.now()}.mp4`);
      await replaceAudioInVideo(mergedVideoPath, originalAudioPath, finalOutputPath);
      console.log(`[kling-face-swap] Audio restored from original video`);
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
      await updateProgress(jobId, teamId, 92, "Converting voice...");

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
