import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { s3Service } from "./s3.service";
import { elevenLabsService } from "./elevenlabs.service";
import { klingService, buildKlingPrompt, ShotType } from "./kling.service";
import { mergeClips } from "./videoEditor.service";

const CHARS_PER_SECOND = 12;

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

function estimateDialogueDuration(dialogue: string): number {
  const charCount = dialogue.trim().length;
  return Math.ceil(charCount / CHARS_PER_SECOND);
}

async function extractAudioFromVideo(
  videoPath: string,
  sceneNumber: number
): Promise<string> {
  const outputPath = path.join(OUTPUT_DIR, `extracted_audio_${sceneNumber}_${Date.now()}.mp3`);
  const ffmpegCommand = `ffmpeg -y -i "${videoPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`;

  console.log(`[FFmpeg] Extracting audio from scene ${sceneNumber} video`);
  execSync(ffmpegCommand, { stdio: "pipe" });

  return outputPath;
}

async function processScene(
  scene: SceneVideoData,
  teamId: number,
  scriptId: string,
  voiceId: string,
  onProgress?: (message: string) => void
): Promise<ProcessedScene> {
  const { sceneId, sceneNumber, shotType, imageKey, dialogue, cinematicPrompt, action, emotion } =
    scene;

  const imageUrl = await s3Service.getPresignedUrl(imageKey, 3600);
  const prompt = buildKlingPrompt(cinematicPrompt, shotType, emotion, action);
  const estimatedDuration = estimateDialogueDuration(dialogue);
  const klingDuration: 5 | 10 = estimatedDuration <= 5 ? 5 : 10;

  console.log(
    `[UGC Assembly] Scene ${sceneNumber}: dialogue ~${estimatedDuration}s -> Kling ${klingDuration}s`
  );

  let finalVideoUrl: string;
  let audioKey: string;

  if (shotType === "a-roll") {
    onProgress?.(`Scene ${sceneNumber}: Generating video with speech...`);

    const { videoUrl: klingVideoUrl } = await klingService.generateVideoWithRetry({
      imageUrl,
      prompt,
      duration: klingDuration,
      generateAudio: true,
      dialogue,
    });

    const tempVideoPath = path.join(OUTPUT_DIR, `temp_kling_${sceneNumber}_${Date.now()}.mp4`);
    await s3Service.downloadVideoFromUrl(klingVideoUrl, tempVideoPath);

    onProgress?.(`Scene ${sceneNumber}: Converting voice...`);

    const extractedAudioPath = await extractAudioFromVideo(tempVideoPath, sceneNumber);
    const extractedAudioBuffer = fs.readFileSync(extractedAudioPath);

    const convertedAudioBuffer = await elevenLabsService.speechToSpeech({
      voiceId,
      audioBuffer: extractedAudioBuffer,
    });

    const convertedAudioPath = path.join(
      OUTPUT_DIR,
      `converted_audio_${sceneNumber}_${Date.now()}.mp3`
    );
    fs.writeFileSync(convertedAudioPath, convertedAudioBuffer);

    onProgress?.(`Scene ${sceneNumber}: Finalizing audio...`);

    const outputPath = path.join(OUTPUT_DIR, `final_scene_${sceneNumber}_${Date.now()}.mp4`);
    const ffmpegCommand = `ffmpeg -y -i "${tempVideoPath}" -i "${convertedAudioPath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`;

    console.log(`[FFmpeg] Overlaying converted audio for scene ${sceneNumber}`);
    execSync(ffmpegCommand, { stdio: "pipe" });

    finalVideoUrl = `file://${outputPath}`;

    audioKey = await s3Service.uploadTTSAudio(
      convertedAudioBuffer,
      teamId,
      scriptId,
      sceneNumber
    );

    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    if (fs.existsSync(extractedAudioPath)) fs.unlinkSync(extractedAudioPath);
    if (fs.existsSync(convertedAudioPath)) fs.unlinkSync(convertedAudioPath);

  } else {
    onProgress?.(`Scene ${sceneNumber}: Generating video...`);

    const { videoUrl: rawVideoUrl } = await klingService.generateVideoWithRetry({
      imageUrl,
      prompt,
      duration: klingDuration,
      generateAudio: false,
    });

    onProgress?.(`Scene ${sceneNumber}: Generating expressive voiceover...`);

    const { s3Key, actualDuration } = await elevenLabsService.generateDialogueAndUpload({
      voiceId,
      text: dialogue,
      teamId,
      scriptId,
      sceneNumber,
      targetDurationSeconds: klingDuration,
      tolerancePercent: 20,
    });
    audioKey = s3Key;

    console.log(
      `[UGC Assembly] Scene ${sceneNumber}: Dialogue generated for ${klingDuration}s video (actual: ${actualDuration.toFixed(2)}s)`
    );

    const audioUrl = await s3Service.getPresignedUrl(audioKey, 3600);

    onProgress?.(`Scene ${sceneNumber}: Adding voiceover...`);

    finalVideoUrl = await overlayAudioWithFFmpeg(rawVideoUrl, audioUrl, sceneNumber);
  }

  const localVideoPath = path.join(OUTPUT_DIR, `scene_${sceneNumber}_${Date.now()}.mp4`);

  if (finalVideoUrl.startsWith("file://")) {
    const sourcePath = finalVideoUrl.replace("file://", "");
    fs.renameSync(sourcePath, localVideoPath);
  } else {
    await s3Service.downloadVideoFromUrl(finalVideoUrl, localVideoPath);
  }

  const videoBuffer = fs.readFileSync(localVideoPath);
  const videoKey = await s3Service.uploadUGCSceneVideo(
    videoBuffer,
    teamId,
    scriptId,
    sceneNumber,
    "processed"
  );

  return {
    sceneId,
    sceneNumber,
    audioKey,
    videoKey,
    localVideoPath,
    duration: klingDuration,
  };
}

