import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { s3Service } from "./s3.service";
import { elevenLabsService } from "./elevenlabs.service";
import { klingService, buildKlingPrompt, ShotType } from "./kling.service";

const MAX_AUDIO_DURATION = 10;
const PARALLEL_SCENES = 2;

// Standard audio format for all UGC clips - ensures consistency during merge
const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_CHANNELS = 2;
const AUDIO_BITRATE = "192k";

/**
 * Normalize a video clip to have consistent video and audio parameters.
 * This is CRITICAL for proper concatenation - all clips must have identical streams.
 */
function normalizeClipForMerge(inputPath: string, sceneNumber: number): string {
  const outputPath = path.join(OUTPUT_DIR, `normalized_${sceneNumber}_${Date.now()}.mp4`);

  // Re-encode both video AND audio to ensure consistency
  const cmd = `ffmpeg -y -i "${inputPath}" \
    -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -r 30 \
    -c:a aac -ar ${AUDIO_SAMPLE_RATE} -ac ${AUDIO_CHANNELS} -b:a ${AUDIO_BITRATE} \
    -avoid_negative_ts make_zero -fflags +genpts \
    "${outputPath}"`;

  console.log(`[FFmpeg] Normalizing scene ${sceneNumber} for merge...`);
  execSync(cmd, { stdio: "pipe" });

  return outputPath;
}

/**
 * Merge multiple video clips with properly normalized audio.
 * All clips are first normalized to identical parameters, then concatenated.
 */
function mergeUGCClips(clips: string[], outputPath: string): void {
  console.log(`[MERGE] Merging ${clips.length} UGC clips...`);

  // Step 1: Normalize all clips to consistent format
  const normalizedPaths: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const normalizedPath = normalizeClipForMerge(clips[i], i + 1);
    normalizedPaths.push(normalizedPath);
    const duration = getMediaDuration(normalizedPath);
    console.log(`[MERGE] Normalized clip ${i + 1}: ${duration.toFixed(2)}s`);
  }

  // Step 2: Create concat list file
  const listPath = path.join(OUTPUT_DIR, `concat_list_${Date.now()}.txt`);
  const listContent = normalizedPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  fs.writeFileSync(listPath, listContent);

  // Step 3: Concatenate using concat demuxer with stream copy (safe because all normalized)
  const cmd = `ffmpeg -y -f concat -safe 0 -i "${listPath}" \
    -c copy -movflags +faststart \
    "${outputPath}"`;

  console.log(`[MERGE] Concatenating ${normalizedPaths.length} normalized clips...`);
  execSync(cmd, { stdio: "pipe" });

  // Step 4: Cleanup normalized files and list
  fs.unlinkSync(listPath);
  for (const normPath of normalizedPaths) {
    if (fs.existsSync(normPath)) fs.unlinkSync(normPath);
  }

  console.log(`[MERGE] Complete: ${outputPath}`);
}

export interface SceneVideoData {
  sceneId: string;
  sceneNumber: number;
  shotType: ShotType;
  imageKey: string;
  dialogue: string;
  duration: number;
  cinematicPrompt: string;
  action: string;
  emotion: string;
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
      { encoding: "utf-8" }
    );
    return parseFloat(result.trim());
  } catch (error) {
    console.error("[FFmpeg] Failed to get media duration:", error);
    return 0;
  }
}

/**
 * Speed up audio using FFmpeg atempo filter to fit within max duration.
 * atempo supports 0.5x to 2.0x, so we chain filters if needed for higher speeds.
 */
