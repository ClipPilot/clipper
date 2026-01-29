import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateCharacterJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { falImageService } from "../../services/ai-ugc/falImage.service";
import { notifyCharacterGenerated } from "../notify";

/**
 * Get presigned URLs for reference images (FAL needs public URLs)
 */
async function getReferenceImageUrls(imageKeys: string[]): Promise<string[]> {
  const MAX_REFERENCE_IMAGES = 5;
  const keysToFetch = imageKeys.slice(0, MAX_REFERENCE_IMAGES);
  const urls: string[] = [];

  for (const key of keysToFetch) {
    try {
      const url = await s3Service.getPresignedUrl(key, 3600); // 1 hour expiry
      urls.push(url);
      console.log(`[CHARACTER] Got presigned URL for reference: ${key}`);
    } catch (error) {
      console.error(`[CHARACTER] Failed to get URL for ${key}:`, error);
    }
  }

  return urls;
}

/**
 * Detailed character attribute mappings for rich prompt generation
 * The LLM uses these to create highly specific, consistent character descriptions
 */
const EYE_SHAPE_DETAILS: Record<string, string> = {
  round: "round expressive eyes with visible sclera above and below iris",
  almond: "almond-shaped eyes with gentle upward tilt at outer corners",
  hooded: "hooded eyes with subtle crease partially covered by brow bone",
  monolid: "monolid eyes with smooth eyelid and no visible crease",
  downturned: "downturned eyes with outer corners angling slightly downward",
  upturned: "upturned eyes with outer corners lifting naturally upward",
  deep_set: "deep-set eyes positioned further back under brow bone creating natural shadow",
};

const FACE_SHAPE_DETAILS: Record<string, string> = {
  oval: "oval face with smooth forehead tapering to a soft defined jawline and gently rounded chin",
  round: "round face with soft curved jawline and full cheeks",
  square: "square face with strong angular jawline and broad forehead",
  heart: "heart-shaped face with wider forehead tapering to a delicate pointed chin",
  oblong: "oblong face with elongated proportions and balanced features",
  diamond: "diamond-shaped face with high cheekbones and narrow forehead and chin",
};

const NOSE_DETAILS: Record<string, string> = {
  straight: "straight slender nose bridge with balanced proportions",
  button: "small button nose with rounded tip and subtle upturn",
  roman: "prominent nose bridge with slight convex curve",
  wide: "wider nose with broader bridge and rounded nostrils",
  narrow: "narrow refined nose with delicate bridge",
};

const LIP_DETAILS: Record<string, string> = {
  full: "full naturally pigmented lips with defined Cupid's bow where both lips are proportionally full",
  thin: "thinner natural lips with subtle definition",
  heart: "heart-shaped lips with pronounced Cupid's bow and fuller lower lip",
  wide: "wide expressive lips with natural color variation",
  balanced: "balanced soft lips with subtle Cupid's bow where upper lip is slightly thinner than fuller lower lip",
};

const SKIN_TEXTURE_DETAILS: Record<string, string> = {
  smooth: "smooth skin texture showing natural realistic pores with subtle luminosity and authentic micro-texture",
  textured: "natural skin texture with visible pores, subtle bumps, and authentic lived-in micro-details",
  mature: "mature skin with natural expression lines, subtle creases, and authentic weathered texture",
  youthful: "youthful skin with natural glow, visible pores, and subtle texture variations",
};

/**
 * Hyper-realistic skin description for maximum authenticity
 * This makes AI-generated characters look like real iPhone photos of real people
 */
const HYPER_REALISTIC_SKIN = `
CRITICAL SKIN REALISM (must include ALL of these natural imperfections):

PORES & TEXTURE:
- Visible pores across nose, cheeks, and forehead (larger on nose/T-zone, finer on cheeks)
- Natural skin texture variation - not uniform across the face
- Subtle bumpy texture on forehead and chin areas
- Fine texture lines visible on close inspection

NATURAL OILS & SHINE:
- Slight natural oil shine on T-zone (forehead, nose, chin)
- Subtle dewy quality on cheeks, not matte
- Natural sebum accumulation in pore areas
- Realistic skin moisture levels

IMPERFECTIONS (include 2-3 of these):
- Faint acne scars or texture irregularities
- Small moles or beauty marks in natural locations
- Subtle redness variations (around nose, cheeks)
- Barely visible tiny bumps or closed comedones
- Minor skin discoloration or uneven tone patches
- Faint freckles or sun spots if appropriate for skin tone
- Subtle undereye darkness or slight puffiness

COLOR VARIATIONS:
- Natural redness around nostrils and inner eye corners
- Subtle color gradient from center of face to edges
- Slightly different tone on neck vs face
- Natural flush on cheeks and ears
- Visible blood vessels faintly beneath thin skin areas (temples, undereye)

FINE DETAILS:
- Peach fuzz/vellus hair visible on cheeks and jawline catching sidelight
- Individual eyebrow hairs with natural direction variation
- Subtle stubble shadow if male (even when clean-shaven)
- Lip texture with natural vertical lines and slight dryness
- Authentic skin creases at expression areas (smile lines, forehead)

LIGHTING INTERACTION:
- Subsurface scattering showing skin translucency (ears, nose tip, fingers)
- Specular highlights on nose tip, cheekbones, forehead
- Soft shadows in skin folds and under features
- Natural skin reflectance, not plastic or waxy
`.trim();