async function overlayAudioWithFFmpeg(
  videoUrl: string,
  audioUrl: string,
  sceneNumber: number
): Promise<string> {
  const tempVideoPath = path.join(OUTPUT_DIR, `temp_video_${sceneNumber}_${Date.now()}.mp4`);
  const tempAudioPath = path.join(OUTPUT_DIR, `temp_audio_${sceneNumber}_${Date.now()}.mp3`);
  const outputPath = path.join(OUTPUT_DIR, `overlay_${sceneNumber}_${Date.now()}.mp4`);

  try {
    await s3Service.downloadVideoFromUrl(videoUrl, tempVideoPath);

    const audioResponse = await fetch(audioUrl);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    fs.writeFileSync(tempAudioPath, audioBuffer);

    const ffmpegCommand = `ffmpeg -y -i "${tempVideoPath}" -i "${tempAudioPath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`;

    console.log(`[FFmpeg] Overlaying audio for scene ${sceneNumber}`);
    execSync(ffmpegCommand, { stdio: "pipe" });

    return `file://${outputPath}`;
  } finally {
    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
  }
}

export async function assembleUGCVideo(options: AssemblyOptions): Promise<AssemblyResult> {
  const { teamId, scriptId, voiceId, scenes, onProgress } = options;

  const totalScenes = scenes.length;
  const processedScenes: ProcessedScene[] = [];
  const sortedScenes = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);

  for (let i = 0; i < sortedScenes.length; i++) {
    const scene = sortedScenes[i];
    const baseProgress = 10 + (i / totalScenes) * 60;

    onProgress?.(
      baseProgress,
      `Processing scene ${scene.sceneNumber} of ${totalScenes}...`
    );

    const processed = await processScene(scene, teamId, scriptId, voiceId, (msg) =>
      onProgress?.(baseProgress, msg)
    );

    processedScenes.push(processed);
  }

  onProgress?.(75, "Concatenating scenes...");

  const videoPaths = processedScenes
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
    .map((s) => s.localVideoPath);

  const finalLocalPath = path.join(OUTPUT_DIR, `final_${scriptId}_${Date.now()}.mp4`);

  await mergeClips(videoPaths, finalLocalPath);

  onProgress?.(90, "Uploading final video...");

  const finalVideoKey = await s3Service.uploadUGCFinalVideoFromFile(
    finalLocalPath,
    teamId,
    scriptId
  );

  const totalDuration = processedScenes.reduce((sum, s) => sum + s.duration, 0);

  onProgress?.(95, "Cleaning up...");

  for (const scene of processedScenes) {
    if (fs.existsSync(scene.localVideoPath)) {
      fs.unlinkSync(scene.localVideoPath);
    }
  }
  if (fs.existsSync(finalLocalPath)) {
    fs.unlinkSync(finalLocalPath);
  }

  onProgress?.(100, "Complete!");

  return {
    finalVideoKey,
    totalDuration,
    sceneVideos: processedScenes,
  };
}

export const ugcVideoAssemblyService = {
  assembleUGCVideo,
  processScene,
};
