import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { s3Service } from "../s3.service";
import { elevenLabsService } from "./elevenlabs.service";
import {
  klingService,
  buildKlingPrompt,
  generateGroundedCinematicPrompt,
  ShotType,
  PRODUCT_NEGATIVE_PROMPT,
  SCREEN_STABILITY_MODIFIERS,
} from "./kling.service";
import { veedFabricService } from "./veedFabric.service";
import { grokImagineService } from "./grokImagine.service";
import { openaiClient } from "../openai.service";
import { generateJumbledMetadataString } from "../../utils/videoMetadata";
import { VIDEO_ENCODE_SETTINGS, AUDIO_SETTINGS } from "../../config/ffmpegSettings";

const MAX_KLING_VIDEO_DURATION = 10;
const MAX_AROLL_VIDEO_DURATION = 60;
const KLING_EXTENSION_DURATION = 5;
const PARALLEL_SCENES = 2;
const AUDIO_SAMPLE_RATE = AUDIO_SETTINGS.sampleRate;
const AUDIO_CHANNELS = AUDIO_SETTINGS.channels;
const AUDIO_BITRATE = AUDIO_SETTINGS.bitrate;
const SPEECH_SPEED_BOOST = 1.25;

function applySpeedBoost(
  inputPath: string,
  sceneNumber: number,
  speedBoost: number = SPEECH_SPEED_BOOST,
): { outputPath: string; finalDuration: number } {
  const currentDuration = getMediaDuration(inputPath);
  const targetDuration = currentDuration / speedBoost;

  console.log(
    `[FFmpeg] Scene ${sceneNumber}: Applying ${speedBoost}x speed boost (${currentDuration.toFixed(2)}s -> ${targetDuration.toFixed(2)}s)`,
  );

  const outputPath = path.join(
    OUTPUT_DIR,
    `audio_boosted_${sceneNumber}_${Date.now()}.mp3`,
  );

  const cmd = `ffmpeg -y -i "${inputPath}" -filter:a "atempo=${speedBoost}" -vn "${outputPath}"`;
  execSync(cmd, { stdio: "pipe" });

  const finalDuration = getMediaDuration(outputPath);

  if (inputPath !== outputPath && fs.existsSync(inputPath)) {
    fs.unlinkSync(inputPath);
  }

  return { outputPath, finalDuration };
}

async function shortenDialogueText(
  originalText: string,
  currentDurationSeconds: number,
  targetDurationSeconds: number,
  sceneNumber: number,
): Promise<string> {
  const reductionRatio = targetDurationSeconds / currentDurationSeconds;
  const targetCharCount = Math.floor(originalText.length * reductionRatio * 0.9);

  console.log(
    `[UGC Assembly] Scene ${sceneNumber}: Shortening dialogue from ${originalText.length} chars to ~${targetCharCount} chars`,
  );

  const response = await openaiClient.responses.create({
    model: "gpt-4o-mini",
    instructions: `You are a dialogue editor for video ads. Shorten the following script dialogue to approximately ${targetCharCount} characters while preserving the key message and tone. Keep it natural and punchy for a video ad. Return ONLY the shortened text, no quotes or explanation.`,
    input: originalText,
  });

  const shortenedText = response.output_text.trim();
  console.log(
    `[UGC Assembly] Scene ${sceneNumber}: Shortened dialogue: "${shortenedText.substring(0, 50)}..." (${shortenedText.length} chars)`,
  );

  return shortenedText;
}

/**
 * Extract the last frame from a video as a PNG image.
 * Used for video extension - the last frame becomes the start frame for continuation.
 */
function extractLastFrame(videoPath: string, sceneNumber: number): string {
  const outputPath = path.join(
    OUTPUT_DIR,
    `lastframe_${sceneNumber}_${Date.now()}.png`,
  );
  const duration = getMediaDuration(videoPath);
  const timestamp = Math.max(0, duration - 0.1);
  const cmd = `ffmpeg -y -ss ${timestamp.toFixed(3)} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`;

  console.log(
    `[FFmpeg] Scene ${sceneNumber}: Extracting last frame at ${timestamp.toFixed(2)}s`,
  );
  execSync(cmd, { stdio: "pipe" });

  return outputPath;
}

/**
 * Merge multiple video clips with re-encoding for consistent keyframes.
 * Re-encodes during concatenation to ensure smooth mobile playback
 * (fixes pausing at segment boundaries caused by keyframe misalignment).
 */
function mergeUGCClips(clips: string[], outputPath: string): void {
  const listPath = path.join(OUTPUT_DIR, `concat_list_${Date.now()}.txt`);
  const listContent = clips
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, listContent);
  const cmd = `ffmpeg -y -f concat -safe 0 -i "${listPath}" \
    ${VIDEO_ENCODE_SETTINGS} \
    -c:a aac -ar ${AUDIO_SAMPLE_RATE} -ac ${AUDIO_CHANNELS} -b:a ${AUDIO_BITRATE} \
    -fflags +genpts -avoid_negative_ts make_zero \
    -movflags +faststart \
    ${generateJumbledMetadataString()} \
    "${outputPath}"`;

  console.log(
    `[MERGE] Re-encoding ${clips.length} clips for mobile playback...`,
  );
  execSync(cmd, { stdio: "pipe" });
  fs.unlinkSync(listPath);
  console.log(`[MERGE] Complete: ${outputPath}`);
}

