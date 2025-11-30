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


export const generateClipSuggestionsService = async (transcription: {
  text: string;
  words: OpenAI.Audio.Transcriptions.TranscriptionWord[] | undefined;
  segments: OpenAI.Audio.Transcriptions.TranscriptionSegment[] | undefined;
}) => {

  const prompt = `
You are a short-form video editor AI.

Given the transcript + timestamps, pick:
1. The BEST hook (3-15 seconds) in the video that grabs attention. 
2. The BEST main-content segment (45-60 seconds) that represents the core information.

Return JSON ONLY in this format:

{
  "hook": {
    "start": <seconds>,
    "end": <seconds>,
    "text": "<clip transcript>"
  },
  "main": {
    "start": <seconds>,
    "end": <seconds>,
    "text": "<clip transcript>"
  }
}

Rules:
- Hook should be emotionally strong, controversial, surprising, or instantly engaging.
- Main section should be educational, insightful, or the key point.
- YOU MUST use timestamps from the segments array.
- Do NOT fabricate text. Use the real transcript.
  
---

TRANSCRIPT:
${transcription.text}

TIMESTAMPS JSON:
${JSON.stringify(transcription.segments)}
  `;

  const completion = await client.chat.completions.create({
    model: "gpt-5.1",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }]
  });

  return completion.choices[0].message.content;
};


export const editVideoService = async (clipSuggestions: string) => {
  const clipSuggestionsJSON = JSON.parse(clipSuggestions);
  console.log("Clip Suggestions:", clipSuggestionsJSON);
}
