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

const PODCAST_BACKGROUND_PROMPT = `Professional podcast recording studio interior viewed from a centered angle. A modern desk with two podcast microphones on adjustable boom arms — one microphone on the LEFT side of the desk and one on the RIGHT side, positioned facing each other across the desk. Warm moody lighting with soft key light and subtle colored accent lighting. Acoustic foam panels on walls. Two empty chairs, one on each side. NO PEOPLE — the studio is completely empty. Photorealistic, cinematic lighting, vertical 9:16 framing.

NEGATIVE: person, human, hands, face, body, cartoon, illustration, text, watermark`;

async function loadCharactersConfig(scriptId: string): Promise<Array<{ characterId: number }>> {
  const [row] = await db
    .select({ characters_config: schema.ugcScripts.characters_config })
    .from(schema.ugcScripts)
    .where(eq(schema.ugcScripts.id, scriptId))
    .limit(1);

  return (row?.characters_config as Array<{ characterId: number }> | null) || [];
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

async function storeAnchorData(
  jobId: string,
  bgKey: string,
  char0Key: string,
  char1Key: string,
): Promise<void> {
  const anchorData = { bgKey, char0Key, char1Key };
  await db
    .update(schema.sceneImageGenerationJobs)
    .set({ progress_message: `ANCHOR:${JSON.stringify(anchorData)}` })
    .where(eq(schema.sceneImageGenerationJobs.id, jobId));
  console.log(`[AROLL_MULTI] Stored anchor data: ${JSON.stringify(anchorData)}`);
}

export function parseAnchorData(
  progressMessage: string | null,
): { bgKey: string; char0Key: string; char1Key: string } | null {
  if (!progressMessage?.startsWith("ANCHOR:")) return null;
  try {
    return JSON.parse(progressMessage.slice(7));
  } catch {
    return null;
  }
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
  if (!response.ok) {
    throw new Error(`Failed to download background image: HTTP ${response.status}`);
  }
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
  if (charRef.url) {
    shotRefs.push(charRef.url);
  } else {
    console.warn(
      `[AROLL_MULTI] WARNING: No character reference URL for shot ${index} (charIndex=${shot.characterIndex}). The generated image will not match the intended character.`,
    );
  }
  if (sameCharGeneratedRef) {
    const urls = await getReferenceImageUrls([sameCharGeneratedRef]);
    if (urls.length > 0) shotRefs.push(urls[0]);
  }
  if (isEstablishing) {
    shotRefs.push(bgUrl);
  }

  console.log(
    `[AROLL_MULTI] Shot ${index} (char ${shot.characterIndex}): ${shotRefs.length} refs [charUrl=${!!charRef.url}, sameCharRef=${!!sameCharGeneratedRef}, bg=${isEstablishing}]`,
  );

  const shotSceneData = {
    ...sceneData,
    shotType: "a-roll-multi",
    action: shot.imageGenPrompt || shot.action,
    dialogue: shot.dialogue,
    cinematicPrompt: shot.cinematicPrompt || sceneData.cinematicPrompt,
  };

  let promptPrefix: string;

  const deskSide = shot.characterIndex % 2 === 0 ? "LEFT" : "RIGHT";

  if (isEstablishing) {
    promptPrefix = `**PODCAST SHOT ${index + 1} — ESTABLISHING CHARACTER ${shot.characterIndex}**
Camera angle and body position: ${angle}
This character sits on the ${deskSide} side of the desk, using the ${deskSide} microphone. Place this character in the podcast studio background at the ${deskSide} microphone position.
The character speaks toward the microphone, NOT the camera. No eye contact with camera.
This establishes the character's desk position and general camera angle. Subsequent shots will use the same side and setting but with natural pose variation. Frame only one side of the podcast set — the speaking character's half. The other host's position must be completely out of frame.

**REFERENCE IMAGES:**
1. FIRST image = CHARACTER identity. Depict THIS exact person — match face, skin tone, features precisely.
${sameCharGeneratedRef ? `2. NEXT image = this character's previous shot. Copy OUTFIT and ACCESSORIES exactly.\n3. LAST image = BACKGROUND studio. Place the character in this exact environment.\n` : `2. LAST image = BACKGROUND studio. Place the character in this exact environment. The studio is empty — add ONLY this one character.\n`}`;
  } else {
    promptPrefix = `**PODCAST SHOT ${index + 1} — CONTINUITY CHARACTER ${shot.characterIndex}**
Camera angle: ${angle}
Keep the SAME desk side, outfit, background, and general camera angle as the previous shot. However, introduce NATURAL MICRO-VARIATION in pose — slightly different head tilt, shifted lean direction, different hand placement on desk or near microphone. Like real podcast footage where the speaker subtly shifts between cuts. The character should feel alive and animated, not frozen in the exact same position.

**REFERENCE IMAGES:**
1. FIRST image = CHARACTER identity — face reference.
2. SECOND image = this character's PREVIOUS shot. Keep outfit, background, and setting IDENTICAL but vary the pose and body language naturally.\n\n`;
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
  if (!response.ok) {
    throw new Error(`Failed to download shot image: HTTP ${response.status}`);
  }
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
  if (charactersConfig.length < 2) {
    console.error(
      `[AROLL_MULTI] CRITICAL: characters_config has ${charactersConfig.length} entries for script ${scriptId}. ` +
      `Podcast a-roll-multi requires 2 characters. Fallback characterId=${characterId}. ` +
      `This likely means the script was saved without multi-character config.`,
    );
  } else {
    console.log(
      `[AROLL_MULTI] characters_config: ${JSON.stringify(charactersConfig)}`,
    );
  }
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
  const anchorByCharacter = new Map<number, string>();
  let bgUrl: string;
  let bgKey: string | undefined;
  const isAnchorScene = !settingAnchorKeys || settingAnchorKeys.length < 2;

  if (!isAnchorScene) {
    // --- Non-anchor scene: anchors exist from the first a-roll-multi scene ---
    // settingAnchorKeys layout: [bgImageKey, char0AnchorKey, char1AnchorKey]
    console.log(
      `[AROLL_MULTI] Scene ${sceneNumber}: Non-anchor — using existing anchors for all ${arollShots.length} shots`,
    );

    const anchorUrls = await getReferenceImageUrls(settingAnchorKeys!);
    bgUrl = anchorUrls[0];
    anchorByCharacter.set(0, settingAnchorKeys![1]);
    anchorByCharacter.set(1, settingAnchorKeys![2] || settingAnchorKeys![1]);
  } else {
    // --- Anchor scene: first a-roll-multi in the script ---
    // Step 1: Generate empty background
    console.log(
      `[AROLL_MULTI] Scene ${sceneNumber}: Anchor — generating background + 2 establishing shots`,
    );
    await updateProgress(jobId, 5, "Generating podcast studio background...");
    const bg = await generateBackground(teamId, scriptId, sceneId);
    bgUrl = bg.url;
    bgKey = bg.key;
    console.log(`[AROLL_MULTI] Background generated: ${bgKey}`);

    // Step 2: Generate 2 anchor shots in parallel (one per character)
    await updateProgress(jobId, 20, "Generating 2 establishing shots in parallel...");
    const anchorResults = await Promise.all(
      arollShots.slice(0, 2).map(async (shot, i) => {
        const charRef = await getCharRefs(shot.characterIndex);
        return generateShot(shot, i, sceneData, charRef, bgUrl, undefined, true, teamId, scriptId, sceneId, productName);
      }),
    );

    for (const { index, imageKey } of anchorResults) {
      generatedImages[index] = imageKey;
      anchorByCharacter.set(arollShots[index].characterIndex, imageKey);
    }

    if (arollShots.length <= 2) {
      // Store anchor data (bg + char establishing shots) so controller can pass to other scenes
      await storeAnchorData(jobId, bgKey, generatedImages[0], generatedImages[1]);
      return generatedImages;
    }
  }

  // --- All remaining shots are continuity ---
  const remainingShots = isAnchorScene ? arollShots.slice(2) : arollShots;
  const startIndex = isAnchorScene ? 2 : 0;

  await updateProgress(jobId, 50, `Generating ${remainingShots.length} continuity shots...`);

  const continuityResults = await Promise.all(
    remainingShots.map(async (shot, offsetIdx) => {
      const i = startIndex + offsetIdx;
      const charRef = await getCharRefs(shot.characterIndex);
      const sameCharRef = anchorByCharacter.get(shot.characterIndex);
      return generateShot(shot, i, sceneData, charRef, bgUrl, sameCharRef, false, teamId, scriptId, sceneId, productName);
    }),
  );

  for (const { index, imageKey } of continuityResults.sort((a, b) => a.index - b.index)) {
    generatedImages[index] = imageKey;
  }

  if (isAnchorScene && bgKey) {
    await storeAnchorData(jobId, bgKey, generatedImages[0], generatedImages[1]);
  }

  return generatedImages;
}
