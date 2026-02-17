import { PromptType } from "../constants/promptTypes";

export interface PromptConfig {
  length: number;
  hookLength: number;
  transcriptText?: string;
  transcriptObject?: string;
  numberOfVideos?: number;
  userTextPrompt?: string;
  isBatch?: boolean;
  batchTranscripts?: Array<{
    videoIndex: number;
    transcriptText: string;
    transcriptObject: string;
    fileName?: string;
  }>;
}

// Batch prompt addon template
export const BATCH_ADDON_TEMPLATE = `
===== BATCH VIDEO MODE =====
You have access to MULTIPLE SOURCE VIDEOS. Each video has been transcribed separately.

SOURCE VIDEOS:
{{VIDEO_LIST}}

CRITICAL BATCH INSTRUCTIONS:
1. You can select the HOOK from ANY of the source videos - choose the most engaging moment across all videos
2. You can MIX segments from DIFFERENT source videos in the main content
3. Each segment MUST include a "sourceVideoIndex" field (0, 1, 2, etc.) to identify which video it comes from
4. Create cohesive clips that combine the BEST moments from all available videos
5. The narrative should flow naturally even when combining multiple sources
6. Label your selections clearly so we know which video each segment originates from
7. MINIMUM SEGMENT LENGTH: Each segment must be AT LEAST 0.5 seconds long - NEVER suggest shorter segments

EXAMPLE OUTPUT FORMAT FOR BATCH:
{
  "hook": {
    "text": "This is the hook text",
    "start": 45.5,
    "end": 51.2,
    "sourceVideoIndex": 0
  },
  "main": [
    {
      "text": "First main segment",
      "start": 12.0,
      "end": 25.5,
      "sourceVideoIndex": 1
    },
    {
      "text": "Second main segment",
      "start": 88.3,
      "end": 102.1,
      "sourceVideoIndex": 0
    }
  ],
  "combined_script": "...",
  "finalMessage": "...",
  "evalScore": 85,
  "clipTitle": "..."
}

Think of yourself as a curator selecting the best moments from a collection of related footage.
===== END BATCH MODE =====
`;

/**
 * Business/Product Demo Prompt
 * Focuses on clear product explanation with engaging hook and closing
 */
