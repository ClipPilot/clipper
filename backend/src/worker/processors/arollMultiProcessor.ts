import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateSceneImageJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { falImageService } from "../../services/ai-ugc/falImage.service";
import { CharacterAppearance, buildSceneImagePrompt } from "./sceneImagePrompts";
import { getReferenceImageUrls } from "../../utils/s3Helpers";

type UpdateProgress = (jobId: string, progress: number, message: string) => Promise<void>;

interface CharacterRef {
  url: string | null;
  appearance: CharacterAppearance | undefined;
}

const DEFAULT_ANGLES: [string, string] = [
  "three-quarter view from the left, leaning slightly forward toward microphone",
  "three-quarter view from the right, sitting comfortably, one hand near microphone",
];

const PODCAST_BACKGROUND_PROMPT = `Professional podcast recording studio interior. A modern desk with two podcast microphones on adjustable boom arms, positioned across from each other. Warm moody lighting with soft key light and subtle colored accent lighting. Acoustic foam panels on walls. Two chairs visible. NO PEOPLE — the studio is completely empty. Photorealistic, cinematic lighting, vertical 9:16 framing.

NEGATIVE: person, human, hands, face, body, cartoon, illustration, text, watermark`;

async function loadCharactersConfig(scriptId: string): Promise<Array<{ characterId: number }>> {
  const [row] = await db
    .select({ characters_config: schema.ugcScripts.characters_config })
    .from(schema.ugcScripts)
    .where(eq(schema.ugcScripts.id, scriptId))
    .limit(1);

  return (row?.characters_config as Array<{ characterId: number }> | null) || [];
}

async function loadAnchorSceneCharacterMapping(
  scriptId: string,
  anchorKeys: string[],
): Promise<Map<number, string>> {
  const charMap = new Map<number, string>();

  const [row] = await db
    .select({ scripts_data: schema.ugcScripts.scripts_data })
    .from(schema.ugcScripts)
    .where(eq(schema.ugcScripts.id, scriptId))
    .limit(1);

  if (!row?.scripts_data) return charMap;

  const scripts = row.scripts_data as Array<{ scenes: Array<{ shotType: string; arollShots?: Array<{ characterIndex: number }> }> }>;
  const allScenes = scripts[0]?.scenes || [];

  const anchorScene = allScenes.find((s) => s.shotType === "a-roll-multi" && s.arollShots?.length);
  if (!anchorScene?.arollShots) return charMap;

  for (let i = 0; i < Math.min(anchorScene.arollShots.length, anchorKeys.length); i++) {
    const charIdx = anchorScene.arollShots[i].characterIndex;
    if (!charMap.has(charIdx)) {
      charMap.set(charIdx, anchorKeys[i]);
    }
  }

  return charMap;
}

function createCharacterLoader(
  charactersConfig: Array<{ characterId: number }>,
  fallbackCharId: number,
) {
  const cache = new Map<number, CharacterRef>();

  return async function getCharRefs(charIndex: number): Promise<CharacterRef> {
    if (cache.has(charIndex)) return cache.get(charIndex)!;

    const charConfig = charactersConfig[charIndex];
    const effectiveId = charConfig?.characterId ?? (charIndex === 0 ? fallbackCharId : undefined);
    if (!effectiveId) {
      const empty: CharacterRef = { url: null, appearance: undefined };
      cache.set(charIndex, empty);
      return empty;
    }

    const [character] = await db
      .select()
      .from(schema.characters)
      .where(eq(schema.characters.id, effectiveId));

    if (!character) {
      const empty: CharacterRef = { url: null, appearance: undefined };
      cache.set(charIndex, empty);
      return empty;
    }

    let url: string | null = null;
    const images = character.character_images as string[];
    const primaryIdx = character.primary_image_index || 0;
    if (images?.[primaryIdx]) {
      const urls = await getReferenceImageUrls([images[primaryIdx]]);
      if (urls.length > 0) url = urls[0];
    }

    let appearance: CharacterAppearance | undefined;
    const config = character.appearance_config as Record<string, string> | null;
    if (config) {
      appearance = {
        gender: character.gender,
        ageRange: character.age_range,
        skinTone: config.skinTone,
        hairColor: config.hairColor,
        hairStyle: config.hairStyle,
        eyeColor: config.eyeColor,
        bodyType: config.bodyType,
      };
    }

    const ref: CharacterRef = { url, appearance };
    cache.set(charIndex, ref);
    return ref;
  };
}

