export interface ScriptStructurePattern {
  type: string;
  shot: string;
  duration: string;
}

export interface UGCScriptPromptConfig {
  productName?: string;
  productDescription?: string;
  productImageDescriptions: string[];
  characterName: string;
  characterGender: string;
  characterAgeRange: string;
  characterAppearance: string;
  scriptDirection?: string;
  targetDuration?: number;
  numberOfVariations?: number;
  structureId?: string;
  customPattern?: { type: string; shot: string }[];
}

const SCRIPT_STRUCTURES: Record<string, { name: string; pattern: ScriptStructurePattern[] }> = {
  classic: {
    name: "Classic UGC",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-4s" },
      { type: "problem", shot: "a-roll", duration: "4-6s" },
      { type: "demo", shot: "b-roll", duration: "4-6s" },
      { type: "demo", shot: "b-roll", duration: "4-6s" },
      { type: "solution", shot: "a-roll", duration: "4-6s" },
      { type: "cta", shot: "a-roll", duration: "3-5s" },
    ],
  },
  "problem-solution": {
    name: "Problem → Solution",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-4s" },
      { type: "problem", shot: "a-roll", duration: "6-8s" },
      { type: "solution", shot: "mixed", duration: "4-6s" },
      { type: "demo", shot: "b-roll", duration: "6-8s" },
      { type: "cta", shot: "a-roll", duration: "3-5s" },
    ],
  },
  storytelling: {
    name: "Story Arc",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "3-4s" },
      { type: "problem", shot: "a-roll", duration: "5-7s" },
      { type: "problem", shot: "b-roll", duration: "3-5s" },
      { type: "solution", shot: "a-roll", duration: "4-6s" },
      { type: "testimonial", shot: "a-roll", duration: "4-6s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
  },
  custom: {
    name: "Custom (AI Decides)",
    pattern: [],
  },
  unboxing: {
    name: "Unboxing Reveal",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-4s" },
      { type: "demo", shot: "b-roll", duration: "5-7s" },
      { type: "solution", shot: "a-roll", duration: "4-6s" },
      { type: "demo", shot: "b-roll", duration: "5-7s" },
      { type: "testimonial", shot: "a-roll", duration: "4-5s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
  },
  tutorial: {
    name: "Quick Tutorial",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-4s" },
      { type: "demo", shot: "mixed", duration: "6-8s" },
      { type: "demo", shot: "b-roll", duration: "5-7s" },
      { type: "demo", shot: "mixed", duration: "5-7s" },
      { type: "solution", shot: "a-roll", duration: "4-5s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
  },
};

const formatStructure = (structureId: string, customPattern?: { type: string; shot: string }[]): string => {
  if (structureId === "custom" && customPattern && customPattern.length > 0) {
    const sceneBreakdown = customPattern
      .map((s, i) => `${i + 1}. ${s.type.toUpperCase()} - ${s.shot}`)
      .join("\n");

    return `
REQUIRED STRUCTURE: Custom (User-defined)
Follow this EXACT scene order and shot types:

${sceneBreakdown}

Shot Types:
- "a-roll" = Actor speaking directly to camera (face visible, talking head, lip-sync required)
- "b-roll" = Product shots, close-ups, demos WITHOUT actor visible (voiceover continues)
- "mixed" = Actor visible but NOT speaking to camera (hands holding product, over-shoulder view, mouth NOT moving)

CRITICAL DIALOGUE RULES:
- ONLY "a-roll" scenes contain dialogue spoken directly to camera
- "b-roll" and "mixed" scenes: dialogue is VOICEOVER (voice continues but no lip-sync needed)
`;
  }

  const structure = SCRIPT_STRUCTURES[structureId] || SCRIPT_STRUCTURES.classic;

  const sceneBreakdown = structure.pattern
    .map((s, i) => `${i + 1}. ${s.type.toUpperCase()} (${s.duration}) - ${s.shot}`)
    .join("\n");

  return `
REQUIRED STRUCTURE: ${structure.name}
Follow this EXACT scene order and shot types:

${sceneBreakdown}

Shot Types:
- "a-roll" = Actor speaking directly to camera (face visible, talking head, lip-sync required)
- "b-roll" = Product shots, close-ups, demos WITHOUT actor visible (voiceover continues)
- "mixed" = Actor visible but NOT speaking to camera (hands holding product, over-shoulder view, mouth NOT moving)

CRITICAL DIALOGUE RULES:
- ONLY "a-roll" scenes contain dialogue spoken directly to camera
- "b-roll" and "mixed" scenes: dialogue is VOICEOVER (voice continues but no lip-sync needed)
`;
};

export const generateUGCScriptPrompt = (config: UGCScriptPromptConfig): string => {
  const duration = config.targetDuration || 30;
  const numVariations = config.numberOfVariations || 2;
  const structureId = config.structureId || "classic";
  const customPattern = config.customPattern;

  return `You are an expert UGC (User Generated Content) script writer who creates VIRAL, scroll-stopping TikTok and Instagram ad scripts.

===== CRITICAL CREATIVE DIRECTION =====
- Write GRIPPING, ATTENTION-GRABBING content that makes viewers STOP scrolling
- Be BOLD, PROVOCATIVE, and AUTHENTIC - this is UGC, not corporate content
- Profanity is ALLOWED and encouraged where it feels natural (damn, holy shit, what the hell, etc.)
- Use STRONG emotional hooks - shock, curiosity, relatability, controversy
- Sound like a REAL PERSON, not a marketer
- Create content that feels native to TikTok/Reels culture

===== YOUR TASK =====
Create ${numVariations} unique UGC ad script(s) for a product based on the provided images and character.

===== PRODUCT INFORMATION =====
${config.productName ? `Product Name: ${config.productName}` : "Infer the product from the images"}
${config.productDescription ? `Description: ${config.productDescription}` : ""}

Product Images Analysis:
${config.productImageDescriptions.map((desc, i) => `Image ${i + 1}: ${desc}`).join("\n")}

===== CHARACTER/ACTOR =====
Name: ${config.characterName}
Gender: ${config.characterGender}
Age Range: ${config.characterAgeRange}
Appearance: ${config.characterAppearance}

===== USER DIRECTION =====
${config.scriptDirection || "Create an engaging, authentic UGC-style script that feels raw and relatable."}

===== SCRIPT REQUIREMENTS =====

TARGET DURATION: ${duration} seconds total

${formatStructure(structureId, customPattern)}

===== HOOK STRATEGIES (use one) =====
- Pattern interrupt: "Wait, is this actually real?"
- Controversy: "I was wrong about everything..."
- Relatability: "POV: You finally found something that works"
- Shock: "Holy shit, I wasn't expecting this"
- Curiosity gap: "Nobody talks about this but..."
- Direct call-out: "If you have [problem], stop scrolling"

NEVER START WITH:
- "Hi guys" / "Hey everyone"
- "So I wanted to share"
- "Today I'm going to show you"
- Any typical YouTuber intro

===== DIALOGUE GUIDELINES =====

1. NATURAL SPEECH:
   - Use conversational rhythm with natural pauses (mark with "...")
   - Include filler words sparingly (like, literally, honestly, lowkey)
   - Vary sentence lengths - mix short punchy lines with longer ones
   - Use contractions (can't, won't, it's, that's)

2. EMOTIONAL AUTHENTICITY:
   - Show genuine reactions (not fake enthusiasm)
   - Include moments of vulnerability
   - Build emotional arc through the script
   - Match energy to content naturally

3. VOICE OPTIMIZATION (TTS SAFETY):
   - Clear pronunciation over fancy vocabulary
   - Spell out numbers ("fifteen" not "15")
   - Avoid tongue twisters and complex phrases
   - Avoid repeated plosives (p, b, t, k clusters like "big black bag")
   - Avoid unnatural capitalization (don't write "SO GOOD" - write "so good")
   - Write for SPOKEN audio, not reading
   - Keep sentences under 20 words for natural breath pacing

===== CINEMATIC PROMPTS (HIDDEN FROM USER) =====

For each scene, provide:
1. ACTION: What the character is physically doing (e.g., "holding product up to camera", "applying serum to face", "gesturing with hands while speaking")

2. CINEMATIC PROMPT for AI video generation:
- Camera angle (POV selfie, medium shot, close-up, overhead, etc.)
- Lighting (natural window light, ring light, moody, bright, etc.)
- Actor expression and body language
- Product placement and positioning
- Background/setting details
- Camera movement (static, slow zoom, pan, handheld shake)

Example cinematicPrompt:
"Close-up POV selfie angle, natural golden hour window lighting. ${config.characterName} looking directly at camera with shocked/excited expression, mouth slightly open. Holding product at chest level, showing it to camera. Modern apartment background with plants, slightly out of focus. Subtle handheld shake for authenticity."

===== OUTPUT FORMAT =====

Return exactly ${numVariations} script variation(s). Each must:
- Follow the EXACT structure pattern provided
- Total approximately ${duration} seconds
- Have unique hooks and creative angles
- Include detailed cinematicPrompts for each scene

For emotion field, choose from:
excited, curious, surprised, frustrated, relieved, confident, friendly, urgent, sincere, playful

For sceneType, use: hook, problem, solution, demo, testimonial, cta

For shotType, use: a-roll, b-roll, mixed (match the structure pattern)

For cameraAngle, choose from:
- pov-selfie: Phone held at arm's length, classic UGC style
- medium-shot: Waist up framing
- close-up: Face or product detail
- wide-shot: Full body with environment
- overhead: Looking down from above (good for product demos)
- low-angle: Looking up at subject
- custom: Only if none of the above fit (provide customCameraAngle description)

DURATION RULES:
- estimatedDurationSeconds MUST be a NUMBER (integer), not a range or text
- Example: use 4 not "3-5s" or "about 4 seconds"
- This is critical for audio pacing and timeline assembly

===== FINAL CHECKS =====
- Dialogue sounds like something a real person would actually say
- Hook makes you want to keep watching (test: would YOU stop scrolling?)
- Emotions flow naturally through the script
- cinematicPrompts are detailed enough for video generation
- Total duration close to ${duration} seconds
- Structure matches the required pattern EXACTLY
- estimatedDurationSeconds is a NUMBER for each scene
- Only a-roll scenes have on-camera dialogue (b-roll/mixed = voiceover)
- No tongue twisters or plosive clusters in dialogue
`;
};

export const generateSceneRegenerationPrompt = (
  sceneType: string,
  currentDialogue: string,
  currentEmotion: string,
  productContext: string,
  characterContext: string
): string => {
  return `Regenerate this single UGC script scene with fresh, GRIPPING content.

SCENE TYPE: ${sceneType}
CURRENT DIALOGUE: "${currentDialogue}"
CURRENT EMOTION: ${currentEmotion}
PRODUCT CONTEXT: ${productContext}
CHARACTER: ${characterContext}

CREATIVE DIRECTION:
- Write something that makes people STOP scrolling
- Be bold, authentic, and raw
- Profanity allowed where natural
- Sound like a real person, not a marketer

TTS SAFETY:
- Avoid tongue twisters and plosive clusters (p, b, t, k)
- No unnatural capitalization
- Write for spoken audio, not reading
- Keep sentences under 20 words

Create a new version that:
- Keeps the same scene type and approximate duration
- Uses a completely different approach/angle
- Has STRONGER emotional impact than the original
- Maintains natural dialogue for AI voice conversion
- Includes a clear ACTION (what the character is physically doing)
- Includes a detailed cinematicPrompt for video generation

Return the regenerated scene with all fields (id, sceneNumber, sceneType, action, dialogue, emotion, estimatedDurationSeconds, shotType, cameraAngle, customCameraAngle, cinematicPrompt, cameraDirection).`;
};
