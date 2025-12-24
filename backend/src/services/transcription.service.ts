import fs from "fs";
import OpenAI from "openai";
import { ENV } from "../config/env";
import { extractAudio } from "../utils/extractAudio";
import { deepgram } from "../config/deepgram";
import { SyncPrerecordedResponse } from "@deepgram/sdk";

const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

// Batch transcription result interface
export interface BatchTranscriptionResult {
  videoIndex: number;
  transcription: SyncPrerecordedResponse;
  filePath: string;
}

export const transcribeVideoService = async (filePath: string) => {
  console.log("Extracting audio from video...");
  const audioPath = await extractAudio(filePath);

  console.log("Transcribing audio...");

  // Using OpenAI Whisper API:
  // const resp = await client.audio.transcriptions.create({
  //   file: fs.createReadStream(audioPath),
  //   model: "whisper-1",
  //   response_format: "verbose_json",
  //   timestamp_granularities: ["word"]
  // });

  // TODO : use sentiment 

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    fs.readFileSync(audioPath),
    {
      model: "nova-3",
      smart_format: true,
      punctuate: true,
      diarize: true,
      paragraphs: true,
    }
  );

  if (error) {
    console.error("Deepgram transcription error:", error);
    throw new Error("Transcription failed");
  }

  console.log("Cleaning up files...");

  fs.unlinkSync(audioPath);

  console.log("Transcribing completed!");

  return result;
};

// Transcribe multiple videos in parallel for batch processing
export const transcribeMultipleVideosService = async (
  videoPaths: Array<{ path: string; videoIndex: number }>
): Promise<BatchTranscriptionResult[]> => {
  console.log(`Starting batch transcription for ${videoPaths.length} videos...`);

  const results = await Promise.all(
    videoPaths.map(async ({ path, videoIndex }) => {
      console.log(`Transcribing video ${videoIndex + 1}...`);
      const transcription = await transcribeVideoService(path);
      return {
        videoIndex,
        transcription,
        filePath: path,
      };
    })
  );

  console.log(`Batch transcription completed for ${results.length} videos`);
  return results;
};