function speedUpAudio(inputPath: string, targetDuration: number, sceneNumber: number): { outputPath: string; finalDuration: number } {
  const currentDuration = getMediaDuration(inputPath);

  if (currentDuration <= targetDuration) {
    return { outputPath: inputPath, finalDuration: currentDuration };
  }

  const speedFactor = currentDuration / targetDuration;
  console.log(`[FFmpeg] Scene ${sceneNumber}: Speeding up audio ${currentDuration.toFixed(2)}s -> ${targetDuration}s (${speedFactor.toFixed(2)}x)`);

  // atempo filter supports 0.5 to 2.0, chain multiple if needed
  let atempoFilters: string[] = [];
  let remainingSpeed = speedFactor;

  while (remainingSpeed > 1.0) {
    const thisSpeed = Math.min(remainingSpeed, 2.0);
    atempoFilters.push(`atempo=${thisSpeed.toFixed(4)}`);
    remainingSpeed = remainingSpeed / thisSpeed;
  }

  const filterChain = atempoFilters.join(",");
  const outputPath = path.join(OUTPUT_DIR, `audio_speed_${sceneNumber}_${Date.now()}.mp3`);

  const cmd = `ffmpeg -y -i "${inputPath}" -filter:a "${filterChain}" -vn "${outputPath}"`;
  execSync(cmd, { stdio: "pipe" });

  const finalDuration = getMediaDuration(outputPath);
  console.log(`[FFmpeg] Scene ${sceneNumber}: Audio sped up to ${finalDuration.toFixed(2)}s`);

  // Clean up original if different
  if (inputPath !== outputPath && fs.existsSync(inputPath)) {
    fs.unlinkSync(inputPath);
  }

  return { outputPath, finalDuration };
}

/**
 * Generate audio using ElevenLabs Dialogue API (expressive TTS).
 * If audio exceeds max duration, speed it up with FFmpeg.
 */
async function generateDialogueAudio(
  voiceId: string,
  text: string,
  teamId: number,
  scriptId: string,
  sceneNumber: number
): Promise<{ audioPath: string; audioKey: string; duration: number }> {
  console.log(`[UGC Assembly] Scene ${sceneNumber}: Generating dialogue audio...`);

  // Generate expressive dialogue audio
  const { audioBuffer, actualDuration } = await elevenLabsService.textToDialogueForTargetDuration({
    voiceId,
    text,
    targetDurationSeconds: MAX_AUDIO_DURATION,
    tolerancePercent: 50, // Allow some tolerance, we'll speed up if needed
  });

  // Save to temp file
  const tempAudioPath = path.join(OUTPUT_DIR, `dialogue_${sceneNumber}_${Date.now()}.mp3`);
  fs.writeFileSync(tempAudioPath, audioBuffer);

  let finalAudioPath = tempAudioPath;
  let finalDuration = actualDuration;

  // Speed up if exceeds max duration
  if (actualDuration > MAX_AUDIO_DURATION) {
    const speedResult = speedUpAudio(tempAudioPath, MAX_AUDIO_DURATION, sceneNumber);
    finalAudioPath = speedResult.outputPath;
    finalDuration = speedResult.finalDuration;
  }

  // Upload to S3
  const audioBuffer2 = fs.readFileSync(finalAudioPath);
  const audioKey = await s3Service.uploadTTSAudio(audioBuffer2, teamId, scriptId, sceneNumber);

  console.log(`[UGC Assembly] Scene ${sceneNumber}: Dialogue audio ready - ${finalDuration.toFixed(2)}s`);

  return { audioPath: finalAudioPath, audioKey, duration: finalDuration };
}

/**
 * Trim video to exact audio duration, ensuring no frozen frames.
 * Uses -t flag to cut at exact duration.
 */
