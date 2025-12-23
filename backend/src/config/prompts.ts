/**
 * AI Prompts for different clip generation styles
 */

import { PromptType } from "../constants/promptTypes";

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

/**
 * Gaming Content Prompt
 * Focuses on visual moments and epic gameplay rather than just transcript
 */
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
You are an expert gaming clip editor. You are analyzing a GAMEPLAY VIDEO to find the most VISUALLY EXCITING moments.

CRITICAL: WATCH THE VIDEO CAREFULLY. Your job is to find PEAK GAMEPLAY MOMENTS based on what you SEE happening on screen.

${userTextPrompt ? `GAME/CONTEXT: "${userTextPrompt}"` : ""}

===== WHAT TO LOOK FOR (WATCH THE ACTUAL GAMEPLAY) =====

TIER 1 - ALWAYS CLIP THESE (highest priority):
- Clutch plays (1v3, 1v4, 1v5, last-second wins)
- Insane kills/multikills (ace, team wipe, collateral)
- Close calls where player nearly dies but survives
- Victory moments (winning the game, tournament, rank-up)
- Epic fails that are funny or shocking
- Unexpected plays that even surprise the player

TIER 2 - GREAT CLIPS:
- Skillful outplays or predictions
- Funny glitches or bugs
- Rage/tilt moments with genuine emotion
- Jump scares or scary moments
- Satisfying combos or sequences
- Teammates making amazing/terrible plays

===== WHAT TO NEVER CLIP =====
HARD REJECT these even if the dialogue sounds interesting:
- Intro segments where player explains what video is about
- Player talking to camera without exciting gameplay
- Loading screens, menus, or queuing
- Slow moments with no action
- Long explanations or tutorials
- "Subscribe" or promotional segments
- Walking/running with nothing happening

===== HOW TO IDENTIFY GOOD MOMENTS =====
Watch for these VISUAL cues:
- Kill feed activity (multiple kills appearing)
- Health bar going critical then surviving
- Score/objective changes (capturing point, getting goal)
- Fast camera movement indicating intense action
- Player celebration/reaction after big play
- Screen effects (damage indicators, ability effects)
- Chat/teammate reactions to plays

Listen for these AUDIO cues that indicate exciting moments:
- Player screaming/yelling in excitement
- "OH MY GOD", "LET'S GO", "NO WAY", "WHAT"
- Genuine laughter or disbelief
- Teammates going crazy in voice chat

===== OUTPUT STRUCTURE =====

TARGET: ${length} seconds total (MUST hit this length!)
- Hook (~${hookLength}s): The PEAK/CLIMAX moment
- Main (~${mainLength}s): Multiple segments that build up to AND include the climax

CRITICAL STRUCTURE:
1. Video STARTS with hook (climax teaser to grab attention)
2. Main segments play (build-up, context, can be from different parts of video)
3. Main ENDS with the climax moment (same timestamps as hook for satisfying payoff)

EXAMPLE: If climax is at 1904-1909s:
- hook: { start: 1904, end: 1909 }  ← climax shown first
- main: [
    { start: 1850, end: 1865 },    ← earlier context/setup
    { start: 1890, end: 1904 },    ← build-up right before climax
    { start: 1904, end: 1910 }     ← climax AGAIN as the payoff ending
  ]

This way viewers see: CLIMAX → "wait what?" → build-up → CLIMAX AGAIN → satisfied!

MAIN CAN BE A MONTAGE: You can pull clips from DIFFERENT parts of the video to tell a story or show multiple related moments leading to the climax. Be creative!

Generate ${numberOfVideos} DIFFERENT clips. Each must be a UNIQUE exciting moment.

===== JSON OUTPUT FORMAT (can have multiple segments in main) =====
{
  "videos": [
    {
      "hook": {
        "text": "Evo Cannon snipes the Archers to secure the win",
        "start": 1904,
        "end": 1909.5
      },
      "main": [
        {
          "text": "Earlier in match - setting up the push with Drill placement",
          "start": 1850,
          "end": 1865
        },
        {
          "text": "Final seconds - frantically spamming troops to break defense",
          "start": 1890,
          "end": 1904
        },
        {
          "text": "The Evo Cannon snipe connects and tower falls",
          "start": 1904,
          "end": 1910
        }
      ],
  ]
}

LENGTH CHECK: Hook (5.5s) + Main (15s + 14s + 6s = 35s) = 40.5s total ✓

===== FINAL RULES =====
- Timestamps are in SECONDS (use transcript for reference: ${transcriptObject})
- The "text" fields should describe VISUAL ACTION not dialogue
- MAIN MUST have 2-3 segments minimum, and the LAST segment should include/overlap with hook timestamps
- Main segments can be from DIFFERENT parts of the video (montage style) to tell a better story
- evalScore: 90+ = insane clip, 80-89 = great clip, 70-79 = good clip
- Each video MUST be approximately ${length} seconds total - ADD MORE SEGMENTS if too short!
- If you can't find ${numberOfVideos} genuinely exciting moments, return fewer but better clips
`;
};

/**
 * Generate prompt based on type with optional custom instructions
 */
export const generatePrompt = (
  type: PromptType,
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
