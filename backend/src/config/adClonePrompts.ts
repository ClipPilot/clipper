import { VideoAnalysisSchema } from "../types/adClone.types";
import { UGCScriptSchema } from "../types/ugcScript.types";
import { z } from "zod";

export const VIDEO_ANALYSIS_JSON_SCHEMA = z.toJSONSchema(VideoAnalysisSchema);

export const UGC_SCRIPT_JSON_SCHEMA = z.toJSONSchema(UGCScriptSchema);

export const VIDEO_ANALYSIS_PROMPT = `You are an expert video analyst specializing in deconstructing advertisements for recreation. Your task is to analyze this reference video and break it into LOGICAL SCENES so it can be faithfully recreated with a different product.

===== YOUR MISSION =====
Extract a SCENE BREAKDOWN that captures the key sections needed to recreate this video with a different product. The clone must match the original in structure, pacing, and style.

===== CRITICAL: SCENE CONSOLIDATION RULES =====
**TARGET: 5-6 SCENES TOTAL, each approximately 8-12 seconds long**

DO NOT split every camera cut into a separate scene. Instead, GROUP related shots into LOGICAL SCENES:

- Multiple quick b-roll cuts showing the same product → ONE "demo" scene
- A talking head with occasional cutaways → ONE "a-roll" scene (note cutaways in visualElements)
- A montage of before/after shots → ONE "testimonial" scene
- Quick cuts during a hook → ONE "hook" scene

**WRONG APPROACH (too granular):**
- Scene 1: 2s hook shot
- Scene 2: 1.5s product close-up
- Scene 3: 2s person talking
- Scene 4: 1s cutaway
- Scene 5: 2s more talking
... (15+ tiny scenes)

**CORRECT APPROACH (logical grouping):**
- Scene 1: 8s hook (person grabs attention, shows product briefly)
- Scene 2: 10s problem/solution (explains the issue, introduces product)
- Scene 3: 12s demo (shows product in use with various angles)
- Scene 4: 8s results/testimonial (shows results, personal story)
- Scene 5: 7s CTA (call to action, final push)

===== ANALYSIS REQUIREMENTS =====

**1. OVERALL VIDEO ANALYSIS:**
- Total duration (in seconds, precise to 0.5s)
- Aspect ratio (9:16, 16:9, 1:1, 4:5)
- Overall style (UGC selfie-style, professional studio, cinematic, documentary, etc.)
- Hook strategy (how does it grab attention in first 2-3 seconds?)
- CTA approach (how does it close/call to action?)
- Original product being advertised (if identifiable)
- Product category (skincare, tech, food, fitness, etc.)
- Target demographic
- Overall narrative arc summary
- Music/audio style description
- Pacing assessment (slow, moderate, fast, varied)
- Key strengths (what makes this ad effective?)

**2. VOICE DELIVERY ANALYSIS (CRITICAL FOR TTS MATCHING):**
Analyze the speaker's voice delivery style to enable faithful TTS recreation:

- **speakerPace**: How fast does the speaker talk? (slow, moderate, fast, varied)
- **speakerEnergy**: What's their energy level? (calm, conversational, energetic, intense)
- **speakerStyle**: What's their speaking personality? (casual, professional, enthusiastic, intimate, authoritative)
- **speakerWPM**: Estimate their words per minute (typical range: 120-180 WPM)
- **speakerCharacteristics**: Array of notable voice traits, such as:
  - "uses filler words like 'um' and 'like'"
  - "upward inflection at end of sentences"
  - "breathless excitement"
  - "drawn out vowels"
  - "rapid-fire delivery"
  - "dramatic pauses for emphasis"
  - "whisper-to-shout dynamics"
  - "sarcastic undertones"
- **recommendedTTSSpeed**: Based on their pace, what ElevenLabs speed multiplier would match them? (0.7 = slow, 1.0 = normal, 1.3 = fast, 1.5 = very fast)

**3. AUDIO SPEED-UP DETECTION (CRITICAL):**
Many social media ads artificially speed up audio by 1.25x-1.5x for pacing. Detect if this video's audio has been sped up:

Signs of artificially sped-up audio:
- WPM significantly higher than natural speech (>180-200 WPM)
- Pitch sounds slightly higher than natural (mild "chipmunk" effect)
- Unnatural lack of pauses between words/sentences
- Compressed/rushed feel despite speaker seeming calm
- Words blend together unnaturally

Set these fields:
- **audioSpeedupDetected**: true if audio appears artificially sped up, false if natural
- **estimatedAudioSpeedMultiplier**: If detected, estimate the speed factor (1.0 = normal, 1.25 = common, 1.5 = aggressive). If not detected, set to 1.0.

**4. SCENE-BY-SCENE BREAKDOWN:**
For EACH distinct scene/shot, extract:

- **sceneNumber**: Sequential number starting from 1
- **startTime**: When this scene starts (seconds, to 0.5s precision)
- **endTime**: When this scene ends (seconds, to 0.5s precision)
- **durationSeconds**: Exact duration of this scene
- **sceneType**: What role does this scene play?
  - "hook" = Opening attention-grabber
  - "problem" = Establishes the pain point
  - "solution" = Introduces the product/solution
  - "demo" = Shows product in use/being demonstrated
  - "testimonial" = Personal story/results
  - "cta" = Call to action
- **shotType**: What type of shot is this?
  - "a-roll" = Person speaking directly to camera (talking head, lip-sync required)
  - "b-roll" = Product shots, cutaways, demos WITHOUT person speaking on screen (includes shots where person is visible but NOT speaking)
- **transcribedDialogue**: EXACT transcription of any speech in this scene (null if no speech)
- **actionDescription**: Precisely what is happening visually - be HYPER-SPECIFIC
  - GOOD: "Woman holds small pink bottle at chest height, rotates it 90 degrees to show label, then brings it closer to camera"
  - BAD: "Shows product"
  - NEVER mention on-screen text, captions, titles, or graphics in action descriptions (we generate those separately)
- **settingDescription**: The environment, background, lighting conditions
- **emotionalTone**: The feeling/emotion being conveyed (excited, frustrated, relieved, etc.)
- **cameraAngle**: The camera perspective
  - "pov-selfie" = Selfie-style, arm's length
  - "medium-shot" = Waist up
  - "close-up" = Face or product detail
  - "wide-shot" = Full body with environment
  - "overhead" = Looking down from above
  - "low-angle" = Looking up at subject
  - "custom" = Something else (describe in cameraMovement)
- **cameraMovement**: Any camera motion (static, pan left, zoom in, tracking, etc.) - null if static
- **productMentions**: Array of any products shown or mentioned in this scene
- **visualElements**: Array of notable visual elements (text overlays, graphics, props, etc.)
- **voicePace**: Speaking pace in THIS scene (slow, moderate, fast, varied) - null if no speech
- **voiceEnergy**: Energy level in THIS scene (calm, conversational, energetic, intense) - null if no speech
- **voiceTags**: Array of ElevenLabs-compatible audio tags that describe HOW the speaker delivers this scene. Examples:
  - Emotional: "excited", "nervous", "frustrated", "calm", "sarcastic"
  - Delivery: "whispers", "shouts", "speaking softly", "rushed", "deliberate"
  - Reactions: "laughs", "sighs", "gasps", "breathes"
  - Pacing: "fast-paced", "slows down", "pause", "drawn out", "hesitates"
- **voicePausePattern**: Notable pausing patterns (e.g., "dramatic pauses before key points", null if nothing notable)
- **voiceEmphasis**: Words or phrases that are emphasized (e.g., "stresses 'amazing'", null if nothing notable)

===== CRITICAL RULES FOR FAITHFUL RECREATION =====

1. **5-6 SCENES MAX**: Consolidate the video into 5-6 logical scenes. Each scene should be 8-12 seconds on average. A 45-second video = ~5 scenes, NOT 15 tiny scenes.

2. **SHOT TYPE DETERMINES SCENE TYPE**:
   - If the PRIMARY content is someone speaking to camera = a-roll (even if there are brief cutaways)
   - If the PRIMARY content is product/visuals with voiceover = b-roll (includes person visible but NOT speaking to camera)

3. **CONSOLIDATE, DON'T FRAGMENT**:
   - Quick cuts within a segment = ONE scene with multiple shots noted in actionDescription
   - A talking head with cutaways = ONE a-roll scene (note cutaways in visualElements)
   - Product demo with multiple angles = ONE demo scene

4. **EMOTIONAL BEATS MATTER**: Each scene should represent a distinct emotional/narrative beat (hook, problem, solution, demo, CTA).

5. **DETAILED ACTION DESCRIPTIONS**: Since you're consolidating, describe ALL the key moments within each scene: "Opens with close-up of product, cuts to person applying it, then shows before/after comparison"

6. **TRANSCRIBE THE FULL DIALOGUE**: Combine all dialogue within a scene into one transcription, noting any pauses or transitions.

7. **VOICE DELIVERY IS CRITICAL**: For each scene with speech, analyze HOW the person speaks:
   - Are they whispering, speaking normally, or shouting?
   - Are they rushed/excited or slow/deliberate?
   - Do they pause dramatically or speak rapid-fire?
   - What emotional undertones are in their voice?
   - This enables our TTS to MATCH their delivery style exactly.

===== OUTPUT REQUIREMENTS =====

Return a complete VideoAnalysis object with:
- All top-level video metadata
- voiceDeliveryAnalysis object with overall voice characteristics and recommendedTTSSpeed
- Complete scenes array with every scene analyzed
- Each scene must have ALL required fields filled, including voiceDelivery for scenes with speech

The goal is that someone reading your analysis could recreate this EXACT video structure, timing, feel, AND VOICE DELIVERY - just with a different product swapped in.`;