function trimVideoToAudio(videoPath: string, audioDuration: number, sceneNumber: number): string {
  const videoDuration = getMediaDuration(videoPath);

  if (videoDuration < audioDuration) {
    console.warn(`[FFmpeg] Scene ${sceneNumber}: Video (${videoDuration.toFixed(2)}s) shorter than audio (${audioDuration.toFixed(2)}s)!`);
  }

  const outputPath = path.join(OUTPUT_DIR, `trimmed_${sceneNumber}_${Date.now()}.mp4`);

  // Trim to exact duration with consistent audio encoding
  const cmd = `ffmpeg -y -i "${videoPath}" -t ${audioDuration.toFixed(3)} \
    -c:v libx264 -preset fast -crf 23 \
    -c:a aac -ar ${AUDIO_SAMPLE_RATE} -ac ${AUDIO_CHANNELS} -b:a ${AUDIO_BITRATE} \
    -avoid_negative_ts make_zero "${outputPath}"`;
  console.log(`[FFmpeg] Scene ${sceneNumber}: Trimming video to ${audioDuration.toFixed(2)}s`);
  execSync(cmd, { stdio: "pipe" });

  return outputPath;
}

/**
 * Combine silent video with audio track.
 * Ensures video and audio are synced and trimmed to audio duration.
 */
