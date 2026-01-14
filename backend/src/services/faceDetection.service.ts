import * as Sentry from "@sentry/node";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { s3Service } from "./s3.service";
import { config } from "../config/env";
import { getVideoDuration } from "./videoEditor.service";
import path from "path";

export interface FaceSegment {
  start: number;
  end: number;
}

const lambdaClient = new LambdaClient({
  region: config.aws.region,
});

const FACE_DETECT_LAMBDA = `clipster-face-detect-${process.env.NODE_ENV === "production" ? "prod" : "staging"}`;

/**
 * Detect face segments from an S3 key (video already uploaded to S3)
 */
export async function detectFaceSegmentsFromS3Key(
  s3Key: string,
  videoDuration: number
): Promise<FaceSegment[]> {
  console.log(`[FACE-DETECT] Starting Lambda-based detection for S3 key: ${s3Key}`);

  try {
    const s3Url = `s3://${config.aws.s3Bucket}/${s3Key}`;
    console.log(`[FACE-DETECT] Invoking Lambda with S3 URL: ${s3Url}`);

    const payload = {
      video_url: s3Url,
      video_duration: videoDuration,
    };

    const command = new InvokeCommand({
      FunctionName: FACE_DETECT_LAMBDA,
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? JSON.parse(Buffer.from(response.Payload).toString())
        : { error: "Unknown Lambda error" };
      throw new Error(`Lambda error: ${errorPayload.errorMessage || errorPayload.error}`);
    }

    const result = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null;

    if (!result) {
      throw new Error("Empty response from Lambda");
    }

    const body = typeof result.body === "string" ? JSON.parse(result.body) : result.body || result;

    if (!body.success) {
      throw new Error(body.error || "Face detection failed");
    }

    console.log(`[FACE-DETECT] Lambda returned ${body.segments?.length || 0} segments`);

    // Cleanup temp S3 file
    try {
      await s3Service.deleteObject(s3Key);
      console.log(`[FACE-DETECT] Cleaned up temp S3 file: ${s3Key}`);
    } catch (cleanupErr) {
      console.warn(`[FACE-DETECT] Failed to cleanup temp file: ${cleanupErr}`);
      Sentry.captureException(cleanupErr);
    }

    return body.segments || [];
  } catch (err) {
    console.error(`[FACE-DETECT] Error:`, err);
    throw err;
  }
}

/**
 * Legacy: Detect face segments from a local file path (uploads to S3 first)
 */
export async function detectFaceSegmentsWithPadding(
  videoPath: string,
  videoDuration: number
): Promise<FaceSegment[]> {
  console.log(`[FACE-DETECT] Starting Lambda-based detection for ${videoPath}`);

  try {
    const s3Key = `temp-face-detect/${Date.now()}_${path.basename(videoPath)}`;
    console.log(`[FACE-DETECT] Uploading video to S3: ${s3Key}`);

    await s3Service.uploadFile(videoPath, s3Key, "video/mp4");

    // Use the S3 key-based detection (includes cleanup)
    return await detectFaceSegmentsFromS3Key(s3Key, videoDuration);
  } catch (err) {
    console.error(`[FACE-DETECT] Error:`, err);
    throw err;
  }
}

export async function detectFaceSegments(
  videoPath: string,
  sampleRate: number = 5,
  mergeGap: number = 0.5
): Promise<FaceSegment[]> {
  const duration = await getVideoDuration(videoPath);
  return detectFaceSegmentsWithPadding(videoPath, duration);
}