/**
 * Negative prompt specifically for skin realism
 */
const SKIN_REALISM_NEGATIVE =
  "perfect skin, flawless skin, poreless skin, airbrushed skin, smooth plastic skin, " +
  "beauty filter, skin smoothing, porcelain skin, doll-like skin, wax figure skin, " +
  "CGI skin, rendered skin, uniform skin tone, perfectly even complexion, " +
  "no pores, no texture, no imperfections, mannequin skin, silicone skin, " +
  "overly matte skin, overly shiny skin, metallic skin, painted skin texture";

/**
 * Generates detailed facial feature description based on character attributes
 */
function generateFacialFeatureDescription(config: GenerateCharacterJob["config"]): string {
  // Select appropriate details based on available config or use sensible defaults
  const eyeShape = EYE_SHAPE_DETAILS.almond; // Default to almond, most universally flattering
  const faceShape = FACE_SHAPE_DETAILS.oval;
  const noseDetails = NOSE_DETAILS.straight;
  const lipDetails = LIP_DETAILS.balanced;
  const skinTexture = SKIN_TEXTURE_DETAILS.smooth;

  return `with ${eyeShape}, ${faceShape} with subtle high cheekbones, a ${noseDetails} with softly rounded tip, ${lipDetails}, well-groomed naturally arched eyebrows, ${config.appearance.skinTone} skin tone with ${skinTexture}`;
}

/**
 * Generates detailed hair description for character prompts
 */
function generateHairDescription(config: GenerateCharacterJob["config"]): string {
  const length = config.appearance.hairStyle?.toLowerCase().includes("short") ? "short" :
                 config.appearance.hairStyle?.toLowerCase().includes("long") ? "long" : "medium-length";

  const texture = config.appearance.hairStyle?.toLowerCase().includes("curly") ? "curly" :
                  config.appearance.hairStyle?.toLowerCase().includes("wavy") ? "wavy" : "straight";

  return `${length} ${texture} ${config.appearance.hairColor} hair styled naturally with authentic texture and movement`;
}