export interface BRollShotVideoData {
  action: string;
  cinematicPrompt: string;
  durationSeconds: number;
  imageKey: string;
}

export interface SceneVideoData {
  sceneId: string;
  sceneNumber: number;
  shotType: ShotType;
  imageKey: string;
  endImageKey?: string;
  dialogue: string;
  duration: number;
  cinematicPrompt: string;
  action: string;
  emotion: string;
  ambientSound?: string | null;
  bRollShots?: BRollShotVideoData[];
  sharedAmbientAudioPath?: string;
}

export interface ProcessedScene {
  sceneId: string;
  sceneNumber: number;
  audioKey: string;
  videoKey: string;
  localVideoPath: string;
  duration: number;
}

export interface AssemblyOptions {
  teamId: number;
  scriptId: string;
  voiceId: string;
  scenes: SceneVideoData[];
  onProgress?: (progress: number, message: string) => void;
  /** Recommended TTS speed multiplier from voice delivery analysis (0.7-1.5, default 1.0) */
  ttsSpeed?: number;
}

export interface AssemblyResult {
  finalVideoKey: string;
  totalDuration: number;
  sceneVideos: ProcessedScene[];
}

const OUTPUT_DIR = path.join(process.cwd(), "output", "ugc-videos");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getMediaDuration(filePath: string): number {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: "utf-8" },
    );
    return parseFloat(result.trim());
  } catch (error) {
    console.error("[FFmpeg] Failed to get media duration:", error);
    return 0;
  }
}

function calculateMontageShots(
  audioDuration: number,
  numShots: number,
): Array<{ kling: 5 | 10; trim: number }> {
  const perShotDuration = audioDuration / numShots;
  const results: Array<{ kling: 5 | 10; trim: number }> = [];

  let remaining = audioDuration;

  for (let i = 0; i < numShots; i++) {
    const isLast = i === numShots - 1;
    const targetTrim = isLast ? remaining : perShotDuration;
    const klingDuration: 5 | 10 = targetTrim > 5 ? 10 : 5;
    const actualTrim = Math.min(targetTrim, klingDuration);

    results.push({ kling: klingDuration, trim: actualTrim });
    remaining -= actualTrim;
  }

  return results;
}

async function generateDialogueAudio(
  voiceId: string,
  text: string,
  teamId: number,
  scriptId: string,
  sceneNumber: number,
  speedBoost: number = SPEECH_SPEED_BOOST,
): Promise<{ audioPath: string; audioKey: string; duration: number }> {
  console.log(
    `[UGC Assembly] Scene ${sceneNumber}: Generating dialogue audio...`,
  );

  const { audioBuffer, actualDuration } =
    await elevenLabsService.textToDialogueForTargetDuration({
      voiceId,
      text,
      targetDurationSeconds: 12,
      tolerancePercent: 50,
    });

  const tempAudioPath = path.join(
    OUTPUT_DIR,
    `dialogue_raw_${sceneNumber}_${Date.now()}.mp3`,
  );
  fs.writeFileSync(tempAudioPath, audioBuffer);

  const { outputPath: audioPath, finalDuration } = applySpeedBoost(tempAudioPath, sceneNumber, speedBoost);

  console.log(
    `[UGC Assembly] Scene ${sceneNumber}: Audio ${actualDuration.toFixed(2)}s -> ${finalDuration.toFixed(2)}s (${speedBoost}x)`,
  );

  const boostedBuffer = fs.readFileSync(audioPath);
  const audioKey = await s3Service.uploadTTSAudio(
    boostedBuffer,
    teamId,
    scriptId,
    sceneNumber,
  );

  return { audioPath, audioKey, duration: finalDuration };
}

/**
 * Trim video to exact audio duration, ensuring no frozen frames.
 * Uses -t flag to cut at exact duration.
 */
function trimVideoToAudio(
  videoPath: string,
  audioDuration: number,
  sceneNumber: number,
): string {
  const videoDuration = getMediaDuration(videoPath);

  if (videoDuration < audioDuration) {
    console.warn(
      `[FFmpeg] Scene ${sceneNumber}: Video (${videoDuration.toFixed(2)}s) shorter than audio (${audioDuration.toFixed(2)}s)!`,
    );
  }

  const outputPath = path.join(
    OUTPUT_DIR,
    `trimmed_${sceneNumber}_${Date.now()}.mp4`,
  );

  const cmd = `ffmpeg -y -i "${videoPath}" -t ${audioDuration.toFixed(3)} \
    ${VIDEO_ENCODE_SETTINGS} \
    -c:a aac -ar ${AUDIO_SAMPLE_RATE} -ac ${AUDIO_CHANNELS} -b:a ${AUDIO_BITRATE} \
    -avoid_negative_ts make_zero "${outputPath}"`;
  console.log(
    `[FFmpeg] Scene ${sceneNumber}: Trimming video to ${audioDuration.toFixed(2)}s`,
  );
  execSync(cmd, { stdio: "pipe" });

  return outputPath;
}