export interface VoiceDeliveryConfig {
  overallPace: string;
  overallEnergy: string;
  deliveryStyle: string;
  estimatedWPM: number;
  notableCharacteristics: string[];
  recommendedTTSSpeed: number;
}

export interface ScriptAdaptationConfig {
  productName: string;
  productDescription: string;
  productImageDescriptions: string[];
  characterName: string;
  characterGender: string;
  characterAgeRange: string;
  characterAppearance: string;
  adDirection?: string;
  voiceDelivery?: VoiceDeliveryConfig;
}

export const generateScriptAdaptationPrompt = (
  config: ScriptAdaptationConfig
): string => {
  return `You are an expert UGC script writer. Your task is to take an analyzed reference video and adapt it for a NEW PRODUCT while maintaining NEAR-IDENTICAL structure, pacing, and style.

===== CRITICAL: FIDELITY IS EVERYTHING =====
The adapted script must be a FAITHFUL CLONE of the original video. The ONLY difference should be the product being advertised. Everything else - scene structure, timing, emotional beats, shot types, pacing - must match as closely as possible.

DO NOT:
- Add extra scenes
- Remove scenes
- Significantly change scene durations (±0.5s max)
- Change the emotional arc
- Change shot types (a-roll stays a-roll, b-roll stays b-roll - only use these two types)
- Change camera angles unless absolutely necessary
- "Improve" or "enhance" the original - CLONE it

DO:
- Replace the original product with the new product
- Adapt dialogue to mention the new product naturally
- Keep the same pacing, energy, and structure
- Match scene durations exactly
- Preserve the hook strategy
- Preserve the CTA approach

===== CRITICAL: SCRIPT MUST MAKE SENSE =====
While cloning the structure, the CONTENT must be sensible and compelling for the NEW product:

1. **Product-Appropriate Claims**: Adapt benefits/claims to match what the NEW product actually does
   - If original says "clears acne in 2 weeks" for skincare, adapt to relevant claims for YOUR product
   - Don't copy claims that don't apply - rewrite them to be truthful for the new product

2. **Logical Flow**: The script must tell a coherent story
   - Problem → Solution → Demo → Results should flow naturally
   - Each scene should logically connect to the next
   - The hook should relate to the actual product being sold

3. **Natural Dialogue**: The speaker should sound like they're genuinely talking about THIS product
   - Avoid awkward phrasing from forcing the original structure
   - If the original says "I put it on my face" but your product is a supplement, adapt appropriately
   - Make it sound like authentic UGC, not a forced template

4. **Compelling CTA**: The call-to-action should make sense for how/where this product is sold
   - Adapt "link in bio" / "use my code" / "click below" to match the actual sales channel

===== NEW PRODUCT INFORMATION =====
Product Name: ${config.productName}
Description: ${config.productDescription}
${config.productImageDescriptions.length > 0 ? `\nProduct Images Analysis:\n${config.productImageDescriptions.map((desc, i) => `Image ${i + 1}: ${desc}`).join("\n")}` : ""}

===== CHARACTER/ACTOR =====
Name: ${config.characterName}
Gender: ${config.characterGender}
Age Range: ${config.characterAgeRange}
Appearance: ${config.characterAppearance}

${config.adDirection ? `===== ADDITIONAL DIRECTION =====\n${config.adDirection}\n\nIMPORTANT: This direction should be applied WITHIN the existing structure, not used to change the structure.\n` : ""}
${config.voiceDelivery ? `===== VOICE DELIVERY STYLE (CRITICAL FOR TTS) =====
The original speaker's delivery style MUST be matched in the adapted script using ElevenLabs audio tags.

**Original Speaker Analysis:**
- Speaking Pace: ${config.voiceDelivery.overallPace}
- Energy Level: ${config.voiceDelivery.overallEnergy}
- Delivery Style: ${config.voiceDelivery.deliveryStyle}
- Estimated WPM: ${config.voiceDelivery.estimatedWPM}
- Notable Characteristics: ${config.voiceDelivery.notableCharacteristics.join(", ")}
- Recommended TTS Speed: ${config.voiceDelivery.recommendedTTSSpeed}x

**YOUR TASK:** Embed ElevenLabs audio tags in the dialogue to match this delivery style.

Available Audio Tags (use in square brackets at appropriate points in dialogue):
- Emotional: [excited], [nervous], [frustrated], [calm], [sarcastic], [curious], [cheerful]
- Delivery: [whispers], [shouts], [speaking softly], [rushed], [deliberate], [fast-paced]
- Reactions: [laughs], [sighs], [gasps], [breathes], [exhales]
- Pacing: [slows down], [pause], [drawn out], [hesitates], [stammers]

Example tagged dialogue:
- "[excited] Oh my god, you guys! [pause] This product literally changed my life!"
- "[whispers] Okay so here's the secret... [normal] It's this amazing serum!"
- "[fast-paced] I've tried everything - creams, serums, treatments - [slows down] but nothing worked until I found this."
` : ""}

===== ADAPTATION RULES =====

**1. SCENE-FOR-SCENE MATCHING:**
- Original has 5-6 scenes → Adapted script has EXACTLY the same number
- Each scene is typically 8-12 seconds → Match durations closely (±1.5s)
- Original scene types and shot types must be preserved exactly
- Never merge scenes or split scenes

**2. DIALOGUE ADAPTATION (WITH VOICE DELIVERY MATCHING):**
- Keep the SAME structure and rhythm
- Replace product mentions naturally
- Maintain filler words, pauses, natural speech patterns
- Keep similar word count per scene (±5 words)
- **CRITICAL: Use ElevenLabs audio tags to match the original speaker's delivery**
- Look at each scene's voiceDelivery.voiceTags and incorporate those tags into dialogue
- A-roll: Include audio tags matching the scene's energy/pace (e.g., "[excited] Oh wow!" or "[pause] And then...")
- B-roll: Include audio tags for voiceover style (e.g., "[whispers] Here's the secret..." or "[fast-paced] Try it now!")
- Match the original speaker's notable characteristics (rapid-fire? dramatic pauses? whisper-to-shout?)

**3. TIMING PRECISION:**
- estimatedDurationSeconds must be a NUMBER (not a range)
- Match original scene durations as closely as possible
- Total duration should match original ±2 seconds

**4. CINEMATIC PROMPTS:**
For each scene, write a DETAILED 3-5 paragraph cinematicPrompt that:
- Matches the original scene's setting/environment style
- Describes the new product where applicable
- Maintains the same camera angles and movements
- Captures the same emotional tone
- Includes NEGATIVE guidance to prevent AI artifacts

**5. B-ROLL HANDLING:**
- Use bRollShots array for b-roll scenes
- Match the NUMBER of shots from the original scene
- Set productImageNeeded based on whether product should appear
- Keep individual shot durations matching the original

===== OUTPUT FORMAT =====

Return a SINGLE UGCScript with:
- title: A catchy title for the adapted ad
- hook: The adapted opening line (matching original hook style)
- targetAudience: Same as original or adapted for new product
- totalEstimatedDuration: Should match original ±2 seconds
- scenes: Array of scenes matching original count and structure
- viralScore: 95+ (must maintain original effectiveness)
- viralReasoning: Why this clone will be effective
- productMentions: Where new product is featured

Each scene must have:
- id: Unique identifier (e.g., "scene-1", "scene-2")
- sceneNumber: Sequential number
- sceneType: SAME as original scene
- shotType: SAME as original scene (a-roll/b-roll)
- cameraAngle: SAME as original scene
- estimatedDurationSeconds: MATCHING original (±0.5s)
- dialogue: Adapted for new product
- emotion: SAME as original scene
- action: Adapted action description (NO on-screen text mentions - see rules below)
- cinematicPrompt: Detailed 3-5 paragraph prompt
- ambientSound: For a-roll scenes only - short natural background sounds (see examples below)
- bRollShots: For b-roll scenes (PRODUCT DEMOS ONLY - see rules below)

===== ACTION DESCRIPTION RULES (CRITICAL) =====
The "action" field describes what happens VISUALLY in the scene for image generation.

NEVER include in action descriptions:
- "On-screen text introduces..."
- "Text overlay shows..."
- "Caption appears..."
- "Title card displays..."
- Any mention of text, graphics, captions, or overlays

GOOD action examples:
- "Person holds smartphone at eye level, scrolls through app, then looks up at camera with surprised expression"
- "Close-up of product bottle on marble counter, hand enters frame and picks it up"
- "Person applies cream to face in circular motions, looking at mirror"

BAD action examples:
- "On-screen text introduces the method name" (NO - we add text separately)
- "Caption shows product benefits" (NO)
- "Title card with brand logo" (NO)

===== B-ROLL RULES (CRITICAL) =====
B-roll scenes use bRollShots array for PRODUCT DEMOS ONLY.

WHEN TO USE bRollShots (multi-shot):
- Product unboxing with multiple angles
- Product demo showing different features
- Before/after product comparison shots
- Product close-ups from various angles

WHEN NOT TO USE bRollShots (single shot):
- Person doing an action (even if not speaking to camera)
- Lifestyle shots with person visible
- Any shot where a person is the main subject

If a person appears in b-roll with dialogue:
- This is NARRATION/VOICEOVER (audio plays over the visuals)
- The person is NOT lip-syncing - they may be doing an action while voiceover plays
- Set shotType: "b-roll" and do NOT use bRollShots if person is main subject

===== AMBIENT SOUND RULES (CRITICAL) =====
For a-roll scenes ONLY, provide a SHORT ambient sound description (5-15 words max).
This creates realistic background audio matching the scene environment.

GOOD ambient sounds (natural, subtle):
- "quiet room tone with subtle air conditioning hum"
- "soft indoor ambience with distant muffled sounds"
- "light bedroom atmosphere with gentle room tone"
- "home interior with quiet refrigerator hum"
- "living room ambience with soft background noise"

BAD ambient sounds (avoid these - too specific or weird):
- "dramatic cinematic score" (NO music)
- "whooshing transitions" (NO sound effects)
- "bass drops and builds" (NO production elements)
- "mysterious ethereal tones" (NO artistic sounds)
- Any sound describing music, beats, or production audio

For b-roll scenes: set ambientSound to null (voiceover only)

===== FINAL CHECKS =====
Before submitting, verify:
□ Scene count matches original exactly
□ Scene types match original in same order
□ Shot types (a-roll/b-roll only) match original
□ Total duration within ±2 seconds of original
□ Dialogue word count similar to original per scene
□ Camera angles preserved from original
□ Emotional arc maintained
□ Hook strategy preserved
□ CTA approach preserved
□ All a-roll scenes have natural ambient sounds (no music, no production sounds)
□ All b-roll scenes have ambientSound set to null`;
};