export const generateBusinessPrompt = (config: PromptConfig): string => {
  const {
    length,
    hookLength,
    transcriptText = "",
    transcriptObject = "",
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

${numberOfVideos > 1 ? `
===== MULTIPLE VARIATIONS (${numberOfVideos} REQUIRED) =====
You MUST generate ${numberOfVideos} COMPLETELY DIFFERENT clips from this video. Each variation must tell a DIFFERENT story using DIFFERENT parts of the video.

CRITICAL RULES FOR VARIATIONS:
- Each variation MUST use a DIFFERENT hook from a DIFFERENT part of the video. NO two variations can share the same hook timestamp range.
- Each variation MUST use DIFFERENT main segments. NO timestamp ranges should overlap between variations.
- Think of each variation as a SEPARATE editor making their own independent clip from the same raw footage.
- Each variation should follow a different narrative angle, storyline, or theme found in the video.
- If the video covers multiple topics, each variation should focus on a different topic.
- If the video has one main topic, each variation should highlight a different aspect, argument, or moment.
- NEVER reuse the same clip across variations unless the user explicitly asks for it.

VARIATION PLANNING: Before selecting clips, identify ${numberOfVideos} distinct compelling storylines or moments in the transcript, then build each variation around a different one.
===== END VARIATION RULES =====
` : ""}

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

CRITICAL TIMESTAMP RULES:
- "end" MUST BE GREATER THAN "start" - ALWAYS (end > start)
- MINIMUM SEGMENT LENGTH: Each segment (hook and main) must be AT LEAST 0.5 seconds long
- Hook should be ${hookLength}-${hookLength + 2} seconds long, NEVER shorter than 0.5 seconds
- Each main segment should be at least 2 seconds long
- Round timestamps to 1 decimal place

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
    transcriptText = "",
    transcriptObject = "",
    numberOfVideos = 1,
    userTextPrompt,
  } = config;
  const mainLength = length - hookLength;

  return `
You are an expert viral short-form video editor specializing in gaming streams, vlogs, and creator content. You are given
the transcript of a raw long form video. Your goal is to identify the most engaging, funny, or attention-grabbing moments
and combine them into a viral-worthy clip suitable for TikTok, YouTube Shorts, or Instagram Reels.

${userTextPrompt ? `USER SPECIFIC REQUEST: The user wants you to focus on: "${userTextPrompt}". Try to find clips that align with this request while maintaining high engagement and viral potential.` : ""}

${numberOfVideos > 1 ? `
===== MULTIPLE VARIATIONS (${numberOfVideos} REQUIRED) =====
You MUST generate ${numberOfVideos} COMPLETELY DIFFERENT viral clips from this video. Each must showcase a DIFFERENT moment.

CRITICAL RULES FOR VARIATIONS:
- Each variation MUST use a DIFFERENT hook from a DIFFERENT part of the video. NO two variations can share the same hook timestamp range.
- Each variation MUST use DIFFERENT main segments. NO timestamp ranges should overlap between variations.
- Think of each variation as a SEPARATE editor picking their own favorite viral moment from the same raw footage.
- Each variation should center around a different funny/shocking/engaging moment in the video.
- NEVER reuse the same clip across variations unless the user explicitly asks for it.
- If the video has 5 great moments, pick a different one for each variation — don't pick the "best" one 5 times.

VARIATION PLANNING: Before selecting clips, identify ${numberOfVideos} distinct viral-worthy moments across the full transcript, then build each variation around a different one.
===== END VARIATION RULES =====
` : ""}

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

CRITICAL TIMESTAMP RULES:
- "end" MUST BE GREATER THAN "start" - ALWAYS (end > start)
- MINIMUM SEGMENT LENGTH: Each segment (hook and main) must be AT LEAST 0.5 seconds long
- Hook should be ${hookLength}-${hookLength + 2} seconds long, NEVER shorter than 0.5 seconds
- Each main segment should be at least 2 seconds long
- Round timestamps to 1 decimal place

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

${numberOfVideos > 1 ? `
===== MULTIPLE VARIATIONS (${numberOfVideos} REQUIRED) =====
CRITICAL: Each of the ${numberOfVideos} clips MUST showcase a COMPLETELY DIFFERENT gameplay moment.

- Each variation MUST use a DIFFERENT hook from a DIFFERENT part of the video. NO two variations can share the same hook or climax.
- Each variation MUST use DIFFERENT main segments. NO timestamp ranges should overlap between variations.
- Think of each variation as highlighting a different play, fight, round, or epic moment.
- If the video has a clutch play at 5:00 and a funny fail at 12:00 — those are TWO separate variations, not one clip used twice.
- NEVER reuse the same gameplay moment across variations unless the user explicitly asks for it.
- PLAN FIRST: Scan the entire video and list ${numberOfVideos} distinct peak moments, THEN build each variation around a different one.
===== END VARIATION RULES =====
` : `Generate 1 clip highlighting the most exciting moment.`}

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

===== CRITICAL TIMESTAMP RULES =====

YOU MUST FOLLOW THESE RULES FOR EVERY SEGMENT:

1. TIMESTAMPS ARE IN SECONDS (e.g., 1904.5 means 31 minutes 44.5 seconds into the video)
2. "end" MUST BE GREATER THAN "start" - ALWAYS (end > start)
3. MINIMUM SEGMENT LENGTH: Each segment must be AT LEAST 0.5 seconds long (end - start >= 0.5)
4. Hook should be ${hookLength}-${hookLength + 2} seconds long, NEVER shorter than 0.5 seconds
5. Each main segment should be 5-20 seconds long
6. DO NOT use timestamps beyond the video length
7. Round timestamps to 1 decimal place (e.g., 1904.5, not 1904.523)

VERIFY BEFORE SUBMITTING:
- Hook: end - start >= ${hookLength} seconds
- Each Main segment: end - start >= 2 seconds
- Total duration (hook + all main segments) ≈ ${length} seconds

===== FINAL RULES =====
- The "text" fields should describe VISUAL ACTION not dialogue
- MAIN MUST have 2-3 segments minimum, and the LAST segment should include/overlap with hook timestamps
- Main segments can be from DIFFERENT parts of the video (montage style) to tell a better story
- evalScore: 90+ = insane clip, 80-89 = great clip, 70-79 = good clip
- Each video MUST be approximately ${length} seconds total - ADD MORE SEGMENTS if too short!
- If you can't find ${numberOfVideos} genuinely exciting moments, return fewer but better clips

DOUBLE-CHECK: For EACH segment, verify end > start and duration >= 0.5 seconds!
`;
};

/**
 * General Long-Form Content Prompt
 * Focuses on finding the most engaging hooks and viral-worthy moments from any video
 * Uses Gemini with video upload for visual + audio analysis
 */