/**
 * Extend a video to match target duration using last-frame continuation.
 * Extracts the last frame from the current video and uses it as the starting
 * image for the next segment, maintaining visual continuity.
 *
 * Works for both A-roll (avatar) and B-roll (product shots) - uses the same
 * Kling 2.6 Pro image-to-video with the original prompt for consistency.
 *
 * Process:
 * 1. Extract last frame from current video
 * 2. Use last frame as start image for Kling image-to-video
 * 3. Generate 5-10s extension with same prompt
 * 4. Merge all segments seamlessly
 * 5. Repeat until target duration reached
 */
async function extendVideoToMatchAudio(
  initialVideoPath: string,
  targetDuration: number,
  prompt: string,
  sceneNumber: number,
  teamId: number,
): Promise<string> {
  let currentVideoPath = initialVideoPath;
  let currentDuration = getMediaDuration(initialVideoPath);

  console.log(
    `[Video Extension] Scene ${sceneNumber}: Video ${currentDuration.toFixed(2)}s, target ${targetDuration.toFixed(2)}s`,
  );

  // If video is already long enough, just return it
  if (currentDuration >= targetDuration) {
    return currentVideoPath;
  }

  const videosToMerge: string[] = [currentVideoPath];

  // Keep extending until we have enough video
  while (currentDuration < targetDuration) {
    const neededDuration = targetDuration - currentDuration;
    const extensionDuration: 5 | 10 = neededDuration > 5 ? 10 : 5;

    console.log(
      `[Video Extension] Scene ${sceneNumber}: Extending by ${extensionDuration}s (need ${neededDuration.toFixed(2)}s more)`,
    );

    // Extract last frame from current video
    const lastFramePath = extractLastFrame(currentVideoPath, sceneNumber);

    // Upload last frame to S3 for Kling
    const lastFrameBuffer = fs.readFileSync(lastFramePath);
    const lastFrameKey = `teams/${teamId}/ugc/extension-frames/frame_${sceneNumber}_${Date.now()}.png`;
    await s3Service.uploadBuffer(lastFrameBuffer, lastFrameKey, "image/png");
    const lastFrameUrl = await s3Service.getPresignedUrl(lastFrameKey, 3600);

    console.log(
      `[Video Extension] Scene ${sceneNumber}: Last frame extracted, generating continuation`,
    );

    // Generate extension video using last frame + same prompt
    const { videoUrl: extensionVideoUrl } =
      await klingService.generateVideoWithRetry({
        imageUrl: lastFrameUrl,
        prompt: `${prompt} ${SCREEN_STABILITY_MODIFIERS}`,
        duration: extensionDuration,
        negativePrompt: PRODUCT_NEGATIVE_PROMPT,
      });

    // Download extension video
    const extensionVideoPath = path.join(
      OUTPUT_DIR,
      `extension_${sceneNumber}_${Date.now()}.mp4`,
    );
    await s3Service.downloadVideoFromUrl(extensionVideoUrl, extensionVideoPath);

    // Cleanup last frame
    if (fs.existsSync(lastFramePath)) fs.unlinkSync(lastFramePath);

    videosToMerge.push(extensionVideoPath);
    currentDuration += extensionDuration;
    currentVideoPath = extensionVideoPath;

    console.log(
      `[Video Extension] Scene ${sceneNumber}: Now have ${currentDuration.toFixed(2)}s of video`,
    );
  }

  if (videosToMerge.length > 1) {
    const mergedPath = path.join(
      OUTPUT_DIR,
      `merged_extended_${sceneNumber}_${Date.now()}.mp4`,
    );
    mergeUGCClips(videosToMerge, mergedPath);

    // Cleanup extension segments (keep original)
    for (let i = 1; i < videosToMerge.length; i++) {
      if (fs.existsSync(videosToMerge[i])) fs.unlinkSync(videosToMerge[i]);
    }

    console.log(
      `[Video Extension] Scene ${sceneNumber}: Merged ${videosToMerge.length} segments`,
    );
    return mergedPath;
  }

  return currentVideoPath;
}

/**
 * Combine silent video with audio track.
 * Ensures video and audio are synced and trimmed to audio duration.
 */
