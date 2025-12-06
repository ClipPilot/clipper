import OpenAI from "openai";
import { ENV } from "../config/env";

const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
export const generateClipSuggestionsService = async (transcription: {
  text: string;
  words: OpenAI.Audio.Transcriptions.TranscriptionWord[] | undefined;
  segments: OpenAI.Audio.Transcriptions.TranscriptionSegment[] | undefined;
}) => {

  const prompt = `
You are a short-form video editor AI.

Given the transcript + timestamps, pick:
1. The BEST hook (3-15 seconds) in the video that grabs attention. 
2. The BEST main-content segment (45-60 seconds) that represents the core information. Make sure not to include any stage directions or non-verbal cues.

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
- Make sure the video clips flow together well and makes sense.
  
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