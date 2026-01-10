import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
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
}

export async function generateSpeech(
  options: TextToSpeechOptions
): Promise<Buffer> {
  const client = getClient();

  const {
    voiceId,
    text,
    modelId = "eleven_multilingual_v2",
    outputFormat = "mp3_44100_128",
  } = options;

  console.log(
    `[ElevenLabs] Generating speech for ${text.length} chars with voice ${voiceId}`
  );

  try {
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text,
      modelId,
      outputFormat: outputFormat as any,
    });

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

  const {
    voiceId,
    audioBuffer,
    modelId = "eleven_english_sts_v2",
    removeBackgroundNoise = true,
  } = options;

  console.log(
    `[ElevenLabs] Converting speech to voice ${voiceId} (${(audioBuffer.length / 1024).toFixed(1)}KB input)`
  );

  try {
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

    const convertedStream = await client.speechToSpeech.convert(voiceId, {
      audio: audioBlob,
      model_id: modelId,
      remove_background_noise: removeBackgroundNoise,
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

export const elevenLabsService = {
  generateSpeech,
  generateSpeechAndUpload,
  speechToSpeech,
};
