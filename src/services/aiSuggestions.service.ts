import OpenAI from "openai";
import { ENV } from "../config/env";
import { SyncPrerecordedResponse } from "@deepgram/sdk";

// TODO 4 PIECES, SETTING TEH SCENE, ENDING IT. EDIT PROMPT. SENTIMENT ANALYSIS. 
const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
export const generateClipSuggestionsService = async (
  transcription: SyncPrerecordedResponse
) => {
  const prompt = `
You are an expert short-form video editor trained to convert long videos into high-retention TikTok clips that are 30-40 seconds in length.

You will be given:
- The full transcription text from a video
- And the transcript object in the following schema:
  - "paragraphs" → list
    - each paragraph → "sentences" with "text", "start", "end", "speaker", "num_words"

Your Goals:
1. Find an emotionally charged or intriguing HOOK that is 6 seconds long at maximum.
   - Must instantly grab attention.
   - No filler, no introductions, no stage directions, no "Speaker 0/1", no camera cues.
   - Must come directly from transcript text.
   - Profanity is allowed if it enhances emotional impact and is recommended.

2. Select the remaining clip that is 30 seconds long at maximum that:
   - Explains the story or product clearly
   - Removes interruptions, off-camera commentary, and irrelevant tangents
   - Maintains narrative tension or informational clarity

3. NEVER include:
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
    "end": 3.00
  },
  "main": {
    "text": "The remaining edited, cleaned clip that explains the story or product clearly while being engaging.",
    "start": 3.00,
    "end": 33.00
  },
  "combined_script": "Hook + main clip text merged into one TikTok script."
}

Notes:
- "start" and "end" must correspond to timestamps from the transcript.
- No clips should have off-camera cues such as "cut", "scene", meta-filming talk, etc.
- Ensure the combined length of hook + main is between 25-30 seconds. The hook should be about 3 seconds, and the main clip about 20 seconds. The combined video should NEVER exceed 40 seconds.

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
    reasoning_effort: "low",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content;
};
