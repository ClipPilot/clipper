import fs from "fs";
import OpenAI from "openai";
import { ENV } from "../config/env";
import { extractAudio } from "../utils/extractAudio";

const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

export const transcribeVideoService = async (filePath: string) => {
  console.log("Extracting audio from video...");
  const audioPath = await extractAudio(filePath);

  console.log("Transcribing audio...");
  const resp = await client.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"]
  });

  console.log("Cleaning up files...");

  fs.unlinkSync(audioPath);

  console.log("Transcribing completed!");
  return {
    text: resp.text,
    words: resp.words,
    segments: resp.segments
  };
};
