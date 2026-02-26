import * as Sentry from "@sentry/node";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { config } from "../config/env";

export interface FacecamRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FacecamDetectResult {
  facecamDetected: boolean;
  facecamRegion: FacecamRegion | null;
  corner: string | null;
  faceRegion: FacecamRegion | null;
  detectionRate: number;
  frameWidth: number;
  frameHeight: number;
}

export interface MultiFaceDetectResult {
  faces: FacecamRegion[];
  faceCount: number;
  detectionRate: number;
  frameWidth: number;
  frameHeight: number;
}

const lambdaClient = new LambdaClient({
  region: config.aws.region,
});

const FACECAM_DETECT_LAMBDA = `clipster-facecam-detect-${process.env.NODE_ENV === "production" ? "prod" : "staging"}`;

/**
 * Detect facecam region from an S3 key.
 * Returns null on any failure (never throws) so the pipeline is resilient.
 */
export async function detectFacecamFromS3Key(
  s3Key: string,
): Promise<FacecamDetectResult | null> {
  console.log(`[FACECAM-DETECT] Starting detection for S3 key: ${s3Key}`);

  try {
    const s3Url = `s3://${config.aws.s3Bucket}/${s3Key}`;

    const payload = { video_url: s3Url, mode: "facecam" };

    const command = new InvokeCommand({
      FunctionName: FACECAM_DETECT_LAMBDA,
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? JSON.parse(Buffer.from(response.Payload).toString())
        : { error: "Unknown Lambda error" };
      console.error(`[FACECAM-DETECT] Lambda error: ${errorPayload.errorMessage || errorPayload.error}`);
      return null;
    }

    const result = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null;

    if (!result) {
      console.error("[FACECAM-DETECT] Empty response from Lambda");
      return null;
    }

    const body = typeof result.body === "string" ? JSON.parse(result.body) : result.body || result;

    if (!body.success) {
      console.error(`[FACECAM-DETECT] Detection failed: ${body.error}`);
      return null;
    }

    console.log(`[FACECAM-DETECT] Result: facecamDetected=${body.facecamDetected}, corner=${body.corner}, rate=${body.detectionRate}`);

    return {
      facecamDetected: body.facecamDetected,
      facecamRegion: body.facecamRegion || null,
      corner: body.corner || null,
      faceRegion: body.faceRegion || null,
      detectionRate: body.detectionRate,
      frameWidth: body.frameWidth,
      frameHeight: body.frameHeight,
    };
  } catch (err) {
    console.error("[FACECAM-DETECT] Error:", err);
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Detect multiple face positions from an S3 key using multi-face mode.
 * Used for active-speaker mode to find all speakers in podcast/interview content.
 * Returns null on any failure (never throws) so the pipeline is resilient.
 */
export async function detectMultipleFacesFromS3Key(
  s3Key: string,
): Promise<MultiFaceDetectResult | null> {
  console.log(`[MULTI-FACE-DETECT] Starting detection for S3 key: ${s3Key}`);

  try {
    const s3Url = `s3://${config.aws.s3Bucket}/${s3Key}`;

    const payload = { video_url: s3Url, mode: "multi-face" };

    const command = new InvokeCommand({
      FunctionName: FACECAM_DETECT_LAMBDA,
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? JSON.parse(Buffer.from(response.Payload).toString())
        : { error: "Unknown Lambda error" };
      console.error(`[MULTI-FACE-DETECT] Lambda error: ${errorPayload.errorMessage || errorPayload.error}`);
      return null;
    }

    const result = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null;

    if (!result) {
      console.error("[MULTI-FACE-DETECT] Empty response from Lambda");
      return null;
    }

    const body = typeof result.body === "string" ? JSON.parse(result.body) : result.body || result;

    if (!body.success) {
      console.error(`[MULTI-FACE-DETECT] Detection failed: ${body.error}`);
      return null;
    }

    console.log(`[MULTI-FACE-DETECT] Found ${body.faceCount} faces, rate=${body.detectionRate}`);

    return {
      faces: body.faces || [],
      faceCount: body.faceCount || 0,
      detectionRate: body.detectionRate,
      frameWidth: body.frameWidth,
      frameHeight: body.frameHeight,
    };
  } catch (err) {
    console.error("[MULTI-FACE-DETECT] Error:", err);
    Sentry.captureException(err);
    return null;
  }
}
