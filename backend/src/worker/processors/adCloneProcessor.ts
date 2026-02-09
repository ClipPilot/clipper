import * as Sentry from "@sentry/node";
import {
  AdCloneAnalyzeJob,
  AdCloneGenerateScriptJob,
  AdCloneAnalyzeAndScriptJob,
} from "../../services/sqs.service";
import { adCloneService } from "../../services/ad-clone/adclone.service";
import { notifyAdCloneJobUpdate } from "../notify";
import { sanitizeErrorForFrontend } from "../../utils/errorSanitizer";

export async function processAdCloneAnalyzeJob(
  job: AdCloneAnalyzeJob
): Promise<void> {
  const { projectId, teamId } = job;

  console.log(`[AD_CLONE_ANALYZE] Starting analysis for project ${projectId}`);

  try {
    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "analyzing",
      progress: 5,
      progressMessage: "Starting video analysis...",
    });

    const analysis = await adCloneService.analyzeVideo(projectId);

    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "analysis_complete",
      progress: 100,
      progressMessage: "Analysis complete",
      analysis,
    });

    console.log(
      `[AD_CLONE_ANALYZE] Analysis complete for project ${projectId}`
    );
  } catch (error) {
    const errorMessage =
      sanitizeErrorForFrontend(error, "Operation failed. Please try again.");

    console.error(`[AD_CLONE_ANALYZE] Error analyzing project ${projectId}:`, error);
    Sentry.captureException(error);

    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "failed",
      progress: 0,
      progressMessage: "Analysis failed",
      error: errorMessage,
    });

    throw error;
  }
}

export async function processAdCloneGenerateScriptJob(
  job: AdCloneGenerateScriptJob
): Promise<void> {
  const { projectId, teamId, characterId } = job;

  console.log(
    `[AD_CLONE_SCRIPT] Starting script generation for project ${projectId}`
  );

  try {
    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "generating_script",
      progress: 5,
      progressMessage: "Starting script adaptation...",
    });

    const script = await adCloneService.generateAdaptedScript(
      projectId,
      characterId
    );

    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "script_generated",
      progress: 100,
      progressMessage: "Script generation complete",
      scripts: [script],
    });

    console.log(
      `[AD_CLONE_SCRIPT] Script generated for project ${projectId}`
    );
  } catch (error) {
    const errorMessage =
      sanitizeErrorForFrontend(error, "Operation failed. Please try again.");

    console.error(
      `[AD_CLONE_SCRIPT] Error generating script for project ${projectId}:`,
      error
    );
    Sentry.captureException(error);

    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "failed",
      progress: 0,
      progressMessage: "Script generation failed",
      error: errorMessage,
    });

    throw error;
  }
}

export async function processAdCloneAnalyzeAndScriptJob(
  job: AdCloneAnalyzeAndScriptJob
): Promise<void> {
  const { projectId, teamId } = job;

  console.log(
    `[AD_CLONE_COMBINED] Starting analyze + script for project ${projectId}`
  );

  try {
    // Phase 1: Analysis (0-50%)
    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "analyzing",
      progress: 5,
      progressMessage: "Starting video analysis...",
    });

    const analysis = await adCloneService.analyzeVideo(projectId);

    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "analyzing",
      progress: 50,
      progressMessage: "Analysis complete, generating script...",
      analysis,
    });

    console.log(
      `[AD_CLONE_COMBINED] Analysis complete for project ${projectId}, starting script generation`
    );

    // Phase 2: Script Generation (50-100%)
    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "generating_script",
      progress: 55,
      progressMessage: "Analyzing product images...",
    });

    const script = await adCloneService.generateAdaptedScript(projectId);

    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "script_generated",
      progress: 100,
      progressMessage: "Script generation complete",
      scripts: [script],
    });

    console.log(
      `[AD_CLONE_COMBINED] Combined process complete for project ${projectId}`
    );
  } catch (error) {
    const errorMessage =
      sanitizeErrorForFrontend(error, "Operation failed. Please try again.");

    console.error(
      `[AD_CLONE_COMBINED] Error in combined process for project ${projectId}:`,
      error
    );
    Sentry.captureException(error);

    await notifyAdCloneJobUpdate(teamId, {
      projectId,
      status: "failed",
      progress: 0,
      progressMessage: "Processing failed",
      error: errorMessage,
    });

    throw error;
  }
}
