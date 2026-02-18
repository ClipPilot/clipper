import {
  getGeminiClient,
  getGeminiHelpers,
  GeminiUploadedFile,
} from "./gemini.service";
import {
  VIDEO_ANALYSIS_PROMPT,
  VIDEO_ANALYSIS_JSON_SCHEMA,
} from "../../config/adClonePrompts";
import { VideoAnalysis, VideoAnalysisSchema } from "../../types/adClone.types";

export interface AnalyzeVideoOptions {
  model?: string;
  thinkingLevel?: "LOW" | "HIGH" | "MEDIUM" | "MINIMAL";
}

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 5000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status || err?.httpCode;
      const isRetryable = RETRY_CONFIG.retryableStatuses.includes(status);

      if (!isRetryable || attempt === RETRY_CONFIG.maxAttempts) {
        throw err;
      }

      const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(
        `[VideoAnalysis] ${label} failed (status ${status}), retrying in ${delay}ms (attempt ${attempt}/${RETRY_CONFIG.maxAttempts})`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

export async function analyzeVideoWithGemini(
  uploadedFile: GeminiUploadedFile,
  options: AnalyzeVideoOptions = {}
): Promise<VideoAnalysis> {
  const client = await getGeminiClient();
  const { createUserContent, createPartFromUri, ThinkingLevel } =
    await getGeminiHelpers();

  console.log("[VideoAnalysis] Starting video analysis with Gemini...");
  console.log("[VideoAnalysis] File URI:", uploadedFile.uri);

  const contents = createUserContent([
    createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
    VIDEO_ANALYSIS_PROMPT,
  ]);

  const response = await withRetry(
    () => client.models.generateContent({
      model: options.model || "gemini-3-pro-preview",
      contents,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: VIDEO_ANALYSIS_JSON_SCHEMA,
        thinkingConfig: {
          thinkingLevel: options.thinkingLevel
            ? ThinkingLevel[options.thinkingLevel]
            : ThinkingLevel.HIGH,
        },
      },
    }),
    "generateContent",
  ) as { text?: string | null };

  const responseText = response.text;
  console.log("[VideoAnalysis] Raw response length:", responseText?.length);

  if (!responseText) {
    throw new Error("AI returned empty response for video analysis");
  }

  let parsedAnalysis: unknown;
  try {
    parsedAnalysis = JSON.parse(responseText);
  } catch (parseError) {
    console.error("[VideoAnalysis] Failed to parse JSON response:", parseError);
    throw new Error("Failed to parse video analysis response as JSON");
  }

  const validationResult = VideoAnalysisSchema.safeParse(parsedAnalysis);
  if (!validationResult.success) {
    console.error(
      "[VideoAnalysis] Schema validation failed:",
      validationResult.error.issues
    );
    throw new Error(
      `Video analysis failed schema validation: ${validationResult.error.issues.map((e) => e.message).join(", ")}`
    );
  }

  const analysis = validationResult.data;
  console.log("[VideoAnalysis] Analysis complete:");
  console.log("  - Total duration:", analysis.totalDuration, "seconds");
  console.log("  - Aspect ratio:", analysis.aspectRatio);
  console.log("  - Scene count:", analysis.scenes.length);
  console.log("  - Overall style:", analysis.overallStyle);

  return analysis;
}
