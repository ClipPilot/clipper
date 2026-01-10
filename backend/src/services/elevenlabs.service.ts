import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { config } from "../config/env";
import { s3Service } from "./s3.service";

let elevenLabsClient: ElevenLabsClient | null = null;

const getClient = (): ElevenLabsClient => {
  if (!elevenLabsClient) {
    if (!config.elevenlabs.apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }
    elevenLabsClient = new ElevenLabsClient({
      apiKey: config.elevenlabs.apiKey,
    });
  }
  return elevenLabsClient;
};

export interface TextToSpeechOptions {
  voiceId: string;
  text: string;
  modelId?: string;
  outputFormat?: string;
  speed?: number;
}

/**
 * Get audio duration in seconds using ffprobe
 */
function getAudioDuration(audioBuffer: Buffer): number {
  const tempPath = path.join(os.tmpdir(), `audio_${Date.now()}.mp3`);
  try {
    fs.writeFileSync(tempPath, audioBuffer);
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempPath}"`,
      { encoding: "utf-8" }
    );
    return parseFloat(result.trim());
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

export async function generateSpeech(
  options: TextToSpeechOptions
): Promise<Buffer> {
  const client = getClient();

  const {
    voiceId,
    text,
    modelId = "eleven_v3",
    outputFormat = "mp3_44100_128",
    speed,
  } = options;

  const speedInfo = speed ? ` at ${speed}x speed` : "";
  console.log(
    `[ElevenLabs] Generating speech for ${text.length} chars with voice ${voiceId}${speedInfo}`
  );

  try {
    const requestOptions: any = {
      text,
      modelId,
      outputFormat,
    };

    if (speed && speed !== 1.0) {
      requestOptions.speed = speed;
    }

    const audioStream = await client.textToSpeech.convert(
      voiceId,
      requestOptions
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    console.log(
      `[ElevenLabs] Generated ${(audioBuffer.length / 1024).toFixed(1)}KB of audio`
    );

    return audioBuffer;
  } catch (error) {
    console.error("[ElevenLabs] TTS generation failed:", error);
    throw error;
  }
}

export interface GenerateAndUploadOptions extends TextToSpeechOptions {
  teamId: number;
  scriptId: string;
  sceneNumber: number;
}

export async function generateSpeechAndUpload(
  options: GenerateAndUploadOptions
): Promise<{ s3Key: string; durationMs?: number }> {
  const { teamId, scriptId, sceneNumber, ...ttsOptions } = options;
  const audioBuffer = await generateSpeech(ttsOptions);
  const s3Key = await s3Service.uploadTTSAudio(
    audioBuffer,
    teamId,
    scriptId,
    sceneNumber
  );

  console.log(
    `[ElevenLabs] Generated and uploaded scene ${sceneNumber} audio: ${s3Key}`
  );

  return { s3Key };
}

export interface SpeechToSpeechOptions {
  voiceId: string;
  audioBuffer: Buffer;
  modelId?: string;
  removeBackgroundNoise?: boolean;
}

export async function speechToSpeech(
  options: SpeechToSpeechOptions
): Promise<Buffer> {
  const client = getClient();

  const { voiceId, audioBuffer, modelId = "eleven_english_sts_v2" } = options;

  console.log(
    `[ElevenLabs] Converting speech to voice ${voiceId} (${(audioBuffer.length / 1024).toFixed(1)}KB input)`
  );

  try {
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

    const convertedStream = await client.speechToSpeech.convert(voiceId, {
      audio: audioBlob,
      model_id: modelId,
      voice_settings: {
        stability: 0.37,
        similarity_boost: 0.75,
      },
      output_format: "mp3_44100_128",
    } as any);

    const chunks: Uint8Array[] = [];
    for await (const chunk of convertedStream) {
      chunks.push(chunk);
    }
    const convertedBuffer = Buffer.concat(chunks);

    console.log(
      `[ElevenLabs] Speech converted: ${(convertedBuffer.length / 1024).toFixed(1)}KB output`
    );

    return convertedBuffer;
  } catch (error) {
    console.error("[ElevenLabs] Speech-to-Speech conversion failed:", error);
    throw error;
  }
}

export interface GenerateSpeechForDurationOptions extends TextToSpeechOptions {
  targetDurationSeconds: number;
  tolerancePercent?: number;
}

/**
 * Generate speech that matches a target duration by adjusting speed.
 * Uses a two-pass approach: generate at normal speed, measure, then regenerate with adjusted speed.
 */
export async function generateSpeechForTargetDuration(
  options: GenerateSpeechForDurationOptions
): Promise<{ audioBuffer: Buffer; actualDuration: number; speedUsed: number }> {
  const {
    targetDurationSeconds,
    tolerancePercent = 10,
    ...ttsOptions
  } = options;
  console.log(
    `[ElevenLabs] Generating speech with target duration: ${targetDurationSeconds}s`
  );
  const normalAudio = await generateSpeech(ttsOptions);
  const naturalDuration = getAudioDuration(normalAudio);
  console.log(
    `[ElevenLabs] Natural speech duration: ${naturalDuration.toFixed(2)}s`
  );
  const durationDiff = Math.abs(naturalDuration - targetDurationSeconds);
  const diffPercent = (durationDiff / targetDurationSeconds) * 100;
  if (diffPercent <= tolerancePercent) {
    console.log(
      `[ElevenLabs] Duration within ${tolerancePercent}% tolerance, using normal speed`
    );
    return {
      audioBuffer: normalAudio,
      actualDuration: naturalDuration,
      speedUsed: 1.0,
    };
  }
  let speed = naturalDuration / targetDurationSeconds;
  speed = Math.max(0.25, Math.min(4.0, speed));

  console.log(
    `[ElevenLabs] Regenerating at ${speed.toFixed(2)}x speed to match ${targetDurationSeconds}s target`
  );

  const adjustedAudio = await generateSpeech({ ...ttsOptions, speed });
  const adjustedDuration = getAudioDuration(adjustedAudio);

  console.log(
    `[ElevenLabs] Adjusted speech duration: ${adjustedDuration.toFixed(2)}s (target: ${targetDurationSeconds}s)`
  );

  return {
    audioBuffer: adjustedAudio,
    actualDuration: adjustedDuration,
    speedUsed: speed,
  };
}

export interface GenerateAndUploadForDurationOptions extends GenerateSpeechForDurationOptions {
  teamId: number;
  scriptId: string;
  sceneNumber: number;
}

/**
 * Generate speech matching target duration and upload to S3
 */
export async function generateSpeechAndUploadForDuration(
  options: GenerateAndUploadForDurationOptions
): Promise<{ s3Key: string; actualDuration: number; speedUsed: number }> {
  const { teamId, scriptId, sceneNumber, ...genOptions } = options;

  const { audioBuffer, actualDuration, speedUsed } =
    await generateSpeechForTargetDuration(genOptions);

  const s3Key = await s3Service.uploadTTSAudio(
    audioBuffer,
    teamId,
    scriptId,
    sceneNumber
  );

  console.log(
    `[ElevenLabs] Generated and uploaded scene ${sceneNumber} audio: ${s3Key} (${actualDuration.toFixed(2)}s at ${speedUsed.toFixed(2)}x)`
  );

  return { s3Key, actualDuration, speedUsed };
}

export interface DialogueInput {
  text: string;
  voiceId: string;
}

export interface TextToDialogueOptions {
  inputs: DialogueInput[];
  modelId?: string;
  outputFormat?: string;
}

/**
 * Generate expressive dialogue audio using ElevenLabs Text-to-Dialogue API.
 * Supports voice direction tags like [whispering], [excited], [sad], etc.
 * Perfect for B-roll voiceovers with emotional expression.
 */
export async function textToDialogue(
  options: TextToDialogueOptions
): Promise<Buffer> {
  const client = getClient();

  const {
    inputs,
    modelId = "eleven_v3",
    outputFormat = "mp3_44100_128",
  } = options;

  const totalChars = inputs.reduce((sum, i) => sum + i.text.length, 0);
  console.log(
    `[ElevenLabs] Generating dialogue for ${inputs.length} input(s), ${totalChars} total chars`
  );

  try {
    const audioStream = await client.textToDialogue.convert({
      inputs: inputs.map((input) => ({
        text: input.text,
        voiceId: input.voiceId,
      })),
      modelId,
      outputFormat: outputFormat as any,
    } as any);

    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    console.log(
      `[ElevenLabs] Generated dialogue: ${(audioBuffer.length / 1024).toFixed(1)}KB of audio`
    );

    return audioBuffer;
  } catch (error) {
    console.error("[ElevenLabs] Text-to-Dialogue generation failed:", error);
    throw error;
  }
}

export interface TextToDialogueForDurationOptions {
  text: string;
  voiceId: string;
  targetDurationSeconds: number;
  tolerancePercent?: number;
  modelId?: string;
  outputFormat?: string;
}

/**
 * Generate dialogue audio matching a target duration.
 * Uses voice direction tags for expressive B-roll voiceovers.
 */
export async function textToDialogueForTargetDuration(
  options: TextToDialogueForDurationOptions
): Promise<{ audioBuffer: Buffer; actualDuration: number }> {
  const {
    text,
    voiceId,
    targetDurationSeconds,
    tolerancePercent = 15,
    modelId,
    outputFormat,
  } = options;

  console.log(
    `[ElevenLabs] Generating dialogue with target duration: ${targetDurationSeconds}s`
  );

  const audioBuffer = await textToDialogue({
    inputs: [{ text, voiceId }],
    modelId,
    outputFormat,
  });

  const actualDuration = getAudioDuration(audioBuffer);
  console.log(
    `[ElevenLabs] Dialogue duration: ${actualDuration.toFixed(2)}s (target: ${targetDurationSeconds}s)`
  );

  const durationDiff = Math.abs(actualDuration - targetDurationSeconds);
  const diffPercent = (durationDiff / targetDurationSeconds) * 100;

  if (diffPercent > tolerancePercent) {
    console.log(
      `[ElevenLabs] Warning: Dialogue duration ${actualDuration.toFixed(2)}s is ${diffPercent.toFixed(1)}% off target ${targetDurationSeconds}s`
    );
  }

  return { audioBuffer, actualDuration };
}

export interface GenerateDialogueAndUploadOptions {
  text: string;
  voiceId: string;
  teamId: number;
  scriptId: string;
  sceneNumber: number;
  targetDurationSeconds: number;
  tolerancePercent?: number;
}

/**
 * Generate expressive dialogue audio and upload to S3.
 * Uses Text-to-Dialogue API for B-roll with voice direction tags.
 */
export async function generateDialogueAndUpload(
  options: GenerateDialogueAndUploadOptions
): Promise<{ s3Key: string; actualDuration: number }> {
  const { teamId, scriptId, sceneNumber, ...dialogueOptions } = options;

  const { audioBuffer, actualDuration } =
    await textToDialogueForTargetDuration(dialogueOptions);

  const s3Key = await s3Service.uploadTTSAudio(
    audioBuffer,
    teamId,
    scriptId,
    sceneNumber
  );

  console.log(
    `[ElevenLabs] Generated and uploaded dialogue scene ${sceneNumber}: ${s3Key} (${actualDuration.toFixed(2)}s)`
  );

  return { s3Key, actualDuration };
}

export const elevenLabsService = {
  generateSpeech,
  generateSpeechAndUpload,
  generateSpeechForTargetDuration,
  generateSpeechAndUploadForDuration,
  speechToSpeech,
  textToDialogue,
  textToDialogueForTargetDuration,
  generateDialogueAndUpload,
  getAudioDuration,
};
