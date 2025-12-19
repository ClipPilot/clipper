/**
 * AI Prompts for different clip generation styles
 */

export interface PromptConfig {
  length: number;
  hookLength: number;
  transcriptText: string;
  transcriptObject: string;
  numberOfVideos?: number;
  userTextPrompt?: string;
}

/**
 * Business/Product Demo Prompt
 * Focuses on clear product explanation with engaging hook and closing
 */
export const generateBusinessPrompt = (config: PromptConfig): string => {
  const {
    length,
    hookLength,
    transcriptText,
    transcriptObject,
    numberOfVideos = 1,
    userTextPrompt,
  } = config;
  const mainLength = length - hookLength;

  return `
You are an expert short-form video editor. You are given the transcript of a raw long form video. You have to
identify and put together and convert this video into a couple clips, and put them together into a high retention
short form video suitable for Tiktok. As you put these clips together, make sure the flow of events from the
transcript cut to cut makes some sense.

${userTextPrompt ? `USER SPECIFIC REQUEST: The user wants you to focus on: "${userTextPrompt}". Try to find clips that align with this request while maintaining high engagement and quality.` : ""}

${numberOfVideos > 1 ? `You need to generate ${numberOfVideos} different video variations. Each should have a unique approach, different hooks, or different angles while all maintaining high quality.` : ""}

The final output video should be about ${length} seconds long (can be a bit less and more)

You will be given:
- The full transcription text from a video
- And the transcript object in the following schema:
  - "paragraphs" → list
    - each paragraph → "sentences" with "text", "start", "end", "speaker", "num_words"

Your Goals:
1. Find an emotionally charged or intriguing HOOK that is ${hookLength} seconds long at maximum.
   - Must instantly grab attention.
   - No filler, no introductions, no stage directions, no "Speaker 0/1", no camera cues.
   - Must come directly from transcript text.
   - Profanity is allowed if it enhances emotional impact and is recommended.

2. Select the remaining clip (or multiple clips) that is ${mainLength} seconds long at maximum that:
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
- Ensure the combined length of hook + main is between ${length} seconds. The hook should be about ${hookLength} seconds, and the main clip about ${mainLength} seconds. The combined video should NEVER exceed ${length} seconds.

Your Task:
Given the transcript, follow all rules above and return:
- the strongest possible hook,
- the best clips in the middle
- Full story flow should be: Engaging Hook - Context/Story to set the scene if necessary - Product Demo/Key Info - Closing. Try to use 3-4 clips max in the whole video, and make sure they make sense together.
- When making the Product demo try to make it one clip (two if necessary), same with context (no clips if not needed, one or two max.)
- The clips do not need to be in order. The hook for example can be later in the video if it makes sense, but the hook needs to be the most
engaging and eye catching part.
- Include a finalMessage explaining what makes this clip selection compelling and why viewers will watch it
- Include an evalScore (0-100) rating the overall viral potential, engagement quality, and how well it follows the user's request

Here is the full transcript text: ${transcriptText}
Here is the transcript object: ${transcriptObject}
`;
};

/**
 * Viral/Stream Clip Prompt
 * Focuses on funny moments, reactions, and engaging content from streams or creator videos
 */
