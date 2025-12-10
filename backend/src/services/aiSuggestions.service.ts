import OpenAI from "openai";
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";
import { ENV } from "../config/env";
import { SyncPrerecordedResponse } from "@deepgram/sdk";
import { ClipSuggestionsSchema } from "../types/ai.types";

// TODO 4 PIECES, SETTING TEH SCENE, ENDING IT. EDIT PROMPT. SENTIMENT ANALYSIS.

const LENGTH = 40;
const HOOK_LENGTH = 6;

const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

export const generateClipSuggestionsService = async (
  transcription: SyncPrerecordedResponse
) => {
  const prompt = `
You are an expert short-form video editor. You are given the transcript of a raw long form video. You have to 
identify and put together and convert this video into a couple clips, and put them together into a high retention
short form video suitable for Tiktok. As you put these clips together, make sure the flow of events from the
transcript cut to cut makes some sense. 

The final output video should be about ${LENGTH} seconds long (can be a bit less and more)


You will be given:
- The full transcription text from a video
- And the transcript object in the following schema:
  - "paragraphs" → list
    - each paragraph → "sentences" with "text", "start", "end", "speaker", "num_words"

Your Goals:
1. Find an emotionally charged or intriguing HOOK that is ${HOOK_LENGTH} seconds long at maximum.
   - Must instantly grab attention.
   - No filler, no introductions, no stage directions, no "Speaker 0/1", no camera cues.
   - Must come directly from transcript text.
   - Profanity is allowed if it enhances emotional impact and is recommended.

2. Select the remaining clip (or multiple clips) that is ${LENGTH - HOOK_LENGTH} seconds long at maximum that:
   - Explains the story or product clearly
   - Removes interruptions, off-camera commentary, and irrelevant tangents
   - Maintains narrative tension or informational clarity
   - If relevant, before the product demo, include a brief setup to explain the story or context
   - Last clip should be a closing statement that wraps up the skit, can be emotional and engaging like the hook.

3. NEVER include:
   - stage directions
   - descriptions of filming or production
   - meta commentary
   - anything not spoken in the transcript

Notes:
- "start" and "end" must correspond to timestamps from the transcript.
- No clips should have off-camera cues such as "cut", "scene", meta-filming talk, etc.
- Ensure the combined length of hook + main is between ${LENGTH} seconds. The hook should be about ${HOOK_LENGTH} seconds, and the main clip about ${LENGTH - HOOK_LENGTH} seconds. The combined video should NEVER exceed 40 seconds.

Your Task:
Given the transcript, follow all rules above and return:
- the strongest possible hook,
- the best clips in the middle 
- Full story flow should be: Engaging Hook - Context/Story to set the scene if necessary - Product Demo/Key Info - Closing. Try to use 3-4 clips max in the whole video, and make sure they make sense together. 
- When making the Product demo try to make it one clip (two if necessary), same with context (no clips if not needed, one or two max.)
- The clips do not need to be in order. The hook for example can be later in the video if it makes sense, but the hook needs to be the most
engaging and eye catching part.
Here is the full transcript text: ${transcription.results.channels[0].alternatives[0].transcript}
Here is the transcript object: ${JSON.stringify(transcription.results.channels[0].alternatives[0].paragraphs)}
`;

  const response = await client.responses.parse({
    model: "gpt-5.1",
    reasoning: { effort: "medium" },
    input: [
      {
        role: "user",
        content: prompt,
      },
    ],
    text: {
      format: zodTextFormat(ClipSuggestionsSchema, "clip_suggestions"),
    },
  });
  console.log("AI Clip Suggestions Response:", response.output_parsed);
  return response.output_parsed;
};