function combineVideoAudio(videoPath: string, audioPath: string, audioDuration: number, sceneNumber: number): string {
  const outputPath = path.join(OUTPUT_DIR, `combined_${sceneNumber}_${Date.now()}.mp4`);

  // Map video from first input, audio from second, trim to audio duration
  // Use consistent audio encoding for proper concatenation
  const cmd = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -t ${audioDuration.toFixed(3)} \
    -c:v libx264 -preset fast -crf 23 \
    -c:a aac -ar ${AUDIO_SAMPLE_RATE} -ac ${AUDIO_CHANNELS} -b:a ${AUDIO_BITRATE} \
    -map 0:v:0 -map 1:a:0 -avoid_negative_ts make_zero "${outputPath}"`;
  console.log(`[FFmpeg] Scene ${sceneNumber}: Combining video + audio (${audioDuration.toFixed(2)}s)`);
  execSync(cmd, { stdio: "pipe" });

  return outputPath;
}

/**
 * Process A-Roll scene: dialogue audio -> silent video -> lip-sync -> trim
 */
async function processArollScene(
  scene: SceneVideoData,
  teamId: number,
  scriptId: string,
  voiceId: string,
  onProgress?: (message: string) => void
): Promise<ProcessedScene> {
  const { sceneId, sceneNumber, shotType, imageKey, cinematicPrompt, dialogue, action, emotion } = scene;

  // Step 1: Generate dialogue audio with ElevenLabs
  onProgress?.(`Scene ${sceneNumber}: Generating dialogue...`);
  const { audioPath, audioKey, duration: audioDuration } = await generateDialogueAudio(
    voiceId, dialogue, teamId, scriptId, sceneNumber
  );

  // Step 2: Determine Kling video duration (5s or 10s based on audio)
  const klingDuration: 5 | 10 = audioDuration <= 5 ? 5 : 10;
  console.log(`[UGC Assembly] A-Roll Scene ${sceneNumber}: audio ${audioDuration.toFixed(2)}s -> Kling ${klingDuration}s`);

  // Step 3: Generate SILENT video with Kling
  onProgress?.(`Scene ${sceneNumber}: Generating video...`);
  const imageUrl = await s3Service.getPresignedUrl(imageKey, 3600);
  const prompt = buildKlingPrompt(cinematicPrompt, shotType, emotion, action);

  const { videoUrl: silentVideoUrl } = await klingService.generateVideoWithRetry({
    imageUrl,
    prompt,
    duration: klingDuration,
    generateAudio: false, // NO audio from Kling
  });

  // Step 4: Apply lip-sync with ElevenLabs audio
  onProgress?.(`Scene ${sceneNumber}: Applying lip-sync...`);
  const audioUrl = await s3Service.getPresignedUrl(audioKey, 3600);
  const { videoUrl: lipsyncVideoUrl } = await klingService.applyLipsyncWithRetry({
    videoUrl: silentVideoUrl,
    audioUrl,
  });

  // Step 5: Download lip-synced video
  const lipsyncVideoPath = path.join(OUTPUT_DIR, `lipsync_${sceneNumber}_${Date.now()}.mp4`);
  await s3Service.downloadVideoFromUrl(lipsyncVideoUrl, lipsyncVideoPath);

  // Step 6: Trim video to match audio duration exactly
  const trimmedPath = trimVideoToAudio(lipsyncVideoPath, audioDuration, sceneNumber);

  // Cleanup temp files
  if (fs.existsSync(lipsyncVideoPath) && lipsyncVideoPath !== trimmedPath) {
    fs.unlinkSync(lipsyncVideoPath);
  }
  if (fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath);
  }

  // Step 7: Upload processed scene
  const videoBuffer = fs.readFileSync(trimmedPath);
  const videoKey = await s3Service.uploadUGCSceneVideo(videoBuffer, teamId, scriptId, sceneNumber, "processed");

  console.log(`[UGC Assembly] A-Roll Scene ${sceneNumber} complete: ${audioDuration.toFixed(2)}s`);

  return { sceneId, sceneNumber, audioKey, videoKey, localVideoPath: trimmedPath, duration: audioDuration };
}

/**
 * Process B-Roll scene: dialogue audio -> silent video -> combine audio track -> trim
 * No lip-sync needed for B-roll (product shots, cutaways, etc.)
 */
async function processBrollScene(
  scene: SceneVideoData,
  teamId: number,
  scriptId: string,
  voiceId: string,
  onProgress?: (message: string) => void
): Promise<ProcessedScene> {
  const { sceneId, sceneNumber, shotType, imageKey, cinematicPrompt, dialogue, action, emotion } = scene;

  // Step 1: Generate dialogue audio with ElevenLabs
  onProgress?.(`Scene ${sceneNumber}: Generating voiceover...`);
  const { audioPath, audioKey, duration: audioDuration } = await generateDialogueAudio(
    voiceId, dialogue, teamId, scriptId, sceneNumber
  );

  // Step 2: Determine Kling video duration
  const klingDuration: 5 | 10 = audioDuration <= 5 ? 5 : 10;
  console.log(`[UGC Assembly] B-Roll Scene ${sceneNumber}: audio ${audioDuration.toFixed(2)}s -> Kling ${klingDuration}s`);

  // Step 3: Generate SILENT video with Kling
  onProgress?.(`Scene ${sceneNumber}: Generating video...`);
  const imageUrl = await s3Service.getPresignedUrl(imageKey, 3600);
  const prompt = buildKlingPrompt(cinematicPrompt, shotType, emotion, action);

  const { videoUrl: silentVideoUrl } = await klingService.generateVideoWithRetry({
    imageUrl,
    prompt,
    duration: klingDuration,
    generateAudio: false, // NO audio from Kling
  });

  // Step 4: Download silent video
  const silentVideoPath = path.join(OUTPUT_DIR, `silent_${sceneNumber}_${Date.now()}.mp4`);
  await s3Service.downloadVideoFromUrl(silentVideoUrl, silentVideoPath);

  // Step 5: Combine video with audio track and trim to audio duration
  onProgress?.(`Scene ${sceneNumber}: Adding voiceover...`);
  const combinedPath = combineVideoAudio(silentVideoPath, audioPath, audioDuration, sceneNumber);

  // Cleanup temp files
  if (fs.existsSync(silentVideoPath)) fs.unlinkSync(silentVideoPath);
  if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

  // Step 6: Upload processed scene
  const videoBuffer = fs.readFileSync(combinedPath);
  const videoKey = await s3Service.uploadUGCSceneVideo(videoBuffer, teamId, scriptId, sceneNumber, "processed");

  console.log(`[UGC Assembly] B-Roll Scene ${sceneNumber} complete: ${audioDuration.toFixed(2)}s`);

  return { sceneId, sceneNumber, audioKey, videoKey, localVideoPath: combinedPath, duration: audioDuration };
}

async function processScene(
  scene: SceneVideoData,
  teamId: number,
  scriptId: string,
  voiceId: string,
  onProgress?: (message: string) => void
): Promise<ProcessedScene> {
  if (scene.shotType === "a-roll") {
    return processArollScene(scene, teamId, scriptId, voiceId, onProgress);
  }
  return processBrollScene(scene, teamId, scriptId, voiceId, onProgress);
}

async function processScenesBatch(
  scenes: SceneVideoData[],
  teamId: number,
  scriptId: string,
  voiceId: string,
  onProgress?: (message: string) => void
): Promise<ProcessedScene[]> {
  return Promise.all(
    scenes.map(scene => processScene(scene, teamId, scriptId, voiceId, onProgress))
  );
}

export async function assembleUGCVideo(options: AssemblyOptions): Promise<AssemblyResult> {
  const { teamId, scriptId, voiceId, scenes, onProgress } = options;

  const totalScenes = scenes.length;
  const processedScenes: ProcessedScene[] = [];

  // CRITICAL: Sort scenes by sceneNumber before processing
  const sortedScenes = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);

  console.log(`[UGC Assembly] Starting assembly of ${totalScenes} scenes in order: ${sortedScenes.map(s => s.sceneNumber).join(", ")}`);

  // Process scenes in batches of PARALLEL_SCENES
  for (let i = 0; i < sortedScenes.length; i += PARALLEL_SCENES) {
    const batch = sortedScenes.slice(i, i + PARALLEL_SCENES);
    const batchNumbers = batch.map(s => s.sceneNumber).join(", ");
    const baseProgress = 10 + (i / totalScenes) * 60;

    onProgress?.(baseProgress, `Processing scenes ${batchNumbers}...`);
    console.log(`[UGC Assembly] Processing batch: scenes ${batchNumbers}`);

    const batchResults = await processScenesBatch(batch, teamId, scriptId, voiceId, (msg) =>
      onProgress?.(baseProgress, msg)
    );

    // Add results maintaining scene order
    processedScenes.push(...batchResults);
  }

  onProgress?.(75, "Concatenating scenes...");

  // CRITICAL: Sort processed scenes by sceneNumber before merging
  const sortedProcessed = processedScenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
  const videoPaths = sortedProcessed.map((s) => s.localVideoPath);

  console.log(`[UGC Assembly] Merging ${videoPaths.length} scenes in order: ${sortedProcessed.map(s => s.sceneNumber).join(", ")}`);

  // Log each video's duration for debugging
  for (const scene of sortedProcessed) {
    const duration = getMediaDuration(scene.localVideoPath);
    console.log(`[UGC Assembly] Scene ${scene.sceneNumber}: ${duration.toFixed(2)}s - ${scene.localVideoPath}`);
  }

  const finalLocalPath = path.join(OUTPUT_DIR, `final_${scriptId}_${Date.now()}.mp4`);
  mergeUGCClips(videoPaths, finalLocalPath);

  const finalDuration = getMediaDuration(finalLocalPath);
  console.log(`[UGC Assembly] Final video: ${finalDuration.toFixed(2)}s`);

  onProgress?.(90, "Uploading final video...");

  const finalVideoKey = await s3Service.uploadUGCFinalVideoFromFile(finalLocalPath, teamId, scriptId);
  const totalDuration = sortedProcessed.reduce((sum, s) => sum + s.duration, 0);

  onProgress?.(95, "Cleaning up...");

  // Cleanup all temp files
  for (const scene of sortedProcessed) {
    if (fs.existsSync(scene.localVideoPath)) {
      fs.unlinkSync(scene.localVideoPath);
    }
  }
  if (fs.existsSync(finalLocalPath)) {
    fs.unlinkSync(finalLocalPath);
  }

  onProgress?.(100, "Complete!");

  console.log(`[UGC Assembly] Video assembly complete: ${totalDuration.toFixed(2)}s total`);

  return { finalVideoKey, totalDuration, sceneVideos: sortedProcessed };
}

export const ugcVideoAssemblyService = { assembleUGCVideo, processScene };