const buildCharacterPrompt = (
  config: GenerateCharacterJob["config"],
  variationIndex: number,
  isVariation: boolean = false
): string => {
  const variationHints = [
    "slight genuine smile reaching the eyes, relaxed shoulders, open body language toward camera",
    "neutral contemplative expression, direct confident gaze, subtle head tilt",
    "warm confident expression, slight natural head tilt, engaged posture",
    "friendly approachable expression, natural asymmetric smile, relaxed casual pose",
  ];

  const hint = variationHints[variationIndex % variationHints.length];

  const outfitText =
    config.style.outfit === "other" && config.style.outfitCustom
      ? config.style.outfitCustom
      : config.style.outfit;

  const userChanges = config.style.anythingElse || "";
  const hairDescription = generateHairDescription(config);
  const facialFeatures = generateFacialFeatureDescription(config);

  if (isVariation && userChanges) {
    return `Create a photorealistic portrait photograph of the EXACT SAME person with:

PRESERVE EXACTLY (DO NOT CHANGE):
- Face: Same facial features, bone structure, facial proportions, and identity
- Hair: ${hairDescription} - keep identical color, length, texture, and style
- Facial hair: If the original has beard, mustache, or stubble, keep it exactly the same. If clean-shaven, stay clean-shaven.
- Skin: ${config.appearance.skinTone} complexion with same texture, undertones, and imperfections - keep identical
- Skin imperfections: Preserve any moles, freckles, acne, redness patterns, or texture from the original
- Eyes: ${config.appearance.eyeColor} colored eyes with same shape and expressiveness - keep identical
- Body type: ${config.appearance.bodyType} build with same proportions - keep identical
- Age: ${config.ageRange} - keep identical
- Gender: ${config.gender} - keep identical
- Distinctive features: Maintain any moles, freckles, dimples, scars, or unique characteristics
- Accessories: If the original has glasses, piercings, or accessories, keep them. If not, do not add any.

CHANGES REQUESTED BY USER:
${userChanges}

VARIATION STYLE:
${hint}

${HYPER_REALISTIC_SKIN}

TECHNICAL REQUIREMENTS:
- The person must look like the EXACT SAME individual, just in a different situation
- THIS MUST LOOK LIKE A REAL HUMAN, NOT AI-GENERATED
- Photorealistic quality, indistinguishable from a real iPhone 15 Pro photograph
- Natural skin with ALL imperfections preserved from original: visible pores, bumps, oils, blemishes
- Authentic subsurface scattering showing skin translucency
- UGC/social media authentic aesthetic - NOT professional studio photography
- Sharp focus on the face with natural depth of field
- Vertical 3:4 aspect ratio composition
- Natural mixed lighting (daylight and warm interior tones)
- Visible micro-details: skin texture, peach fuzz, individual hair strands, natural eye moisture

REALISM CHECKLIST (verify all present):
□ Same skin imperfections as original (moles, texture, redness)
□ Visible pores on nose and cheeks
□ Natural oil shine on T-zone
□ Peach fuzz visible on face catching light
□ Authentic eye moisture and natural redness
□ Subsurface scattering on ears/nose

CRITICAL: This is the same person photographed in a different context. Maintain their identity, face shape, hair, facial hair, glasses, accessories, skin imperfections, and body exactly. Only change what the user requested above.

UGC AUTHENTICITY: smartphone selfie aesthetic, natural available light, subtle lens characteristics, authentic imperfect skin, real human texture, no beauty filters, raw unfiltered social media quality.

NEGATIVE: Do not change the person's face, do not change hair color or style, do not add facial hair if originally clean-shaven, do not add glasses or accessories that were not in the original, do not remove or add skin imperfections, ${SKIN_REALISM_NEGATIVE}, extra limbs, extra arms, extra hands, extra fingers, missing limbs, deformed hands, fused fingers, too many fingers, mutated hands, malformed limbs, bad anatomy, distorted body parts, cartoon style, illustration, deformed features, watermarks, text overlays, unnatural colors, oversaturated images, artificial bokeh, studio lighting, 3D render, CGI, digital art.`;
  }

  const anythingElseText = userChanges
    ? `\n\nADDITIONAL DETAILS:\n${userChanges}`
    : "";

  return `Create a photorealistic portrait photograph of a ${config.gender} person in their ${config.ageRange} age range.

CHARACTER DESCRIPTION:
A ${config.ageRange} ${config.gender} ${facialFeatures}, with ${config.appearance.bodyType} build.

HAIR:
${hairDescription}. Individual hair strands visible, natural flyaways, authentic texture catching light.

EYES:
${config.appearance.eyeColor} colored eyes with natural moisture creating subtle reflections, visible catch-lights from light source, authentic iris detail with natural color variations, slight redness in inner corners, visible fine blood vessels in sclera.

${HYPER_REALISTIC_SKIN}

SKIN TONE BASE:
${config.appearance.skinTone} complexion as the foundation, with all the natural variations and imperfections described above.

STYLE AND SETTING:
Wearing ${outfitText} attire that looks natural and lived-in, with realistic fabric texture and wrinkles.
Setting: ${config.style.setting || "cozy indoor"} environment with natural available light.

EXPRESSION AND POSE:
${hint}
${anythingElseText}

TECHNICAL REQUIREMENTS:
- Photorealistic quality, indistinguishable from a real iPhone 15 Pro photograph of a REAL person
- THIS MUST LOOK LIKE A REAL HUMAN, NOT AI-GENERATED
- Natural skin with ALL imperfections: visible pores, subtle bumps, natural oils, minor blemishes
- Authentic subsurface scattering showing skin translucency
- Direct eye contact with the camera creating genuine connection
- UGC/social media authentic aesthetic - NOT professional studio photography
- Sharp focus on the face with natural shallow depth of field
- Vertical 3:4 aspect ratio composition
- Natural mixed lighting with subtle color temperature variations (warm interior + cool daylight)
- Visible micro-details: individual hair strands, peach fuzz on skin, natural eye moisture, lip texture

REALISM CHECKLIST (verify all present):
□ Visible pores on nose and cheeks
□ Natural oil shine on T-zone
□ At least 2-3 minor skin imperfections (moles, redness, texture variation)
□ Peach fuzz visible on face catching light
□ Natural color variation across face
□ Authentic eye moisture and redness
□ Subsurface scattering on ears/nose

UGC AUTHENTICITY KEYWORDS:
smartphone selfie, iPhone 15 Pro front camera, handheld realism, natural available light, influencer-style portrait, direct-to-camera, raw unfiltered aesthetic, authentic imperfect skin, real human texture, casual intimate framing, no beauty filter, no skin smoothing.

NEGATIVE: ${SKIN_REALISM_NEGATIVE}, extra limbs, extra arms, extra hands, extra fingers, missing limbs, deformed hands, fused fingers, too many fingers, mutated hands, malformed limbs, bad anatomy, distorted body parts, cartoon style, illustration, deformed features, watermarks, text overlays, unnatural colors, oversaturated images, studio lighting, professional photography aesthetic, 3D render, CGI, digital art, painting, drawing.`;
};