function combineVideoAudio(
  videoPath: string,
  audioPath: string,
  audioDuration: number,
  sceneNumber: number,
): string {
  const outputPath = path.join(
    OUTPUT_DIR,
    `combined_${sceneNumber}_${Date.now()}.mp4`,
  );
  const cmd = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -t ${audioDuration.toFixed(3)} \
    ${VIDEO_ENCODE_SETTINGS} \
    -c:a aac -ar ${AUDIO_SAMPLE_RATE} -ac ${AUDIO_CHANNELS} -b:a ${AUDIO_BITRATE} \
    -map 0:v:0 -map 1:a:0 -avoid_negative_ts make_zero "${outputPath}"`;
  console.log(
    `[FFmpeg] Scene ${sceneNumber}: Combining video + audio (${audioDuration.toFixed(2)}s)`,
  );
  execSync(cmd, { stdio: "pipe" });

  return outputPath;
}

/**
 * Mix ambient sound effect into video at specified volume level.
 * Used for A-roll scenes to add realistic background audio.
 * Volume is set to 35% for clearly audible background ambience.
 */
function mixAmbientAudio(
  videoPath: string,
  ambientAudioPath: string,
  sceneNumber: number,
  ambientVolume: number = 0.35,
): string {
  const outputPath = path.join(
    OUTPUT_DIR,
    `ambient_mixed_${sceneNumber}_${Date.now()}.mp4`,
  );
  const videoDuration = getMediaDuration(videoPath);
  const cmd = `ffmpeg -y -i "${videoPath}" -stream_loop -1 -i "${ambientAudioPath}" \
    -filter_complex "[1:a]volume=${ambientVolume},afade=t=in:st=0:d=0.5,afade=t=out:st=${(videoDuration - 0.5).toFixed(3)}:d=0.5[ambient];[0:a][ambient]amix=inputs=2:duration=first:dropout_transition=2[aout]" \
    -map 0:v:0 -map "[aout]" \
    -c:v copy \
    -c:a aac -ar ${AUDIO_SAMPLE_RATE} -ac ${AUDIO_CHANNELS} -b:a ${AUDIO_BITRATE} \
    -t ${videoDuration.toFixed(3)} \
    "${outputPath}"`;

  console.log(
    `[FFmpeg] Scene ${sceneNumber}: Mixing ambient audio at ${(ambientVolume * 100).toFixed(0)}% volume`,
  );
  execSync(cmd, { stdio: "pipe" });

  return outputPath;
}

/**
 * Process A-Roll scene using VEED Fabric 1.0 (text-to-video with built-in TTS).
 * Single-step: image + text → video with built-in voice generation and lip-sync.
 * VEED generates audio internally from text, no need for pre-generated audio.
 * Optionally mixes in ambient sound effects for realistic background audio.
 *
 * NOTE: Switched from Kling Avatar v2 for A/B testing. To revert, restore the
 * previous implementation that used klingService.generateAvatarWithRetry.
 */
async function processArollScene(
  scene: SceneVideoData,
  teamId: number,
  scriptId: string,
  voiceId: string,
  onProgress?: (message: string) => void,
  speedBoost: number = SPEECH_SPEED_BOOST,
): Promise<ProcessedScene> {
  const {
    sceneId,
    sceneNumber,
    shotType,
    imageKey,
    cinematicPrompt,
    dialogue,
    action,
    emotion,
    ambientSound,
    sharedAmbientAudioPath,
  } = scene;

  // Generate dialogue audio with ElevenLabs
  onProgress?.(`Scene ${sceneNumber}: Generating dialogue...`);
  const {
    audioPath,
    audioKey,
    duration: audioDuration,
  } = await generateDialogueAudio(
    voiceId,
    dialogue,
    teamId,
    scriptId,
    sceneNumber,
    speedBoost,
  );

  console.log(
    `[UGC Assembly] A-Roll Scene ${sceneNumber}: Audio duration: ${audioDuration.toFixed(2)}s`,
  );
  onProgress?.(`Scene ${sceneNumber}: Generating video with VEED Fabric`);
  const imageUrl = await s3Service.getPresignedUrl(imageKey, 3600);
  const audioUrl = await s3Service.getPresignedUrl(audioKey, 3600);

  // Generate video with VEED Fabric (image + audio -> lip-synced video)
  const { videoUrl: avatarVideoUrl } =
    await veedFabricService.generateFabricVideoWithRetry({
      imageUrl,
      audioUrl,
      resolution: "720p",
    });

  const avatarVideoPath = path.join(
    OUTPUT_DIR,
    `avatar_${sceneNumber}_${Date.now()}.mp4`,
  );
  await s3Service.downloadVideoFromUrl(avatarVideoUrl, avatarVideoPath);

  let processedVideoPath = avatarVideoPath;

  // Step 7: Trim video to exact audio duration
  const trimmedPath = trimVideoToAudio(
    processedVideoPath,
    audioDuration,
    sceneNumber,
  );
  if (fs.existsSync(processedVideoPath) && processedVideoPath !== trimmedPath) {
    fs.unlinkSync(processedVideoPath);
  }
  processedVideoPath = trimmedPath;

  // Step 8: Mix ambient sound if provided (use shared path for consecutive A-rolls)
  console.log(
    `[UGC Assembly] Scene ${sceneNumber}: ambientSound field = "${ambientSound || "NOT SET"}", sharedPath = ${sharedAmbientAudioPath ? "YES" : "NO"}`,
  );

  if (sharedAmbientAudioPath || (ambientSound && ambientSound.trim())) {
    onProgress?.(`Scene ${sceneNumber}: Adding ambient audio...`);

    try {
      let ambientAudioPath: string;
      let shouldDeleteAmbient = false;

      if (sharedAmbientAudioPath && fs.existsSync(sharedAmbientAudioPath)) {
        console.log(
          `[UGC Assembly] Scene ${sceneNumber}: Using shared ambient audio for consecutive A-roll`,
        );
        ambientAudioPath = sharedAmbientAudioPath;
      } else {
        console.log(
          `[UGC Assembly] Scene ${sceneNumber}: Generating ambient sound: "${ambientSound}"`,
        );
        const ambientBuffer = await elevenLabsService.generateSoundEffect({
          text: ambientSound!,
          durationSeconds: audioDuration,
          promptInfluence: 0.3,
        });

        console.log(
          `[UGC Assembly] Scene ${sceneNumber}: Ambient audio generated (${(ambientBuffer.length / 1024).toFixed(1)}KB)`,
        );
        ambientAudioPath = path.join(
          OUTPUT_DIR,
          `ambient_${sceneNumber}_${Date.now()}.mp3`,
        );
        fs.writeFileSync(ambientAudioPath, ambientBuffer);
        shouldDeleteAmbient = true;
      }

      const mixedVideoPath = mixAmbientAudio(
        processedVideoPath,
        ambientAudioPath,
        sceneNumber,
      );
      if (
        fs.existsSync(processedVideoPath) &&
        processedVideoPath !== mixedVideoPath
      ) {
        fs.unlinkSync(processedVideoPath);
      }
      if (shouldDeleteAmbient && fs.existsSync(ambientAudioPath)) {
        fs.unlinkSync(ambientAudioPath);
      }

      processedVideoPath = mixedVideoPath;
      console.log(
        `[UGC Assembly] Scene ${sceneNumber}: Ambient audio mixed successfully at 35% volume`,
      );
    } catch (error) {
      console.error(
        `[UGC Assembly] Scene ${sceneNumber}: Ambient audio generation failed:`,
        error,
      );
    }
  } else {
    console.log(
      `[UGC Assembly] Scene ${sceneNumber}: No ambient sound configured, skipping`,
    );
  }

  // Cleanup dialogue audio
  if (fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath);
  }

  // Step 9: Upload processed scene
  const videoBuffer = fs.readFileSync(processedVideoPath);
  const videoKey = await s3Service.uploadUGCSceneVideo(
    videoBuffer,
    teamId,
    scriptId,
    sceneNumber,
    "processed",
  );

  console.log(
    `[UGC Assembly] A-Roll Scene ${sceneNumber} complete: ${audioDuration.toFixed(2)}s`,
  );

  return {
    sceneId,
    sceneNumber,
    audioKey,
    videoKey,
    localVideoPath: processedVideoPath,
    duration: audioDuration,
  };
}

/**
 * Process B-Roll scene using Kling 2.6 for product showcase shots.
 * No lip-sync needed for B-roll (product shots, cutaways, etc.)
 *
 * Supports two modes:
 * 1. Single-shot: Standard B-roll with one image → one video
 * 2. Multi-shot montage: bRollShots array → N short videos → concatenated with single voiceover
 *
 * If audio > 10s (single-shot mode), extends video using last-frame continuation technique.
 * Kling 2.6 generates up to 10s video from a single reference image.
 * Final video is trimmed to match exact audio duration.
 */
async function processBrollScene(
  scene: SceneVideoData,
  teamId: number,
  scriptId: string,
  voiceId: string,
  onProgress?: (message: string) => void,
  speedBoost: number = SPEECH_SPEED_BOOST,
): Promise<ProcessedScene> {
  const {
    sceneId,
    sceneNumber,
    shotType,
    imageKey,
    endImageKey,
    cinematicPrompt,
    dialogue,
    action,
    emotion,
    bRollShots,
  } = scene;

  onProgress?.(`Scene ${sceneNumber}: Generating voiceover...`);
  let {
    audioPath,
    audioKey,
    duration: audioDuration,
  } = await generateDialogueAudio(
    voiceId,
    dialogue,
    teamId,
    scriptId,
    sceneNumber,
    speedBoost,
  );

  console.log(
    `[UGC Assembly] B-Roll Scene ${sceneNumber}: Audio duration: ${audioDuration.toFixed(2)}s`,
  );

  let processedVideoPath: string;

  if (bRollShots && bRollShots.length > 0) {
    console.log(
      `[UGC Assembly] B-Roll Scene ${sceneNumber}: Processing ${bRollShots.length}-shot montage`,
    );

    const numShots = bRollShots.length;
    const shotDurations = calculateMontageShots(audioDuration, numShots);

    console.log(
      `[UGC Assembly] Montage: ${numShots} shots, audio ${audioDuration.toFixed(2)}s → durations: [${shotDurations.map(d => d.trim + 's').join(', ')}]`,
    );

    const shotVideoPaths: string[] = [];

    for (let i = 0; i < bRollShots.length; i++) {
      const shot = bRollShots[i];
      const { kling: klingDuration, trim: trimDuration } = shotDurations[i];

      onProgress?.(
        `Scene ${sceneNumber}: Generating montage shot ${i + 1}/${bRollShots.length}...`,
      );

      console.log(
        `[UGC Assembly] Montage shot ${i + 1}: "${shot.action.substring(0, 40)}..." (kling: ${klingDuration}s, trim: ${trimDuration}s)`,
      );

      const shotImageUrl = await s3Service.getPresignedUrl(shot.imageKey, 3600);

      const groundedPrompt = await generateGroundedCinematicPrompt({
        originalCinematicPrompt: shot.cinematicPrompt,
        startImageUrl: shotImageUrl,
        shotType: "b-roll" as ShotType,
        emotion,
        action: shot.action,
      });

      const shotPrompt = buildKlingPrompt(
        groundedPrompt,
        "b-roll" as ShotType,
        emotion,
        shot.action,
      );

      // Use Grok Imagine for B-roll (6s fixed duration, better product shots)
      const { videoUrl: shotVideoUrl } =
        await grokImagineService.generateVideoWithRetry({
          imageUrl: shotImageUrl,
          prompt: groundedPrompt, // Use grounded prompt directly (Grok doesn't need Kling-specific formatting)
        });

      const shotVideoPath = path.join(
        OUTPUT_DIR,
        `montage_shot_${sceneNumber}_${i}_${Date.now()}.mp4`,
      );
      await s3Service.downloadVideoFromUrl(shotVideoUrl, shotVideoPath);

      const trimmedShotPath = path.join(
        OUTPUT_DIR,
        `montage_trimmed_${sceneNumber}_${i}_${Date.now()}.mp4`,
      );
      const trimCmd = `ffmpeg -y -i "${shotVideoPath}" -t ${trimDuration.toFixed(3)} \
        ${VIDEO_ENCODE_SETTINGS} \
        -an -avoid_negative_ts make_zero "${trimmedShotPath}"`;
      execSync(trimCmd, { stdio: "pipe" });

      if (fs.existsSync(shotVideoPath)) {
        fs.unlinkSync(shotVideoPath);
      }

      shotVideoPaths.push(trimmedShotPath);
      console.log(
        `[UGC Assembly] Montage shot ${i + 1} complete: ${trimDuration}s`,
      );
    }

    onProgress?.(`Scene ${sceneNumber}: Concatenating shots...`);
    const concatenatedPath = path.join(
      OUTPUT_DIR,
      `montage_concat_${sceneNumber}_${Date.now()}.mp4`,
    );
    mergeUGCClips(shotVideoPaths, concatenatedPath);

    for (const shotPath of shotVideoPaths) {
      if (fs.existsSync(shotPath)) {
        fs.unlinkSync(shotPath);
      }
    }

    processedVideoPath = concatenatedPath;
    console.log(
      `[UGC Assembly] Montage concatenated: ${getMediaDuration(concatenatedPath).toFixed(2)}s`,
    );
  } else {
    const MAX_SHORTEN_ATTEMPTS = 3;
    let shortenAttempts = 0;
    let currentDialogue = dialogue;

    while (audioDuration > MAX_KLING_VIDEO_DURATION && shortenAttempts < MAX_SHORTEN_ATTEMPTS) {
      shortenAttempts++;
      console.log(
        `[UGC Assembly] B-Roll Scene ${sceneNumber}: Audio ${audioDuration.toFixed(2)}s > ${MAX_KLING_VIDEO_DURATION}s, shortening text (attempt ${shortenAttempts}/${MAX_SHORTEN_ATTEMPTS})`,
      );

      const targetDuration = 8;
      currentDialogue = await shortenDialogueText(
        currentDialogue,
        audioDuration,
        targetDuration,
        sceneNumber,
      );

      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }

      const regenerated = await generateDialogueAudio(
        voiceId,
        currentDialogue,
        teamId,
        scriptId,
        sceneNumber,
        speedBoost,
      );
      audioPath = regenerated.audioPath;
      audioKey = regenerated.audioKey;
      audioDuration = regenerated.duration;

      console.log(
        `[UGC Assembly] B-Roll Scene ${sceneNumber}: Regenerated audio duration: ${audioDuration.toFixed(2)}s`,
      );
    }

    if (audioDuration > MAX_KLING_VIDEO_DURATION) {
      console.warn(
        `[UGC Assembly] B-Roll Scene ${sceneNumber}: Audio still ${audioDuration.toFixed(2)}s after ${MAX_SHORTEN_ATTEMPTS} shortening attempts, proceeding anyway`,
      );
    }

    onProgress?.(`Scene ${sceneNumber}: Generating video...`);
    const imageUrl = await s3Service.getPresignedUrl(imageKey, 3600);

    const tailImageUrl = endImageKey
      ? await s3Service.getPresignedUrl(endImageKey, 3600)
      : undefined;

    if (tailImageUrl) {
      console.log(
        `[UGC Assembly] B-Roll Scene ${sceneNumber}: Using end frame for video interpolation`,
      );
    }

    onProgress?.(`Scene ${sceneNumber}: Analyzing ...`);
    const groundedCinematicPrompt = await generateGroundedCinematicPrompt({
      originalCinematicPrompt: cinematicPrompt,
      startImageUrl: imageUrl,
      endImageUrl: tailImageUrl,
      shotType,
      emotion,
      action,
    });

    const prompt = buildKlingPrompt(
      groundedCinematicPrompt,
      shotType,
      emotion,
      action,
    );

    // Use Grok Imagine for B-roll (6s fixed duration, better product shots)
    const { videoUrl: grokVideoUrl } =
      await grokImagineService.generateVideoWithRetry({
        imageUrl,
        prompt: groundedCinematicPrompt, // Use grounded prompt directly
      });

    console.log(
      `[UGC Assembly] B-Roll Scene ${sceneNumber}: Grok generated 6s video`,
    );

    const silentVideoPath = path.join(
      OUTPUT_DIR,
      `silent_${sceneNumber}_${Date.now()}.mp4`,
    );
    await s3Service.downloadVideoFromUrl(grokVideoUrl, silentVideoPath);

    processedVideoPath = silentVideoPath;
  }

  onProgress?.(`Scene ${sceneNumber}: Adding voiceover...`);
  const combinedPath = combineVideoAudio(
    processedVideoPath,
    audioPath,
    audioDuration,
    sceneNumber,
  );
  if (
    fs.existsSync(processedVideoPath) &&
    processedVideoPath !== combinedPath
  ) {
    fs.unlinkSync(processedVideoPath);
  }
  if (fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath);
  }

  // Step 7: Upload processed scene
  const videoBuffer = fs.readFileSync(combinedPath);
  const videoKey = await s3Service.uploadUGCSceneVideo(
    videoBuffer,
    teamId,
    scriptId,
    sceneNumber,
    "processed",
  );

  console.log(
    `[UGC Assembly] B-Roll Scene ${sceneNumber} complete: ${audioDuration.toFixed(2)}s`,
  );

  return {
    sceneId,
    sceneNumber,
    audioKey,
    videoKey,
    localVideoPath: combinedPath,
    duration: audioDuration,
  };
}

async function processScene(
  scene: SceneVideoData,
  teamId: number,
  scriptId: string,
  voiceId: string,
  onProgress?: (message: string) => void,
  speedBoost: number = SPEECH_SPEED_BOOST,
): Promise<ProcessedScene> {
  if (scene.shotType === "a-roll") {
    return processArollScene(scene, teamId, scriptId, voiceId, onProgress, speedBoost);
  }
  return processBrollScene(scene, teamId, scriptId, voiceId, onProgress, speedBoost);
}

async function processScenesBatch(
  scenes: SceneVideoData[],
  teamId: number,
  scriptId: string,
  voiceId: string,
  onProgress?: (message: string) => void,
  speedBoost: number = SPEECH_SPEED_BOOST,
): Promise<ProcessedScene[]> {
  return Promise.all(
    scenes.map((scene) =>
      processScene(scene, teamId, scriptId, voiceId, onProgress, speedBoost),
    ),
  );
}

async function prepareConsecutiveArollAmbientAudio(
  sortedScenes: SceneVideoData[],
): Promise<Map<number, string>> {
  const sharedAmbientPaths = new Map<number, string>();
  const consecutiveSequences: { start: number; end: number; ambientSound: string }[] = [];

  let sequenceStart: number | null = null;
  let sequenceAmbient: string | null = null;

  for (let i = 0; i < sortedScenes.length; i++) {
    const scene = sortedScenes[i];
    const isAroll = scene.shotType === "a-roll";
    const nextScene = sortedScenes[i + 1];
    const nextIsAroll = nextScene?.shotType === "a-roll";

    if (isAroll && sequenceStart === null) {
      sequenceStart = i;
      sequenceAmbient = scene.ambientSound || null;
    }

    if (sequenceStart !== null && (!nextIsAroll || i === sortedScenes.length - 1)) {
      const sequenceEnd = isAroll ? i : i - 1;
      if (sequenceEnd > sequenceStart && sequenceAmbient) {
        consecutiveSequences.push({
          start: sequenceStart,
          end: sequenceEnd,
          ambientSound: sequenceAmbient,
        });
      }
      sequenceStart = null;
      sequenceAmbient = null;
    }
  }

  for (const seq of consecutiveSequences) {
    const totalDuration = sortedScenes
      .slice(seq.start, seq.end + 1)
      .reduce((sum, s) => sum + s.duration, 0);

    console.log(
      `[UGC Assembly] Generating shared ambient audio for consecutive A-rolls ${seq.start + 1}-${seq.end + 1}: "${seq.ambientSound}" (${totalDuration.toFixed(1)}s)`,
    );

    try {
      const ambientBuffer = await elevenLabsService.generateSoundEffect({
        text: seq.ambientSound,
        durationSeconds: totalDuration + 2,
        promptInfluence: 0.3,
      });

      const sharedPath = path.join(
        OUTPUT_DIR,
        `shared_ambient_${seq.start}_${seq.end}_${Date.now()}.mp3`,
      );
      fs.writeFileSync(sharedPath, ambientBuffer);

      for (let i = seq.start; i <= seq.end; i++) {
        sharedAmbientPaths.set(sortedScenes[i].sceneNumber, sharedPath);
      }
    } catch (error) {
      console.error(`[UGC Assembly] Failed to generate shared ambient audio:`, error);
    }
  }

  return sharedAmbientPaths;
}

export async function assembleUGCVideo(
  options: AssemblyOptions,
): Promise<AssemblyResult> {
  const { teamId, scriptId, voiceId, scenes, onProgress, ttsSpeed } = options;

  // Use provided ttsSpeed or fall back to default SPEECH_SPEED_BOOST
  const effectiveSpeedBoost = ttsSpeed ?? SPEECH_SPEED_BOOST;
  console.log(`[UGC Assembly] Using TTS speed boost: ${effectiveSpeedBoost}x`);

  const totalScenes = scenes.length;
  const processedScenes: ProcessedScene[] = [];

  // CRITICAL: Sort scenes by sceneNumber before processing
  const sortedScenes = [...scenes].sort(
    (a, b) => a.sceneNumber - b.sceneNumber,
  );

  // Pre-generate shared ambient audio for consecutive A-roll sequences
  const sharedAmbientPaths = await prepareConsecutiveArollAmbientAudio(sortedScenes);
  for (const scene of sortedScenes) {
    const sharedPath = sharedAmbientPaths.get(scene.sceneNumber);
    if (sharedPath) {
      scene.sharedAmbientAudioPath = sharedPath;
    }
  }

  console.log(
    `[UGC Assembly] Starting assembly of ${totalScenes} scenes in order: ${sortedScenes.map((s) => s.sceneNumber).join(", ")}`,
  );
  for (let i = 0; i < sortedScenes.length; i += PARALLEL_SCENES) {
    const batch = sortedScenes.slice(i, i + PARALLEL_SCENES);
    const batchNumbers = batch.map((s) => s.sceneNumber).join(", ");
    const baseProgress = 10 + (i / totalScenes) * 60;

    onProgress?.(baseProgress, `Processing scenes ${batchNumbers}...`);
    console.log(`[UGC Assembly] Processing batch: scenes ${batchNumbers}`);

    const batchResults = await processScenesBatch(
      batch,
      teamId,
      scriptId,
      voiceId,
      (msg) => onProgress?.(baseProgress, msg),
      effectiveSpeedBoost,
    );
    processedScenes.push(...batchResults);
  }

  onProgress?.(75, "Concatenating scenes...");

  // CRITICAL: Sort processed scenes by sceneNumber before merging
  const sortedProcessed = processedScenes.sort(
    (a, b) => a.sceneNumber - b.sceneNumber,
  );
  const videoPaths = sortedProcessed.map((s) => s.localVideoPath);

  console.log(
    `[UGC Assembly] Merging ${videoPaths.length} scenes in order: ${sortedProcessed.map((s) => s.sceneNumber).join(", ")}`,
  );
  for (const scene of sortedProcessed) {
    const duration = getMediaDuration(scene.localVideoPath);
    console.log(
      `[UGC Assembly] Scene ${scene.sceneNumber}: ${duration.toFixed(2)}s - ${scene.localVideoPath}`,
    );
  }

  const finalLocalPath = path.join(
    OUTPUT_DIR,
    `final_${scriptId}_${Date.now()}.mp4`,
  );
  mergeUGCClips(videoPaths, finalLocalPath);

  const finalDuration = getMediaDuration(finalLocalPath);
  console.log(`[UGC Assembly] Final video: ${finalDuration.toFixed(2)}s`);

  onProgress?.(90, "Uploading final video...");

  const finalVideoKey = await s3Service.uploadUGCFinalVideoFromFile(
    finalLocalPath,
    teamId,
    scriptId,
  );
  const totalDuration = sortedProcessed.reduce((sum, s) => sum + s.duration, 0);

  onProgress?.(95, "Cleaning up...");

  for (const scene of sortedProcessed) {
    if (fs.existsSync(scene.localVideoPath)) {
      fs.unlinkSync(scene.localVideoPath);
    }
  }
  if (fs.existsSync(finalLocalPath)) {
    fs.unlinkSync(finalLocalPath);
  }

  // Clean up shared ambient audio files
  const cleanedPaths = new Set<string>();
  for (const sharedPath of sharedAmbientPaths.values()) {
    if (!cleanedPaths.has(sharedPath) && fs.existsSync(sharedPath)) {
      fs.unlinkSync(sharedPath);
      cleanedPaths.add(sharedPath);
    }
  }

  onProgress?.(100, "Complete!");

  console.log(
    `[UGC Assembly] Video assembly complete: ${totalDuration.toFixed(2)}s total`,
  );

  return { finalVideoKey, totalDuration, sceneVideos: sortedProcessed };
}

export const ugcVideoAssemblyService = { assembleUGCVideo, processScene };
