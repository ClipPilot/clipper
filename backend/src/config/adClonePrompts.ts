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

**2. SCENE-BY-SCENE BREAKDOWN:**
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
  - "b-roll" = Product shots, cutaways, demos WITHOUT person speaking on screen
  - "mixed" = Person visible but NOT speaking to camera (using product, over-shoulder)
- **transcribedDialogue**: EXACT transcription of any speech in this scene (null if no speech)
- **actionDescription**: Precisely what is happening visually - be HYPER-SPECIFIC
  - GOOD: "Woman holds small pink bottle at chest height, rotates it 90 degrees to show label, then brings it closer to camera"
  - BAD: "Shows product"
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

===== CRITICAL RULES FOR FAITHFUL RECREATION =====

1. **5-6 SCENES MAX**: Consolidate the video into 5-6 logical scenes. Each scene should be 8-12 seconds on average. A 45-second video = ~5 scenes, NOT 15 tiny scenes.

2. **SHOT TYPE DETERMINES SCENE TYPE**:
   - If the PRIMARY content is someone speaking to camera = a-roll (even if there are brief cutaways)
   - If the PRIMARY content is product/visuals with voiceover = b-roll
   - If person is visible doing something but not speaking directly = mixed

3. **CONSOLIDATE, DON'T FRAGMENT**:
   - Quick cuts within a segment = ONE scene with multiple shots noted in actionDescription
   - A talking head with cutaways = ONE a-roll scene (note cutaways in visualElements)
   - Product demo with multiple angles = ONE demo scene

4. **EMOTIONAL BEATS MATTER**: Each scene should represent a distinct emotional/narrative beat (hook, problem, solution, demo, CTA).

5. **DETAILED ACTION DESCRIPTIONS**: Since you're consolidating, describe ALL the key moments within each scene: "Opens with close-up of product, cuts to person applying it, then shows before/after comparison"

6. **TRANSCRIBE THE FULL DIALOGUE**: Combine all dialogue within a scene into one transcription, noting any pauses or transitions.

===== OUTPUT REQUIREMENTS =====

Return a complete VideoAnalysis object with:
- All top-level video metadata
- Complete scenes array with every scene analyzed
- Each scene must have ALL required fields filled

The goal is that someone reading your analysis could recreate this EXACT video structure, timing, and feel - just with a different product swapped in.`;

export interface ScriptAdaptationConfig {
  productName: string;
  productDescription: string;
  productImageDescriptions: string[];
  characterName: string;
  characterGender: string;
  characterAgeRange: string;
  characterAppearance: string;
  adDirection?: string;
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
- Change shot types (a-roll stays a-roll, b-roll stays b-roll)
- Change camera angles unless absolutely necessary
- "Improve" or "enhance" the original - CLONE it

DO:
- Replace the original product with the new product
- Adapt dialogue to mention the new product naturally
- Keep the same pacing, energy, and structure
- Match scene durations exactly
- Preserve the hook strategy
- Preserve the CTA approach

===== NEW PRODUCT INFORMATION =====
Product Name: ${config.productName}
Description: ${config.productDescription}
${config.productImageDescriptions.length > 0 ? `\nProduct Images Analysis:\n${config.productImageDescriptions.map((desc, i) => `Image ${i + 1}: ${desc}`).join("\n")}` : ""}

===== CHARACTER/ACTOR =====
Name: ${config.characterName}
Gender: ${config.characterGender}
Age Range: ${config.characterAgeRange}
Appearance: ${config.characterAppearance}

${config.adDirection ? `===== ADDITIONAL DIRECTION =====\n${config.adDirection}\n\nIMPORTANT: This direction should be applied WITHIN the existing structure, not used to change the structure.` : ""}

===== ADAPTATION RULES =====

**1. SCENE-FOR-SCENE MATCHING:**
- Original has 5-6 scenes → Adapted script has EXACTLY the same number
- Each scene is typically 8-12 seconds → Match durations closely (±1.5s)
- Original scene types and shot types must be preserved exactly
- Never merge scenes or split scenes

**2. DIALOGUE ADAPTATION:**
- Keep the SAME structure and rhythm
- Replace product mentions naturally
- Maintain filler words, pauses, natural speech patterns
- Keep similar word count per scene (±5 words)
- A-roll: Natural conversational dialogue (no voice tags)
- B-roll/Mixed: Add voice direction tags ([whispering], [excited], etc.)

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
- shotType: SAME as original scene (a-roll/b-roll/mixed)
- cameraAngle: SAME as original scene
- estimatedDurationSeconds: MATCHING original (±0.5s)
- dialogue: Adapted for new product
- emotion: SAME as original scene
- action: Adapted action description
- cinematicPrompt: Detailed 3-5 paragraph prompt
- ambientSound: For a-roll scenes only (matching original environment)
- bRollShots: For b-roll scenes (matching original shot count)

===== FINAL CHECKS =====
Before submitting, verify:
□ Scene count matches original exactly
□ Scene types match original in same order
□ Shot types (a-roll/b-roll/mixed) match original
□ Total duration within ±2 seconds of original
□ Dialogue word count similar to original per scene
□ Camera angles preserved from original
□ Emotional arc maintained
□ Hook strategy preserved
□ CTA approach preserved`;
};
