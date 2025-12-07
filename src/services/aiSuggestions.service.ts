import OpenAI from "openai";
import { ENV } from "../config/env";
import { SyncPrerecordedResponse } from "@deepgram/sdk";

const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
export const generateClipSuggestionsService = async (
  transcription: SyncPrerecordedResponse
) => {
  const prompt = `
You are an expert short-form video editor trained to convert long videos into high-retention TikTok clips.

You will be given:
- The full transcription text from a video
- And the transcript object in the following schema:
  - "paragraphs" → list
    - each paragraph → "sentences" with "text", "start", "end", "speaker", "num_words"

Your Goals:
1. Find an emotionally charged or intriguing HOOK (3 seconds max).
   - Must instantly grab attention.
   - No filler, no introductions, no stage directions, no "Speaker 0/1", no camera cues.
   - Must come directly from transcript text (verbatim unless minor grammar cleaning).

2. Create a smooth, natural transition from the hook into the rest of the content.

3. Select the remaining clip (up to 20-30 seconds total) that:
   - Explains the story or product clearly
   - Removes interruptions, off-camera commentary, and irrelevant tangents
   - Maintains narrative tension or informational clarity

4. NEVER include:
   - stage directions
   - descriptions of filming or production
   - meta commentary
   - anything not spoken in the transcript

Your Output Format:
Return JSON structured as:

{
  "hook": {
    "text": "Final edited hook text for TikTok",
    "start": 0.00,
    "end": 5.00
  },
  "main": {
    "text": "The remaining edited, cleaned clip that explains the story or product clearly while being engaging.",
    "start": 5.00,
    "end": 35.00
  },
  "combined_script": "Hook + main clip text merged into one TikTok script."
}

Notes:
- "start" and "end" must correspond to timestamps from the transcript.
- No clips should have off-camera cues such as "cut", "scene", meta-filming talk, etc.

Your Task:
Given the transcript, follow all rules above and return:
- the strongest possible hook,
- the best main clip,
- and the combined TikTok script (hook + main).

Here is the full transcript text: ${transcription.results.channels[0].alternatives[0].transcript}
Here is the transcript object: ${JSON.stringify(transcription.results.channels[0].alternatives[0].paragraphs)}
`;

  const completion = await client.chat.completions.create({
    model: "gpt-5.1",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content;
};