export const generateGeneralPrompt = (config: PromptConfig): string => {
  const {
    length,
    hookLength,
    transcriptText = "",
    transcriptObject = "",
    numberOfVideos = 1,
    userTextPrompt,
  } = config;
  const mainLength = length - hookLength;

  return `
You are an expert short-form video editor. You are analyzing a VIDEO to find the most VISUALLY and EMOTIONALLY engaging moments.

CRITICAL: WATCH THE ENTIRE VIDEO FRAME BY FRAME. You must analyze both what you SEE visually and what you HEAR being said. Base your clip selections on the actual video content.

${userTextPrompt ? `USER SPECIFIC REQUEST: "${userTextPrompt}". Prioritize moments that align with this while watching the video.` : ""}

${numberOfVideos > 1 ? `
===== MULTIPLE VARIATIONS (${numberOfVideos} REQUIRED) =====
You MUST generate ${numberOfVideos} COMPLETELY DIFFERENT clips from this video. Each must center on a DIFFERENT visual/emotional moment.

CRITICAL RULES FOR VARIATIONS:
- Each variation MUST use a DIFFERENT hook from a DIFFERENT part of the video. NO two variations can share the same hook timestamp range.
- Each variation MUST use DIFFERENT main segments. NO timestamp ranges should overlap between variations.
- Think of each variation as a SEPARATE editor making their own independent clip from the same raw footage.
- Each variation should follow a different narrative angle, storyline, or key moment found in the video.
- NEVER reuse the same clip across variations unless the user explicitly asks for it.
- PLAN FIRST: Scan the entire video and identify ${numberOfVideos} distinct compelling visual moments, THEN build each variation around a different one.
===== END VARIATION RULES =====
` : ""}

===== HOW TO WATCH THE VIDEO =====

VISUAL CUES TO LOOK FOR:
- Facial expressions: Shock, surprise, laughter, excitement, emotional reactions
- Body language: Leaning in, gesturing emphatically, standing up, physical reactions
- Eye contact: Moments of intense connection with camera or another person
- Movement: Quick actions, demonstrations, reveals, transformations
- Scene changes: Before/after, product reveals, unexpected cuts
- Props/objects: Items being shown, demonstrations, physical evidence
- Environment: Interesting locations, setups, visual backdrops
- On-screen graphics: Text, charts, images that add impact
- Multiple people: Reactions between people, tension, agreement, conflict

AUDIO/ENERGY CUES:
- Voice tone changes: Excitement, emphasis, passion, whispers, shouts
- Laughter: Genuine laughs, audience reactions
- Pauses: Dramatic pauses before reveals
- Music/sound: Background changes that signal important moments
- Reactions: "Oh my god", "Wait what", gasps, exclamations

===== WHAT MAKES A VIRAL HOOK (VISUAL-FIRST) =====

TIER 1 - ALWAYS CLIP THESE:
- VISUAL: Person's face showing genuine shock/excitement/emotion
- VISUAL: A reveal or transformation happening on screen
- VISUAL: Something unexpected or unusual being shown
- VISUAL: Intense eye contact with camera during key statement
- VISUAL: Physical demonstration of something impressive
- VISUAL + AUDIO: Emotional peak with visible reaction

TIER 2 - STRONG CLIPS:
- VISUAL: Confident delivery with strong body language
- VISUAL: Multiple people reacting together
- VISUAL: Before/after comparison shown visually
- VISUAL: Product or object being demonstrated
- VISUAL: Person in an interesting/unusual setting

===== WHAT TO NEVER CLIP =====
- Static talking head with no energy or movement
- Looking away from camera during key points
- Poor lighting or visually uninteresting frames
- Reading from notes or teleprompter obviously
- Intros: "Hey guys welcome back"
- Outros: "Like and subscribe"
- Sponsors or promotional segments
- Long pauses with no visual interest

===== STRUCTURE =====

TARGET: ${length} seconds total
- Hook (~${hookLength}s): The MOST visually compelling moment. This plays FIRST.
- Main (~${mainLength}s): 2-4 segments that build the story with visual interest throughout

HOOK SELECTION (watch the video!):
1. Scan the ENTIRE video visually for peak moments
2. Find where the speaker is MOST animated/expressive
3. Find where something VISUALLY interesting happens
4. The hook should make viewers think "I need to see more"

MAIN CONTENT:
1. Provide context for the hook (can be from earlier in video)
2. Keep visual interest throughout - no boring talking head sections
3. End with satisfaction or another visual hook

===== CRITICAL TIMESTAMP RULES =====

YOU MUST FOLLOW THESE RULES FOR EVERY SEGMENT:

1. TIMESTAMPS ARE IN SECONDS (e.g., 145.5 means 2 minutes 25.5 seconds into the video)
2. "end" MUST BE GREATER THAN "start" - ALWAYS (end > start)
3. MINIMUM SEGMENT LENGTH: Each segment must be AT LEAST 0.5 seconds long (end - start >= 0.5)
4. Hook should be ${hookLength}-${hookLength + 2} seconds long, NEVER shorter than 0.5 seconds
5. Each main segment should be 5-15 seconds long
6. DO NOT use timestamps beyond the video length
7. Round timestamps to 1 decimal place (e.g., 145.5, not 145.523)

VERIFY BEFORE SUBMITTING:
- Hook: end - start >= ${hookLength} seconds
- Each Main segment: end - start >= 2 seconds
- Total duration (hook + all main segments) ≈ ${length} seconds

===== OUTPUT FORMAT =====

Generate ${numberOfVideos} clips. REMINDER: Each clip MUST use completely different timestamps — no overlapping hooks or segments between variations.

{
  "videos": [
    {
      "hook": {
        "text": "Describe what you SEE happening visually in this moment",
        "start": 145.5,
        "end": 151.5
      },
      "main": [
        {
          "text": "Describe the visual action/context in this segment",
          "start": 120.0,
          "end": 140.0
        },
        {
          "text": "Describe what happens visually here",
          "start": 155.0,
          "end": 170.0
        }
      ],
      "combined_script": "Full text of what is said in the final clip",
      "finalMessage": "Explain what VISUAL elements make this clip compelling",
      "evalScore": 85,
      "clipTitle": "Catchy title for this clip"
    }
  ]
}

DOUBLE-CHECK: For EACH segment, verify end > start and duration >= 0.5 seconds!

===== EVALUATION CRITERIA =====
- evalScore 90+: Visually stunning, impossible to scroll past
- evalScore 80-89: Strong visual interest, viewers will watch to end
- evalScore 70-79: Decent visuals but could be stronger
- Below 70: Mostly talking head, limited visual appeal

WATCH THE ENTIRE VIDEO. Find the most compelling visual and audio moments. Create clips people will share.

===== TRANSCRIPT REFERENCE =====
Use this transcript to help identify timestamps and understand what is being said. Cross-reference with what you SEE in the video.

Transcript object schema:
- "paragraphs" → list
  - each paragraph → "sentences" with "text", "start", "end", "speaker", "num_words"

Here is the full transcript text: ${transcriptText}
Here is the transcript object: ${transcriptObject}
`;
};

