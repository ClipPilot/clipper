import fs from "fs";
import OpenAI from "openai";
import { ENV } from "../config/env";
import { extractAudio } from "../utils/extractAudio";
import { deepgram } from "../config/deepgram";

const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

export const transcribeVideoService = async (filePath: string) => {
  console.log("Extracting audio from video...");
  const audioPath = await extractAudio(filePath);

  console.log("Transcribing audio...");
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    fs.readFileSync(audioPath),
    {
      model: "nova-3",
      smart_format: true,
      punctuate: true,
      diarize: true,
      paragraphs: true,
      detect_language: true,
    }
  );
  console.log("Transcription result:", result);

  if (error) {
    console.error("Deepgram transcription error:", error);
    throw new Error("Transcription failed");
  }

  console.log("Cleaning up files...");

  fs.unlinkSync(audioPath);

  console.log("Transcribing completed!");

  return result;
};