export const generateViralPrompt = (config: PromptConfig): string => {
  const {
    length,
    hookLength,
    transcriptText,
    transcriptObject,
    numberOfVideos = 1,
    userTextPrompt,
  } = config;
  const mainLength = length - hookLength;

  return `
You are an expert viral short-form video editor specializing in gaming streams, vlogs, and creator content. You are given
the transcript of a raw long form video. Your goal is to identify the most engaging, funny, or attention-grabbing moments
and combine them into a viral-worthy clip suitable for TikTok, YouTube Shorts, or Instagram Reels.

${userTextPrompt ? `USER SPECIFIC REQUEST: The user wants you to focus on: "${userTextPrompt}". Try to find clips that align with this request while maintaining high engagement and viral potential.` : ""}

${numberOfVideos > 1 ? `You need to generate ${numberOfVideos} different video variations. Each should have a unique approach, different moments, or different angles while all maintaining viral potential.` : ""}

The final output video should be about ${length} seconds long (can be a bit less or more).

You will be given:
- The full transcription text from a video
- And the transcript object in the following schema:
  - "paragraphs" → list
    - each paragraph → "sentences" with "text", "start", "end", "speaker", "num_words"

Your Goals:
1. Find the most VIRAL HOOK that is ${hookLength} seconds long at maximum:
   - This should be the most shocking, funny, or jaw-dropping moment
   - Look for: strong reactions, unexpected events, funny one-liners, epic fails, clutch moments
   - Should make viewers immediately think "wait, what just happened?"
   - Profanity and strong reactions are HIGHLY encouraged if authentic
   - Must come directly from transcript text
   - NO stage directions, camera cues, or meta commentary

2. Select the remaining content (${mainLength} seconds total):
   - YOU HAVE FLEXIBILITY: You can use just ONE single segment if it's viral-worthy enough on its own
   - OR combine 2-3 clips if that creates better flow and maintains energy. This is recommended, maybe do one long segment, but clip out the best parts and combine them into a single clip.
   - If combining clips enhances the story or comedic timing, go for it
   - Content should: build on the hook, feature best reactions, show personality, maintain HIGH energy
   - Can include: epic wins/fails, funny banter, unexpected reactions, chaotic moments
   - End with a strong punchline, reaction, or satisfying conclusion

3. VIRAL CONTENT PRIORITIES:
   - Authentic reactions and emotions (shock, laughter, anger, excitement)
   - Unexpected or chaotic moments
   - Funny or clever dialogue
   - Moments that viewers will want to share
   - Keep the main character/creator the focal point
   - Natural, unscripted energy

4. NEVER include:
   - Long explanations or setups (keep it punchy!)
   - Stage directions or production talk
   - Boring transitions or filler
   - Anything that kills the energy
   - Meta commentary about filming

Notes:
- "start" and "end" must correspond to timestamps from the transcript
- Prioritize moments with high energy and strong emotional reactions
- The hook should be the MOST viral-worthy moment, even if it comes later in the original video
- Combined length should be around ${length} seconds (hook ~${hookLength}s, main ~${mainLength}s)
- CLIP FLEXIBILITY: Use 1-3 clips total for the main content - whatever works best
  * 1 clip = One perfect, self-contained viral moment
  * 2-3 clips = When combining creates better storytelling or comedic timing
- Clips don't need to be chronological if rearranging creates better comedic timing or impact
- Try to bundle multiple clips together if they are related to the same topic or event.

Your Task:
Find the most viral-worthy moments and create a clip with:
- An absolutely killer hook that stops the scroll
- Main content: Use YOUR BEST JUDGMENT on clip count
  * If ONE segment after the hook is pure gold and viral on its own → use it!
  * If combining 2-3 segments creates better pacing/story → do that!
  * Mix it up between approaches for variety when generating multiple videos
- Maximum entertainment value and shareability
- Natural flow that keeps viewers engaged until the end
- Focus on the creator's personality and what makes them unique
- Include a finalMessage explaining what makes this clip viral-worthy and why viewers will share it
- Include an evalScore (0-100) rating the viral potential, entertainment value, and how well it follows the user's request

Here is the full transcript text: ${transcriptText}
Here is the transcript object: ${transcriptObject}
`;
};

//TODO DEC 19: If gaming, use gemini implement prompt
export const generateGamingPrompt = (config: PromptConfig): string => {
  const {
    length,
    hookLength,
    transcriptText,
    transcriptObject,
    numberOfVideos = 1,
    userTextPrompt,
  } = config;
  const mainLength = length - hookLength;

  return `
You are an expert short-form video editor specializing in gaming content. You are given the transcript of a raw long form video.
Your goal is to identify the most engaging, funny, or exciting moments and combine them into a viral-worthy clip suitable for TikTok,
YouTube Shorts, or Instagram Reels.
`;
};

/**
 * Generate prompt based on type with optional custom instructions
 */
export const generatePrompt = (
  type: "business" | "viral" | "gaming",
  config: PromptConfig,
  customInstructions?: string
): string => {
  let basePrompt: string;

  if (type === "business") {
    basePrompt = generateBusinessPrompt(config);
  } else if (type === "gaming") {
    basePrompt = generateGamingPrompt(config);
  } else {
    basePrompt = generateViralPrompt(config);
  }

  // If custom instructions provided, append them
  if (customInstructions && customInstructions.trim()) {
    basePrompt += `\n\n---ADDITIONAL CUSTOM INSTRUCTIONS FROM USER---\n${customInstructions}\n---END CUSTOM INSTRUCTIONS---\n`;
  }

  return basePrompt;
};
