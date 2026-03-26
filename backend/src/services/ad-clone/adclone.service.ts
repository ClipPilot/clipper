import { db } from "../../db";
import { adCloneProjects, characters } from "@clipper/shared-db";
import { eq } from "drizzle-orm";
import { s3Service } from "../s3.service";
import {
  uploadVideoToGemini,
  cleanupGeminiResources,
  GeminiVideoUploadResult,
  GeminiUploadedFile,
} from "./gemini.service";
import { VideoAnalysisSchema } from "../../types/adClone.types";
import {
  AdCloneProject,
  AdCloneProjectStatus,
  VideoAnalysis,
} from "../../types/adClone.types";
import { UGCScript } from "../../types/ugcScript.types";
import { ugcScriptService } from "../ai-ugc/ugcScript.service";
import { sanitizeErrorForFrontend } from "../../utils/errorSanitizer";
import { mergeConsecutiveArollStructure } from "../ai-ugc/ugcScript.service";
import { config } from "../../config/env";
import fs from "fs";
import path from "path";
import os from "os";

export interface CreateProjectInput {
  teamId: number;
  userId: number;
  productImageKeys: string[];
  productName?: string;
  productDescription?: string;
  adDirection?: string;
}

export interface CreateProjectResult {
  projectId: string;
  uploadUrls: {
    video: { uploadUrl: string; s3Key: string };
    productImages: { uploadUrl: string; s3Key: string }[];
  };
}

class AdCloneService {
  async createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
    const [project] = await db
      .insert(adCloneProjects)
      .values({
        team_id: input.teamId,
        user_id: input.userId,
        product_image_keys: input.productImageKeys,
        product_name: input.productName || null,
        product_description: input.productDescription || null,
        ad_direction: input.adDirection || null,
        status: "uploading",
        progress: 0,
        progress_message: "Waiting for video upload...",
      })
      .returning();

    const uploadUrls = await s3Service.getAdCloneUploadUrls(
      input.teamId,
      project.id,
      "reference_video.mp4",
      input.productImageKeys.map((_, i) => `product_image_${i}.jpg`)
    );