async function generateSingleImage(
  prompt: string,
  teamId: number,
  jobId: string,
  index: number,
  referenceImageUrls?: string[]
): Promise<string | null> {
  try {
    const result = await falImageService.generateImageWithRetry({
      prompt,
      aspectRatio: "3:4",
      imageUrls: referenceImageUrls,
      usePro: true,
    });

    // Download image from FAL URL and upload to S3
    const response = await fetch(result.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image from FAL: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const s3Key = await s3Service.uploadCharacterImage(
      buffer,
      teamId,
      jobId,
      index
    );

    return s3Key;
  } catch (error) {
    console.error(`Failed to generate character image variant ${index}:`, error);
    return null;
  }
}

async function updateJobProgress(
  jobId: string,
  progress: number,
  message: string
): Promise<void> {
  await db
    .update(schema.characterGenerationJobs)
    .set({
      progress,
      progress_message: message,
    })
    .where(eq(schema.characterGenerationJobs.id, jobId));
}

export async function processCharacterJob(
  job: GenerateCharacterJob
): Promise<void> {
  const { jobId, teamId, userId, config, parentCharacterId } = job;

  console.log(`[CHARACTER] Starting FAL AI generation for job ${jobId}`);

  try {
    await db
      .update(schema.characterGenerationJobs)
      .set({
        status: "generating",
        started_at: new Date(),
        progress: 0,
        progress_message: "Starting image generation...",
      })
      .where(eq(schema.characterGenerationJobs.id, jobId));

    const isVariation = !!parentCharacterId;

    // Get presigned URLs for reference images (FAL needs public URLs)
    let referenceImageUrls: string[] = [];
    if (config.referenceImages && config.referenceImages.length > 0) {
      await updateJobProgress(jobId, 5, "Preparing reference images...");
      console.log(`[CHARACTER] Getting presigned URLs for ${config.referenceImages.length} reference images`);
      referenceImageUrls = await getReferenceImageUrls(config.referenceImages);
      console.log(`[CHARACTER] Got ${referenceImageUrls.length} reference image URLs`);
    }

    const hasReferenceImages = referenceImageUrls.length > 0;
    const prompts = [0, 1, 2, 3].map((i) => {
      let prompt = buildCharacterPrompt(config, i, isVariation);

      // Add reference image instructions if we have them
      if (hasReferenceImages) {
        prompt = `REFERENCE IMAGES PROVIDED: Use the provided reference images to maintain consistent character identity. The generated image must depict the EXACT SAME person shown in the reference images.

${prompt}

CRITICAL: Match the person's facial features, bone structure, and overall appearance from the reference images exactly. This is the same individual - maintain their unique identity.`;
      }

      return prompt;
    });
    const basePrompt = prompts[0];

    const progressMsg = hasReferenceImages
      ? `Generating 4 variants with ${referenceImageUrls.length} reference images...`
      : "Generating 4 character variants...";
    await updateJobProgress(jobId, 10, progressMsg);

    const generationPromises = prompts.map((prompt, i) =>
      generateSingleImage(prompt, teamId, jobId, i, hasReferenceImages ? referenceImageUrls : undefined)
    );

    const results = await Promise.all(generationPromises);
    const successfulImages = results.filter((key): key is string => key !== null);

    if (successfulImages.length === 0) {
      throw new Error("Failed to generate any images");
    }

    console.log(
      `[CHARACTER] Generated ${successfulImages.length}/4 images for job ${jobId}`
    );

    await db
      .update(schema.characterGenerationJobs)
      .set({
        status: "completed",
        progress: 100,
        progress_message: `Generated ${successfulImages.length} images`,
        generated_images: successfulImages,
        generation_prompt: basePrompt,
        completed_at: new Date(),
      })
      .where(eq(schema.characterGenerationJobs.id, jobId));

    await notifyCharacterGenerated(teamId, jobId);

    console.log(`[CHARACTER] Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[CHARACTER] Job ${jobId} failed:`, error);

    await db
      .update(schema.characterGenerationJobs)
      .set({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date(),
      })
      .where(eq(schema.characterGenerationJobs.id, jobId));
  }
}
