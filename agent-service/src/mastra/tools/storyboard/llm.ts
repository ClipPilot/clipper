/**
 * Lightweight OpenAI helpers for storyboard tools that need
 * to generate cinematic prompts, image prompts, or shot breakdowns.
 * Uses the OpenAI Responses API per project convention.
 */
import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function generateCinematicPrompt(action: string): Promise<string> {
  const prompt = `Generate a detailed cinematicPrompt for a video scene with this action: "${action}"

The cinematicPrompt should be 2-3 paragraphs describing:
1. Visual composition, lighting, and framing
2. Camera movement and timing
3. Technical style and what to avoid

Keep it professional and suitable for AI video generation. Return ONLY the cinematicPrompt text, no JSON or extra formatting.`;

  const response = await getClient().responses.create({
    model: "gpt-5-mini",
    input: [{ role: "user", content: prompt }],
  });

  return response.output_text?.trim() || action;
}

export async function generateBRollShotPrompts(shot: {
  action: string;
  shotType: string;
}): Promise<{ cinematicPrompt: string; shotType: string }> {
  const prompt = `Generate a cinematicPrompt and classify the shotType for a B-roll shot with this action: "${shot.action}"

cinematicPrompt: 2-3 sentences describing visual composition, lighting, and framing. Professional and suitable for AI image generation.

shotType: Classify what this shot features:
- "CHARACTER" — a person doing an action (e.g., "she stands tall", "woman stretching")
- "PRODUCT" — product-only or environment shot with NO person (e.g., "bottle on counter")
- "CHARACTER_AND_PRODUCT" — person interacting with the product (e.g., "she applies the serum")

Return ONLY a JSON object with "cinematicPrompt" and "shotType" fields. No extra text.`;

  const response = await getClient().responses.create({
    model: "gpt-5-mini",
    input: [{ role: "user", content: prompt }],
  });

  const parsed = JSON.parse(response.output_text);
  return {
    cinematicPrompt: parsed.cinematicPrompt,
    shotType: parsed.shotType || shot.shotType,
  };
}

export async function generateNewSceneContent(params: {
  sceneType: string;
  shotType: "a-roll" | "a-roll-multi" | "b-roll";
  action: string;
  storyBeat: string;
  dialogue?: string;
  duration: number;
}): Promise<{
  cinematicPrompt: string;
  ambientSound: string | null;
  emotion: string;
  cameraAngle: string;
  dialogue: string;
}> {
  const prompt = `Generate scene content for a UGC video scene.

Scene type (story beat): ${params.storyBeat}
Shot type: ${params.shotType}
Action: "${params.action}"
Target duration: ${params.duration} seconds
${params.dialogue ? `Dialogue: "${params.dialogue}"` : "No dialogue provided — generate appropriate dialogue if a-roll."}

Return a JSON object with:
- "cinematicPrompt": 2-3 paragraphs for AI video generation (composition, lighting, camera movement, technical style)
- "ambientSound": ${params.shotType === "a-roll" || params.shotType === "a-roll-multi" ? 'Natural background sound description matching the scene environment. Format: "Recorded through [DEVICE] mic — [AUDIO QUALITY]. [BACKGROUND SOUNDS]."' : "null"}
- "emotion": One of: excited, curious, surprised, frustrated, relieved, confident, friendly, urgent, sincere, playful, vulnerable, skeptical, amazed, conspiratorial, empathetic, determined
- "cameraAngle": One of: pov-selfie, medium-shot, close-up, wide-shot, overhead, low-angle, custom
- "dialogue": ${params.shotType === "a-roll" ? 'Dialogue with ElevenLabs emotion tags. EVERY sentence must start with a tag like [excited], [sincere], etc. Keep under 30 words.' : params.shotType === "a-roll-multi" ? 'Empty string "" — dialogue lives in the arollShots array, not at scene level.' : 'Voiceover text or empty string ""'}

Return ONLY valid JSON.`;

  const response = await getClient().responses.create({
    model: "gpt-5-mini",
    input: [{ role: "user", content: prompt }],
  });

  return JSON.parse(response.output_text);
}

export async function generateArollShotContent(params: {
  action: string;
  characterIndex: number;
  characterName?: string;
  sceneContext?: string;
}): Promise<{
  dialogue: string;
  emotion: string;
  ambientSound: string | null;
}> {
  const prompt = `Generate dialogue for a podcast a-roll shot.

Character index: ${params.characterIndex}${params.characterName ? ` (${params.characterName})` : ""}
Action: "${params.action}"
${params.sceneContext ? `Scene context: ${params.sceneContext}` : ""}

Rules:
- The character speaks toward a microphone, NOT the camera
- Dialogue MUST start with an ElevenLabs emotion tag: [excited], [curious], [sincere], [playful], [amazed], [dramatic], [satisfied], [whispering], [laughing]
- Keep it concise: 1-3 sentences, ~3-8 seconds spoken
- Make it conversational — this is a podcast, not a script reading

Return ONLY a JSON object with:
- "dialogue": The character's line with emotion tag(s)
- "emotion": One of: excited, curious, surprised, frustrated, relieved, confident, friendly, urgent, sincere, playful, vulnerable, skeptical, amazed, conspiratorial, empathetic, determined
- "ambientSound": null (inherits from scene)`;

  const response = await getClient().responses.create({
    model: "gpt-5-mini",
    input: [{ role: "user", content: prompt }],
  });

  return JSON.parse(response.output_text);
}

export async function generateShotBreakdown(params: {
  sceneAction: string;
  shotCount: number;
  totalDuration: number;
}): Promise<
  Array<{
    action: string;
    cinematicPrompt: string;
    durationSeconds: number;
    productImageNeeded: boolean;
    shotType: "CHARACTER" | "PRODUCT" | "CHARACTER_AND_PRODUCT";
  }>
> {
  const perShotDuration = Math.max(
    1,
    Math.round(params.totalDuration / params.shotCount),
  );

  const prompt = `Generate ${params.shotCount} B-roll shot descriptions for a scene.

Scene action: "${params.sceneAction}"
Total duration: ${params.totalDuration} seconds

Generate exactly ${params.shotCount} shots. Each shot:
- "action": A single, specific camera action (1-2 sentences). Describe what happens visually. NEVER mention on-screen text.
- "cinematicPrompt": 2-3 sentences for AI image generation (composition, lighting, framing).
- "durationSeconds": Roughly ${perShotDuration} seconds each, summing to ~${params.totalDuration}s total. Min 1, max 4.
- "productImageNeeded": true if the shot shows a product, false for lifestyle/mood.
- "shotType": "CHARACTER" (person), "PRODUCT" (product only), or "CHARACTER_AND_PRODUCT" (person + product).

Return ONLY a JSON array of shot objects.`;

  const response = await getClient().responses.create({
    model: "gpt-5-mini",
    input: [{ role: "user", content: prompt }],
  });

  return JSON.parse(response.output_text);
}