    return {
      projectId: project.id,
      uploadUrls,
    };
  }

  async getProject(projectId: string): Promise<AdCloneProject | null> {
    const [project] = await db
      .select()
      .from(adCloneProjects)
      .where(eq(adCloneProjects.id, projectId))
      .limit(1);

    if (!project) return null;

    return this.mapDbToProject(project);
  }

  async updateProjectStatus(
    projectId: string,
    status: AdCloneProjectStatus,
    progress: number,
    progressMessage?: string,
    errorMessage?: string
  ): Promise<void> {
    await db
      .update(adCloneProjects)
      .set({
        status,
        progress,
        progress_message: progressMessage || null,
        error_message: errorMessage || null,
        updated_at: new Date(),
      })
      .where(eq(adCloneProjects.id, projectId));
  }

  async setVideoUploaded(
    projectId: string,
    referenceVideoKey: string,
    productImageKeys: string[]
  ): Promise<void> {
    await db
      .update(adCloneProjects)
      .set({
        reference_video_key: referenceVideoKey,
        product_image_keys: productImageKeys,
        status: "uploading",
        progress: 5,
        progress_message: "Video uploaded, ready for analysis",
        updated_at: new Date(),
      })
      .where(eq(adCloneProjects.id, projectId));
  }

  async analyzeVideo(projectId: string): Promise<VideoAnalysis> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (!project.referenceVideoKey) {
      throw new Error("Reference video not uploaded");
    }

    await this.updateProjectStatus(
      projectId,
      "analyzing",
      10,
      "Downloading reference video..."
    );

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "adclone-"));
    const localVideoPath = path.join(tempDir, "reference.mp4");

    let uploadResult: GeminiVideoUploadResult | null = null;

    try {
      await s3Service.downloadFile(project.referenceVideoKey, localVideoPath);

      await this.updateProjectStatus(
        projectId,
        "analyzing",
        20,
        "Uploading video for analysis..."
      );

      uploadResult = await uploadVideoToGemini(localVideoPath);

      await db
        .update(adCloneProjects)
        .set({
          gemini_file_name: uploadResult.file.name,
          gemini_file_uri: uploadResult.file.uri,
          updated_at: new Date(),
        })
        .where(eq(adCloneProjects.id, projectId));

      await this.updateProjectStatus(
        projectId,
        "analyzing",
        40,
        "Analyzing video structure with AI..."
      );

      const agentServiceUrl = config.agentService.url;
      const maxAttempts = 3;
      let rawAnalysis: any;
      let lastError = "";

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const userContent: any[] = [
          { type: "file", data: uploadResult.file.uri, mimeType: uploadResult.file.mimeType },
          { type: "text", text: "Analyze this video." },
        ];

        if (lastError) {
          userContent.push({
            type: "text",
            text: `Your previous attempt failed validation: ${lastError}. Fix the invalid fields and try again.`,
          });
        }

        const agentResponse = await fetch(
          `${agentServiceUrl}/api/agents/video-analysis-agent/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: userContent }],
            }),
            signal: AbortSignal.timeout(180_000),
          },
        );

        if (agentResponse.ok) {
          const agentResult = (await agentResponse.json()) as any;
          rawAnalysis = agentResult.object ?? agentResult;
          if (rawAnalysis?.totalDuration) break;
        }

        lastError = !agentResponse.ok ? await agentResponse.text() : "Agent returned no video analysis";

        if (attempt < maxAttempts) {
          console.warn(`[AD_CLONE] Video analysis attempt ${attempt}/${maxAttempts} failed: ${lastError}. Retrying...`);
          continue;
        }

        console.error("[AD_CLONE] Video analysis agent error after all attempts:", lastError);
        throw new Error("Video analysis failed via agent");
      }

      const analysis = VideoAnalysisSchema.parse(rawAnalysis);

      await db
        .update(adCloneProjects)
        .set({
          video_analysis: analysis,
          status: "analysis_complete",
          progress: 100,
          progress_message: "Analysis complete",
          updated_at: new Date(),
        })
        .where(eq(adCloneProjects.id, projectId));

      return analysis;
    } catch (error) {
      const errorMessage = sanitizeErrorForFrontend(error, "Analysis failed. Please try again.");
      await this.updateProjectStatus(
        projectId,
        "failed",
        0,
        "Analysis failed",
        errorMessage
      );
      throw error;
    } finally {
      if (uploadResult) {
        await cleanupGeminiResources(
          uploadResult.reEncodedPath,
          uploadResult.file.name
        );
      }

      if (fs.existsSync(localVideoPath)) {
        fs.unlinkSync(localVideoPath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, { recursive: true });
      }
    }
  }

  async initStructureFromAnalysis(params: {
    projectId: string;
    message: string;
    productImageKeys?: string[];
    threadId?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  }) {
    const { projectId, message, productImageKeys, threadId, conversationHistory } = params;

    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const content: Array<{ type: string; text?: string; image?: string; mediaType?: string }> = [];

    if (productImageKeys?.length) {
      const presignedUrls = await Promise.all(
        productImageKeys.map((key) => s3Service.getPresignedUrl(key)),
      );
      for (const url of presignedUrls) {
        content.push({ type: "image", image: url, mediaType: "image/jpeg" });
      }
    }

    if (!project.videoAnalysis) {
      throw new Error("Video analysis not complete. Please wait for analysis to finish before generating a script.");
    }

    let messageText = message;
    {
      const analysis = project.videoAnalysis;
      const analysisLines: string[] = [];

      analysisLines.push("=== VIDEO ANALYSIS ===");
      analysisLines.push("");
      analysisLines.push(`Total duration: ${analysis.totalDuration}s`);
      analysisLines.push(`Aspect ratio: ${analysis.aspectRatio}`);
      analysisLines.push(`Overall style: ${analysis.overallStyle}`);
      analysisLines.push(`Pacing: ${analysis.pacing}`);
      analysisLines.push(`Hook strategy: ${analysis.hookStrategy}`);
      analysisLines.push(`CTA approach: ${analysis.ctaApproach}`);
      analysisLines.push(`Target demographic: ${analysis.targetDemographic}`);
      analysisLines.push(`Overall narrative: ${analysis.overallNarrative}`);

      if (analysis.keyStrengths?.length) {
        analysisLines.push("");
        analysisLines.push("Key strengths:");
        analysis.keyStrengths.forEach((s: string) => analysisLines.push(`- ${s}`));
      }

      analysisLines.push("");
      analysisLines.push("Scene-by-scene breakdown:");
      for (const scene of analysis.scenes) {
        analysisLines.push(`  Scene ${scene.sceneNumber} (${scene.durationSeconds}s): ${scene.sceneType} / ${scene.shotType}`);
        analysisLines.push(`    Emotion: ${scene.emotionalTone}`);
        if (scene.transcribedDialogue) {
          analysisLines.push(`    Dialogue: "${scene.transcribedDialogue}"`);
        }
        analysisLines.push(`    Action: ${scene.actionDescription}`);
        analysisLines.push(`    Setting: ${scene.settingDescription}`);
      }

      if (message) {
        analysisLines.push("");
        analysisLines.push("=== USER DIRECTION ===");
        analysisLines.push(message);
      }

      if (project.productName) {
        analysisLines.push("");
        analysisLines.push(`Product name: ${project.productName}`);
      }
      if (project.productDescription) {
        analysisLines.push(`Product description: ${project.productDescription}`);
      }
      if (project.adDirection) {
        analysisLines.push(`Ad direction: ${project.adDirection}`);
      }

      messageText = analysisLines.join("\n");
    }

    content.push({ type: "text", text: messageText });

    const messages: Array<{ role: string; content: unknown }> = [];
    if (conversationHistory?.length) {
      for (const msg of conversationHistory.slice(0, -1)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: "user", content });

    const agentServiceUrl = config.agentService.url;
    const requestBody: Record<string, unknown> = { messages };

    if (threadId) {
      requestBody.memory = {
        thread: threadId,
        resource: "ad-clone-chat",
      };
    }

    const deconstructorUrl = `${agentServiceUrl}/api/agents/ad-deconstructor-agent/generate`;
    const deconstructorFetchOptions: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120_000),
    };

    let response!: globalThis.Response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(deconstructorUrl, deconstructorFetchOptions);
        if (response.ok) break;

        const errorBody = await response.text();
        const isGatewayError = response.status === 502 || response.status === 503 || response.status === 504;
        if (!isGatewayError || attempt === 1) {
          console.error("[AD_CLONE] Ad deconstructor agent error:", errorBody);
          throw new Error("Failed to generate structure from ad deconstructor agent");
        }
        console.warn(`[AD_CLONE] Deconstructor returned ${response.status}, retrying...`);
        await new Promise((r) => setTimeout(r, 3000));
      } catch (err) {
        if (err instanceof Error && err.message === "Failed to generate structure from ad deconstructor agent") throw err;
        if (attempt === 1) {
          console.error("[AD_CLONE] Deconstructor fetch error:", err);
          throw new Error("Failed to generate structure from ad deconstructor agent");
        }
        console.warn("[AD_CLONE] Deconstructor fetch failed, retrying...", err);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    const result = (await response.json()) as Record<string, unknown>;
    const agentResult = (result.object ?? result) as {
      responseType: "conversation" | "script";
      message: string;
      isSilent: boolean;
      character: boolean;
      videoType: string;
      targetAudience: string;
      title: string;
      totalDuration: number;
      scenes: Array<{
        sceneNumber: number;
        slug: string;
        sceneType: string;
        storyBeat: string;
        dialogue: string;
        isSilent: boolean;
        duration: number;
        action: string;
        imageGenPrompt: string;
        cinematicPrompt: string;
        ambientSound: string | null;
        shots: any[];
      }>;
    };

    if (agentResult.title && agentResult.responseType === "script") {
      await db
        .update(adCloneProjects)
        .set({
          product_name: agentResult.title,
          updated_at: new Date(),
        })
        .where(eq(adCloneProjects.id, projectId));
    }

    return agentResult;
  }

  async generateAdaptedScript(
    projectId: string,
    characterId?: number
  ): Promise<UGCScript> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (!project.videoAnalysis) {
      throw new Error("Video analysis not complete");
    }

    let character: any = null;
    if (characterId) {
      const [foundCharacter] = await db
        .select()
        .from(characters)
        .where(eq(characters.id, characterId))
        .limit(1);

      if (!foundCharacter) {
        throw new Error("Character not found");
      }
      character = foundCharacter;
    }

    await db
      .update(adCloneProjects)
      .set({
        ...(characterId && { character_id: characterId }),
        status: "generating_script",
        progress: 10,
        progress_message: "Generating adapted script...",
        updated_at: new Date(),
      })
      .where(eq(adCloneProjects.id, projectId));

    try {
      await this.updateProjectStatus(
        projectId,
        "generating_script",
        30,
        "Analyzing product images..."
      );

      const productImageUrls = await Promise.all(
        project.productImageKeys.map((key) => s3Service.getPresignedUrl(key, 3600))
      );

      const scriptDirection = this.buildScriptDirectionFromAnalysis(
        project.videoAnalysis,
        project.adDirection
      );

      const customPattern = project.videoAnalysis.scenes.map((scene) => ({
        type: scene.sceneType,
        shot: scene.shotType,
      }));

      const effectiveCharacter = character
        ? {
            id: character.id,
            name: character.name,
            gender: character.gender,
            age_range: character.age_range,
            appearance_config: character.appearance_config,
          }
        : {
            id: 0,
            name: "The Presenter",
            gender: "unspecified" as string | null,
            age_range: "25-35" as string | null,
            appearance_config: null,
          };

      const scripts = await ugcScriptService.generateScripts({
        productImageUrls,
        productName: project.productName || undefined,
        productDescription: project.productDescription || undefined,
        scriptDirection,
        character: effectiveCharacter,
        targetDuration: project.videoAnalysis.totalDuration,
        numberOfVariations: 1,
        structureId: "custom",
        customPattern,
      });

      const adaptedScript = scripts[0];
      if (!adaptedScript) {
        throw new Error("Failed to generate adapted script");
      }

      await db
        .update(adCloneProjects)
        .set({
          adapted_scripts: [adaptedScript],
          selected_variant_index: 0,
          status: "script_generated",
          progress: 100,
          progress_message: "Script generation complete",
          updated_at: new Date(),
        })
        .where(eq(adCloneProjects.id, projectId));

      return adaptedScript;
    } catch (error) {
      const errorMessage = sanitizeErrorForFrontend(error, "Script generation failed. Please try again.");
      await this.updateProjectStatus(
        projectId,
        "failed",
        0,
        "Script generation failed",
        errorMessage
      );
      throw error;
    }
  }

  async updateScript(
    projectId: string,
    script: UGCScript,
    selectedVariantIndex?: number
  ): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const scripts = project.adaptedScripts || [];
    const variantIndex = selectedVariantIndex ?? project.selectedVariantIndex;

    if (scripts.length === 0) {
      scripts.push(script);
    } else {
      scripts[variantIndex] = script;
    }

    await db
      .update(adCloneProjects)
      .set({
        adapted_scripts: scripts,
        selected_variant_index: variantIndex,
        updated_at: new Date(),
      })
      .where(eq(adCloneProjects.id, projectId));
  }

  async setVideoJobId(projectId: string, videoJobId: string): Promise<void> {
    await db
      .update(adCloneProjects)
      .set({
        video_job_id: videoJobId,
        status: "generating_video",
        progress: 0,
        progress_message: "Video generation queued...",
        updated_at: new Date(),
      })
      .where(eq(adCloneProjects.id, projectId));
  }

  async setFinalVideo(projectId: string, finalVideoKey: string): Promise<void> {
    await db
      .update(adCloneProjects)
      .set({
        final_video_key: finalVideoKey,
        status: "completed",
        progress: 100,
        progress_message: "Video generation complete",
        updated_at: new Date(),
      })
      .where(eq(adCloneProjects.id, projectId));
  }

  private buildScriptDirectionFromAnalysis(
    analysis: VideoAnalysis,
    adDirection?: string | null
  ): string {
    const lines: string[] = [];

    lines.push("=== AD CLONE: Recreate this video's style and structure ===");
    lines.push("");
    lines.push(`Original video duration: ${analysis.totalDuration} seconds`);
    lines.push(`Overall style: ${analysis.overallStyle}`);
    lines.push(`Pacing: ${analysis.pacing}`);
    lines.push(`Hook strategy: ${analysis.hookStrategy}`);
    lines.push(`CTA approach: ${analysis.ctaApproach}`);
    lines.push(`Target demographic: ${analysis.targetDemographic}`);
    lines.push(`Narrative arc: ${analysis.overallNarrative}`);

    if (analysis.keyStrengths.length > 0) {
      lines.push("");
      lines.push("Key strengths to replicate:");
      analysis.keyStrengths.forEach((s) => lines.push(`- ${s}`));
    }

    lines.push("");
    lines.push("=== SCENE-BY-SCENE REFERENCE ===");
    analysis.scenes.forEach((scene) => {
      lines.push(`Scene ${scene.sceneNumber} (${scene.durationSeconds}s): ${scene.sceneType} / ${scene.shotType}`);
      lines.push(`  Emotion: ${scene.emotionalTone}`);
      if (scene.transcribedDialogue) {
        lines.push(`  Original dialogue style: "${scene.transcribedDialogue}"`);
      }
      lines.push(`  Action: ${scene.actionDescription}`);
      lines.push(`  Setting: ${scene.settingDescription}`);
    });

    if (adDirection) {
      lines.push("");
      lines.push("=== ADDITIONAL USER DIRECTION ===");
      lines.push(adDirection);
    }

    return lines.join("\n");
  }

  private mapDbToProject(dbProject: any): AdCloneProject {
    return {
      id: dbProject.id,
      teamId: dbProject.team_id,
      userId: dbProject.user_id,
      referenceVideoKey: dbProject.reference_video_key,
      productImageKeys: dbProject.product_image_keys as string[],
      productName: dbProject.product_name,
      productDescription: dbProject.product_description,
      adDirection: dbProject.ad_direction,
      geminiFileName: dbProject.gemini_file_name,
      geminiFileUri: dbProject.gemini_file_uri,
      videoAnalysis: dbProject.video_analysis as VideoAnalysis | null,
      adaptedScripts: dbProject.adapted_scripts as UGCScript[] | null,
      selectedVariantIndex: dbProject.selected_variant_index,
      characterId: dbProject.character_id,
      voiceId: dbProject.voice_id,
      status: dbProject.status as AdCloneProjectStatus,
      progress: dbProject.progress,
      progressMessage: dbProject.progress_message,
      errorMessage: dbProject.error_message,
      finalVideoKey: dbProject.final_video_key,
      videoJobId: dbProject.video_job_id,
      createdAt: dbProject.created_at,
      updatedAt: dbProject.updated_at,
    };
  }
}

export const adCloneService = new AdCloneService();