async function generateBackground(
  teamId: number,
  scriptId: string,
  sceneId: string,
): Promise<{ key: string; url: string }> {
  const result = await falImageService.generateImageWithRetry({
    prompt: PODCAST_BACKGROUND_PROMPT,
    aspectRatio: "9:16",
  });

  const response = await fetch(result.imageUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  const key = await s3Service.uploadSceneImage(buffer, teamId, scriptId, sceneId, 999);
  const url = await s3Service.getPresignedUrl(key, 3600);

  return { key, url };
}

async function generateShot(
  shot: NonNullable<GenerateSceneImageJob["arollShots"]>[number],
  index: number,
  sceneData: GenerateSceneImageJob["sceneData"],
  charRef: CharacterRef,
  bgUrl: string,
  sameCharGeneratedRef: string | undefined,
  isEstablishing: boolean,
  teamId: number,
  scriptId: string,
  sceneId: string,
  productName?: string,
): Promise<{ index: number; imageKey: string }> {
  const angle = shot.angle || DEFAULT_ANGLES[shot.characterIndex % 2];

  const shotRefs: string[] = [];
  if (charRef.url) shotRefs.push(charRef.url);
  if (sameCharGeneratedRef) {
    const urls = await getReferenceImageUrls([sameCharGeneratedRef]);
    if (urls.length > 0) shotRefs.push(urls[0]);
  }
  shotRefs.push(bgUrl);

  const shotSceneData = {
    ...sceneData,
    shotType: "a-roll-multi",
    action: shot.imageGenPrompt || shot.action,
    dialogue: shot.dialogue,
    cinematicPrompt: shot.cinematicPrompt || sceneData.cinematicPrompt,
  };

  let promptPrefix: string;

  const micSide = shot.characterIndex % 2 === 0 ? "LEFT" : "RIGHT";

  if (isEstablishing) {
    promptPrefix = `**PODCAST SHOT ${index + 1} — ESTABLISHING CHARACTER ${shot.characterIndex}**
Camera angle and body position: ${angle}
Microphone position: The microphone MUST be on the ${micSide} side of the frame.
Place this character in the podcast studio background. The character speaks toward a microphone, NOT the camera. No eye contact with camera.
This exact pose, angle, and microphone placement will be reused for all subsequent shots of this character.

**REFERENCE IMAGES:**
1. FIRST image = CHARACTER identity. Depict THIS exact person — match face, skin tone, features precisely.
${sameCharGeneratedRef ? `2. NEXT image = this character's previous shot. Copy OUTFIT and ACCESSORIES exactly.\n3. LAST image = BACKGROUND studio. Place the character in this exact environment.\n` : `2. LAST image = BACKGROUND studio. Place the character in this exact environment. The studio is empty — add ONLY this one character.\n`}`;
  } else {
    promptPrefix = `**PODCAST SHOT ${index + 1} — CONTINUITY CHARACTER ${shot.characterIndex}**
Camera angle: ${angle}
Replicate the EXACT same camera angle, pose, seating position, and framing from the previous shot reference. Only facial expression and subtle hand gestures change. Outfit, setting, and angle stay IDENTICAL.

**REFERENCE IMAGES:**
1. FIRST image = CHARACTER identity — face reference.
2. NEXT image = this character's PREVIOUS shot. Copy pose, angle, outfit, and setting EXACTLY. Only expression changes.
3. LAST image = BACKGROUND reference.\n\n`;
  }

  const shotPrompt = promptPrefix + buildSceneImagePrompt(
    shotSceneData,
    true,
    false,
    productName,
    undefined,
    "start",
    charRef.appearance,
    false,
    false,
    undefined,
    false,
    false,
  );

  const result = await falImageService.generateImageWithRetry({
    prompt: shotPrompt,
    aspectRatio: "9:16",
    imageUrls: shotRefs,
  });

  const response = await fetch(result.imageUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  const imageKey = await s3Service.uploadSceneImage(buffer, teamId, scriptId, sceneId, index);

  console.log(
    `[AROLL_MULTI] Shot ${index + 1} (char ${shot.characterIndex}, ${isEstablishing ? "establishing" : "continuity"}): ${imageKey}`,
  );
  return { index, imageKey };
}

export async function processArollMultiImages(
  job: GenerateSceneImageJob,
  updateProgress: UpdateProgress,
): Promise<string[]> {
  const {
    jobId, teamId, scriptId, sceneId, sceneNumber, characterId,
    sceneData, productName, arollShots, settingAnchorKeys,
    singleArollShotIndex, existingArollImages,
  } = job;

  if (!arollShots || arollShots.length < 2) {
    throw new Error(`a-roll-multi scene ${sceneNumber} requires at least 2 arollShots`);
  }

  const charactersConfig = await loadCharactersConfig(scriptId);
  const getCharRefs = createCharacterLoader(charactersConfig, characterId);

  // --- Flow C: Single-shot regen ---
  if (singleArollShotIndex !== undefined && existingArollImages) {
    console.log(
      `[AROLL_MULTI] Scene ${sceneNumber}: Single-shot regen for shot ${singleArollShotIndex}`,
    );
    await updateProgress(jobId, 10, `Regenerating podcast shot ${singleArollShotIndex + 1}...`);

    const generatedImages = [...existingArollImages];
    const target = arollShots[singleArollShotIndex];
    const charRef = await getCharRefs(target.characterIndex);

    let sameCharRef: string | undefined;
    for (let i = 0; i < arollShots.length; i++) {
      if (i !== singleArollShotIndex && arollShots[i].characterIndex === target.characterIndex && existingArollImages[i]) {
        sameCharRef = existingArollImages[i];
        break;
      }
    }

    let bgUrl: string;
    if (settingAnchorKeys?.[0]) {
      const urls = await getReferenceImageUrls([settingAnchorKeys[0]]);
      bgUrl = urls[0];
    } else if (existingArollImages[0]) {
      const urls = await getReferenceImageUrls([existingArollImages[0]]);
      bgUrl = urls[0];
    } else {
      const bg = await generateBackground(teamId, scriptId, sceneId);
      bgUrl = bg.url;
    }

    const { imageKey } = await generateShot(
      target, singleArollShotIndex, sceneData, charRef, bgUrl,
      sameCharRef, !sameCharRef, teamId, scriptId, sceneId, productName,
    );
    generatedImages[singleArollShotIndex] = imageKey;

    return generatedImages;
  }

  const generatedImages: string[] = [];
  const referenceByCharacter = new Map<number, string>();

  // --- Flow B: Non-anchor scene (settingAnchorKeys from Scene 1's established shots) ---
  // Characters were already established in the anchor scene. Every shot here is continuity —
  // just replicate the character's pose/outfit from their anchor image.
  if (settingAnchorKeys && settingAnchorKeys.length >= 2) {
    console.log(
      `[AROLL_MULTI] Scene ${sceneNumber}: Non-anchor — all ${arollShots.length} shots as continuity`,
    );

    // settingAnchorKeys contains Scene 1's generated images: [shot0_charX, shot1_charY, ...]
    // Map each character index to their anchor image by scanning the anchor scene's shot order.
    // Anchor scene's shots alternate characters, so anchorKeys[0] = first character, anchorKeys[1] = second character.
    // We load the anchor scene's arollShots to get the actual characterIndex mapping.
    const anchorCharMap = new Map<number, string>();
    const anchorSceneData = await loadAnchorSceneCharacterMapping(scriptId, settingAnchorKeys);
    for (const [charIdx, key] of anchorSceneData.entries()) {
      anchorCharMap.set(charIdx, key);
    }

    const bgUrl = (await getReferenceImageUrls([settingAnchorKeys[0]]))[0];

    await updateProgress(jobId, 10, `Generating ${arollShots.length} continuity shots...`);

    const results = await Promise.all(
      arollShots.map(async (shot, i) => {
        const charRef = await getCharRefs(shot.characterIndex);
        const sameCharRef = anchorCharMap.get(shot.characterIndex);
        return generateShot(shot, i, sceneData, charRef, bgUrl, sameCharRef, false, teamId, scriptId, sceneId, productName);
      }),
    );

    for (const { index, imageKey } of results.sort((a, b) => a.index - b.index)) {
      generatedImages[index] = imageKey;
    }

    return generatedImages;
  }

  // --- Flow A: Anchor scene (first a-roll-multi, generate background) ---
  console.log(
    `[AROLL_MULTI] Scene ${sceneNumber}: Anchor — generating background + ${arollShots.length} shots`,
  );
  await updateProgress(jobId, 5, "Generating podcast studio background...");
  const bg = await generateBackground(teamId, scriptId, sceneId);
  console.log(`[AROLL_MULTI] Background generated: ${bg.key}`);

  await updateProgress(jobId, 20, `Generating 2 establishing shots in parallel...`);
  const establishingResults = await Promise.all(
    arollShots.slice(0, 2).map(async (shot, i) => {
      const charRef = await getCharRefs(shot.characterIndex);
      return generateShot(shot, i, sceneData, charRef, bg.url, undefined, true, teamId, scriptId, sceneId, productName);
    }),
  );

  for (const { index, imageKey } of establishingResults) {
    generatedImages[index] = imageKey;
    referenceByCharacter.set(arollShots[index].characterIndex, imageKey);
  }

  if (arollShots.length > 2) {
    await updateProgress(jobId, 60, `Generating ${arollShots.length - 2} continuity shots...`);
    const continuityResults = await Promise.all(
      arollShots.slice(2).map(async (shot, offsetIdx) => {
        const i = offsetIdx + 2;
        const charRef = await getCharRefs(shot.characterIndex);
        const sameCharRef = referenceByCharacter.get(shot.characterIndex);
        return generateShot(shot, i, sceneData, charRef, bg.url, sameCharRef, false, teamId, scriptId, sceneId, productName);
      }),
    );
    for (const { index, imageKey } of continuityResults.sort((a, b) => a.index - b.index)) {
      generatedImages[index] = imageKey;
    }
  }

  return generatedImages;
}
