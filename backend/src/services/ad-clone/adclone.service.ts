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
import { analyzeVideoWithGemini } from "./videoAnalysis.service";
import { scriptAdaptationService } from "./scriptAdaptation.service";
import {
  AdCloneProject,
  AdCloneProjectStatus,
  VideoAnalysis,
} from "../../types/adClone.types";
import { UGCScript } from "../../types/ugcScript.types";
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
        "Uploading to Gemini for analysis..."
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

      const analysis = await analyzeVideoWithGemini(uploadResult.file);

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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
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

  async generateAdaptedScript(
    projectId: string,
    characterId: number
  ): Promise<UGCScript> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (!project.videoAnalysis) {
      throw new Error("Video analysis not complete");
    }

    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .limit(1);

    if (!character) {
      throw new Error("Character not found");
    }

    await db
      .update(adCloneProjects)
      .set({
        character_id: characterId,
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

      const adaptedScript = await scriptAdaptationService.adaptScript({
        videoAnalysis: project.videoAnalysis,
        productImageKeys: project.productImageKeys,
        productName: project.productName || "Product",
        productDescription: project.productDescription || "",
        character: {
          id: character.id,
          name: character.name,
          gender: character.gender,
          age_range: character.age_range,
          appearance_config: character.appearance_config,
        },
        adDirection: project.adDirection || undefined,
      });

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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
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

  async deleteProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;

    if (project.referenceVideoKey) {
      try {
        await s3Service.deleteObject(project.referenceVideoKey);
      } catch (e) {
        console.warn("Failed to delete reference video:", e);
      }
    }

    if (project.finalVideoKey) {
      try {
        await s3Service.deleteObject(project.finalVideoKey);
      } catch (e) {
        console.warn("Failed to delete final video:", e);
      }
    }

    await db
      .delete(adCloneProjects)
      .where(eq(adCloneProjects.id, projectId));
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
