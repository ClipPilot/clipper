import * as Sentry from "@sentry/node";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { config } from "../config/env";

export interface SscdSimilarityResult {
  cosine_similarity: number;
  below_threshold: boolean;
  threshold: number;
  original_frames: number;
  modified_frames: number;
}

const lambdaClient = new LambdaClient({
  region: config.aws.region,
});

const SSCD_SIMILARITY_LAMBDA = `clipster-sscd-similarity-${process.env.NODE_ENV === "production" ? "prod" : "staging"}`;

/**
 * Check SSCD cosine similarity between original and modified videos.
 * Returns null on error (never throws) — this is an async verification step,
 * not on the critical path.
 */
export async function checkSscdSimilarity(
  originalS3Url: string,
  modifiedS3Url: string,
  maxSeconds: number = 10,
  fps: number = 1
): Promise<SscdSimilarityResult | null> {
  console.log(`[SSCD] Checking similarity between original and modified video`);
  console.log(`[SSCD] Original: ${originalS3Url}`);
  console.log(`[SSCD] Modified: ${modifiedS3Url}`);

  try {
    const payload = {
      original_url: originalS3Url,
      modified_url: modifiedS3Url,
      max_seconds: maxSeconds,
      fps,
      threshold: 0.75,
    };

    const command = new InvokeCommand({
      FunctionName: SSCD_SIMILARITY_LAMBDA,
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? JSON.parse(Buffer.from(response.Payload).toString())
        : { error: "Unknown Lambda error" };
      console.error(`[SSCD] Lambda error: ${errorPayload.errorMessage || errorPayload.error}`);
      Sentry.captureException(new Error(`SSCD Lambda error: ${errorPayload.errorMessage || errorPayload.error}`));
      return null;
    }

    const result = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null;

    if (!result) {
      console.error("[SSCD] Empty response from Lambda");
      return null;
    }

    const body = typeof result.body === "string" ? JSON.parse(result.body) : result.body || result;

    if (!body.success) {
      console.error(`[SSCD] Check failed: ${body.error}`);
      Sentry.captureException(new Error(`SSCD check failed: ${body.error}`));
      return null;
    }

    console.log(`[SSCD] Similarity: ${body.cosine_similarity?.toFixed(4)} (threshold: ${body.threshold}, below: ${body.below_threshold})`);

    return {
      cosine_similarity: body.cosine_similarity,
      below_threshold: body.below_threshold,
      threshold: body.threshold,
      original_frames: body.original_frames,
      modified_frames: body.modified_frames,
    };
  } catch (err) {
    console.error(`[SSCD] Error:`, err);
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Generate an adversarially perturbed video that looks identical to humans
 * but has completely different SSCD embeddings. Returns the S3 key of the
 * perturbed video, or null on error.
 */
export async function generateAdversarialVideo(
  videoS3Url: string,
  outputKey: string,
  epsilon: number = 0.03,
  steps: number = 10
): Promise<string | null> {
  console.log(`[SSCD] Generating adversarial perturbation for ${videoS3Url}`);

  try {
    const payload = {
      mode: "perturb",
      video_url: videoS3Url,
      output_key: outputKey,
      epsilon,
      steps,
      max_seconds: 10,
      fps: 2,
    };

    const command = new InvokeCommand({
      FunctionName: SSCD_SIMILARITY_LAMBDA,
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? JSON.parse(Buffer.from(response.Payload).toString())
        : { error: "Unknown Lambda error" };
      console.error(`[SSCD] Perturb Lambda error: ${errorPayload.errorMessage || errorPayload.error}`);
      Sentry.captureException(new Error(`SSCD perturb error: ${errorPayload.errorMessage || errorPayload.error}`));
      return null;
    }

    const result = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null;

    if (!result) {
      console.error("[SSCD] Empty response from Lambda");
      return null;
    }

    const body = typeof result.body === "string" ? JSON.parse(result.body) : result.body || result;

    if (!body.success) {
      console.error(`[SSCD] Perturbation failed: ${body.error}`);
      Sentry.captureException(new Error(`SSCD perturbation failed: ${body.error}`));
      return null;
    }

    console.log(`[SSCD] Perturbation complete: ${body.frames_perturbed} frames, epsilon=${body.epsilon}`);
    return body.output_key;
  } catch (err) {
    console.error(`[SSCD] Perturb error:`, err);
    Sentry.captureException(err);
    return null;
  }
}