/**
 * Generate prompt based on type with optional custom instructions
 */
export const generatePrompt = (
  type: PromptType,
  config: PromptConfig,
  customInstructions?: string,
): string => {
  let basePrompt: string;

  if (type === "business") {
    basePrompt = generateBusinessPrompt(config);
  } else if (type === "gaming") {
    basePrompt = generateGamingPrompt(config);
  } else if (type === "general") {
    basePrompt = generateGeneralPrompt(config);
  } else {
    basePrompt = generateViralPrompt(config);
  }

  // If custom instructions provided, append them
  if (customInstructions && customInstructions.trim()) {
    basePrompt += `\n\n---ADDITIONAL CUSTOM INSTRUCTIONS FROM USER---\n${customInstructions}\n---END CUSTOM INSTRUCTIONS---\n`;
  }

  return basePrompt;
};

/**
 * Generate batch-aware prompt that instructs AI to select from multiple source videos
 */
export const generateBatchPrompt = (
  type: PromptType,
  config: PromptConfig,
  customInstructions?: string,
): string => {
  // Generate base prompt first
  let basePrompt = generatePrompt(type, config, customInstructions);

  // If batch mode with multiple transcripts, append batch addon
  if (
    config.isBatch &&
    config.batchTranscripts &&
    config.batchTranscripts.length > 1
  ) {
    // Format the video list with all transcripts
    const videoList = config.batchTranscripts
      .map((bt) => {
        const fileName = bt.fileName ? ` (${bt.fileName})` : "";
        return `
---
VIDEO ${bt.videoIndex + 1}${fileName} (sourceVideoIndex: ${bt.videoIndex}):

Transcript Text:
${bt.transcriptText}

Full Transcript Object:
${bt.transcriptObject}
---`;
      })
      .join("\n");

    // Replace placeholder and append batch addon
    const batchAddon = BATCH_ADDON_TEMPLATE.replace(
      "{{VIDEO_LIST}}",
      videoList,
    );
    basePrompt = basePrompt + "\n\n" + batchAddon;
  }

  return basePrompt;
};
