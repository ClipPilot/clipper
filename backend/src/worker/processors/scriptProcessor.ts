import { zodTextFormat } from "openai/helpers/zod";
import { randomUUID } from "crypto";
import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateScriptJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import {
  generateUGCScriptPrompt,
  UGCScriptPromptConfig,
} from "../../config/ugcPrompts";
import {
  GenerateUGCScriptResponseSchema,
  UGCScript,
} from "../../types/ugcScript.types";
import { notifyScriptJobUpdate } from "../notify";
import { openaiClient as client } from "../../services/openai.service";
import { mergeConsecutiveArollScenes } from "../../services/ai-ugc/ugcScript.service";

async function updateJobProgress(
  jobId: string,
  teamId: number,
  progress: number,
  message: string
): Promise<void> {
  await db
    .update(schema.ugcScripts)
    .set({
      progress,
      progress_message: message,
    })
    .where(eq(schema.ugcScripts.id, jobId));

  await notifyScriptJobUpdate(teamId, {
    scriptId: jobId,
    status: "generating",
    progress,
    progressMessage: message,
  });
}

function formatAppearanceConfig(config: any): string {
  if (!config) return "No specific appearance details";

  const parts: string[] = [];
  if (config.hairColor) parts.push(`${config.hairColor} hair`);
  if (config.hairStyle) parts.push(`${config.hairStyle} hairstyle`);
  if (config.skinTone) parts.push(`${config.skinTone} skin tone`);
  if (config.eyeColor) parts.push(`${config.eyeColor} eyes`);
  if (config.bodyType) parts.push(`${config.bodyType} build`);

  return parts.length > 0 ? parts.join(", ") : "No specific appearance details";
}

async function analyzeProductImages(imageUrls: string[]): Promise<string[]> {
  const imageContent = imageUrls.map((url) => ({
    type: "input_image" as const,
    image_url: url,
    detail: "low" as const,
  }));

  const response = await client.responses.create({
    model: "gpt-5.2",
    input: [
      {
        role: "user",
        content: [
          ...imageContent,
          {
            type: "input_text",
            text: `Analyze these product images. For each image, provide a brief description (1-2 sentences) covering:
- What the product is
- Key visual features
- Any text/branding visible
- The setting/context

Return a JSON object with a "descriptions" array of strings, one description per image.`,
          },
        ],
      },
    ],
    text: { format: { type: "json_object" } },
  });

  try {
    const parsed = JSON.parse(response.output_text || "{}");
    return parsed.descriptions || imageUrls.map(() => "Product image");
  } catch {
    return imageUrls.map(() => "Product image");
  }
}

export async function processScriptJob(job: GenerateScriptJob): Promise<void> {
  const {
    jobId,
    teamId,
    characterId,
    productImageKeys,
    productName,
    scriptDirection,
    targetDuration,
    numberOfVariations,
    structureId,
    customPattern,
  } = job;

  console.log(`[SCRIPT] Starting generation for job ${jobId}`);

  try {
    await db
      .update(schema.ugcScripts)
      .set({
        status: "generating",
        started_at: new Date(),
        progress: 0,
        progress_message: "Starting script generation...",
      })
      .where(eq(schema.ugcScripts.id, jobId));

    await updateJobProgress(jobId, teamId, 10, "Loading character data...");

    const [character] = await db
      .select()
      .from(schema.characters)
      .where(eq(schema.characters.id, characterId));

    if (!character) {
      throw new Error("Character not found");
    }

    let productImageUrls: string[] = [];
    let imageDescriptions: string[] = [];

    if (productImageKeys && productImageKeys.length > 0) {
      await updateJobProgress(jobId, teamId, 20, "Analyzing product images...");

      productImageUrls = await Promise.all(
        productImageKeys.map((key) => s3Service.getPresignedUrl(key, 3600))
      );

      imageDescriptions = await analyzeProductImages(productImageUrls);
    }

    await updateJobProgress(jobId, teamId, 40, "Generating script variations...");

    const appearanceDesc = formatAppearanceConfig(character.appearance_config);

    const promptConfig: UGCScriptPromptConfig = {
      productName,
      productDescription: undefined,
      productImageDescriptions: imageDescriptions,
      characterName: character.name,
      characterGender: character.gender || "unspecified",
      characterAgeRange: character.age_range || "25-35",
      characterAppearance: appearanceDesc,
      scriptDirection,
      targetDuration,
      numberOfVariations,
      structureId,
      customPattern,
    };

    const prompt = generateUGCScriptPrompt(promptConfig);

    const imageContent = productImageUrls.map((url) => ({
      type: "input_image" as const,
      image_url: url,
      detail: "high" as const,
    }));

    await updateJobProgress(jobId, teamId, 60, "AI is writing your scripts...");

    const response = await client.responses.parse({
      model: "gpt-5.2",
      input: [
        {
          role: "user",
          content: [
            ...imageContent,
            { type: "input_text", text: prompt },
          ],
        },
      ],
      text: {
        format: zodTextFormat(GenerateUGCScriptResponseSchema, "ugc_script_response"),
      },
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      throw new Error("Failed to parse script response");
    }

    await updateJobProgress(jobId, teamId, 80, "Processing script data...");

    const scripts = parsed.scripts || [];

    scripts.forEach((script) => {
      script.scenes.forEach((scene) => {
        if (!scene.id) {
          scene.id = randomUUID();
        }
      });

      const originalCount = script.scenes.length;
      const shotTypes = script.scenes.map(s => s.shotType);
      console.log(`[SCRIPT] Before merge: ${originalCount} scenes, shotTypes: ${JSON.stringify(shotTypes)}`);

      script.scenes = mergeConsecutiveArollScenes(script.scenes);

      console.log(`[SCRIPT] After merge: ${script.scenes.length} scenes`);
      if (script.scenes.length < originalCount) {
        console.log(`[SCRIPT] Merged ${originalCount} scenes into ${script.scenes.length} (combined consecutive a-rolls)`);
      }
    });

    await updateJobProgress(jobId, teamId, 90, "Saving scripts...");

    await db
      .update(schema.ugcScripts)
      .set({
        status: "completed",
        progress: 100,
        progress_message: `Generated ${scripts.length} script variations`,
        scripts_data: scripts,
        completed_at: new Date(),
      })
      .where(eq(schema.ugcScripts.id, jobId));

    // Emit completion via WebSocket (includes scripts)
    await notifyScriptJobUpdate(teamId, {
      scriptId: jobId,
      status: "completed",
      progress: 100,
      progressMessage: `Generated ${scripts.length} script variations`,
      scripts,
    });

    console.log(`[SCRIPT] Job ${jobId} completed successfully with ${scripts.length} variations`);
  } catch (error) {
    console.error(`[SCRIPT] Job ${jobId} failed:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await db
      .update(schema.ugcScripts)
      .set({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date(),
      })
      .where(eq(schema.ugcScripts.id, jobId));

    await notifyScriptJobUpdate(teamId, {
      scriptId: jobId,
      status: "failed",
      progress: 0,
      progressMessage: "Script generation failed",
      error: errorMessage,
    });
  }
}
