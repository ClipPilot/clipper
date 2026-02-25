import * as Sentry from "@sentry/node";
import { ENV } from "../../config/env";
import fs from "fs";
import { execSync } from "child_process";

export interface GeminiUploadedFile {
  name: string;
  uri: string;
  mimeType: string;
  state: "PROCESSING" | "ACTIVE" | "FAILED";
  sizeBytes?: string;
  error?: { message: string };
  statusText?: string;
}

export interface GeminiVideoUploadResult {
  file: GeminiUploadedFile;
  reEncodedPath: string | null;
}

export interface GeminiGenerateOptions {
  model?: string;
  responseMimeType?: string;
  responseJsonSchema?: any;
  thinkingLevel?: "LOW" | "HIGH" | "MEDIUM" | "MINIMAL";
  config?: Record<string, any>;
}

let googleClient: any = null;
let createUserContent: any = null;
let createPartFromUri: any = null;
let ThinkingLevel: any = null;

export const getGeminiClient = async () => {
  if (!googleClient) {
    const genai = await import("@google/genai");
    googleClient = new genai.GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
    createUserContent = genai.createUserContent;
    createPartFromUri = genai.createPartFromUri;
    ThinkingLevel = genai.ThinkingLevel;
  }
  return googleClient;
};

export const getGeminiHelpers = async () => {
  await getGeminiClient();
  return { createUserContent, createPartFromUri, ThinkingLevel };
};

export async function reencodeForGemini(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.mp4$/, "_gemini.mp4");

  console.log("Re-encoding video to H.264 for Gemini compatibility...");
  execSync(
    `ffmpeg -y -i "${inputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -movflags +faststart "${outputPath}"`,
    { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 }
  );

  const stats = fs.statSync(outputPath);
  console.log(
    "Re-encoded video size:",
    (stats.size / 1024 / 1024).toFixed(2),
    "MB"
  );

  return outputPath;
}

export async function uploadVideoToGemini(
  videoPath: string,
  options: { reencode?: boolean } = { reencode: false }
): Promise<GeminiVideoUploadResult> {
  const client = await getGeminiClient();

  console.log("Uploading video to Gemini for analysis...");
  const fileStats = fs.statSync(videoPath);
  console.log(
    "Original video file size:",
    (fileStats.size / 1024 / 1024).toFixed(2),
    "MB"
  );

  let uploadPath = videoPath;
  let reEncodedPath: string | null = null;

  if (options.reencode) {
    reEncodedPath = await reencodeForGemini(videoPath);
    uploadPath = reEncodedPath;
  }

  let uploadedFile = await client.files.upload({
    file: uploadPath,
    config: { mimeType: "video/mp4" },
  });

  console.log(
    "Video uploaded to Gemini:",
    uploadedFile.name,
    "State:",
    uploadedFile.state,
    "Size bytes:",
    uploadedFile.sizeBytes
  );

  while (uploadedFile.state === "PROCESSING") {
    console.log("Waiting for Gemini to process video...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    uploadedFile = await client.files.get({
      name: uploadedFile.name,
    });
    console.log("File state:", uploadedFile.state);
  }

  if (uploadedFile.state === "FAILED") {
    console.error(
      "Gemini file processing failed:",
      JSON.stringify(uploadedFile, null, 2)
    );
    if (reEncodedPath && fs.existsSync(reEncodedPath)) {
      fs.unlinkSync(reEncodedPath);
    }
    try {
      await client.files.delete({ name: uploadedFile.name });
      console.log("Deleted failed file from Gemini:", uploadedFile.name);
    } catch (e) {
      console.error("Failed to delete Gemini file:", e);
      Sentry.captureException(e);
    }
    throw new Error(
      `Gemini failed to process the video file: ${uploadedFile.error?.message || uploadedFile.statusText || "Unknown error"}`
    );
  }

  console.log("Video ready for analysis");

  return {
    file: uploadedFile,
    reEncodedPath,
  };
}

export async function deleteGeminiFile(fileName: string): Promise<void> {
  try {
    const client = await getGeminiClient();
    await client.files.delete({ name: fileName });
    console.log("Deleted file from Gemini:", fileName);
  } catch (e) {
    console.error("Failed to delete Gemini file:", e);
    Sentry.captureException(e);
  }
}

export async function cleanupGeminiResources(
  reEncodedPath: string | null,
  uploadedFileName: string | null
): Promise<void> {
  if (reEncodedPath && fs.existsSync(reEncodedPath)) {
    fs.unlinkSync(reEncodedPath);
    console.log("Deleted re-encoded temp file:", reEncodedPath);
  }
  if (uploadedFileName) {
    await deleteGeminiFile(uploadedFileName);
  }
}

export async function generateContentWithVideo(
  videoPath: string,
  prompt: string,
  options: GeminiGenerateOptions = {}
): Promise<any> {
  const client = await getGeminiClient();
  const { createUserContent, createPartFromUri, ThinkingLevel } =
    await getGeminiHelpers();

  const { file, reEncodedPath } = await uploadVideoToGemini(videoPath);

  try {
    const contents = createUserContent([
      createPartFromUri(file.uri, file.mimeType),
      prompt,
    ]);

    const response = await client.models.generateContent({
      model: options.model || "gemini-3-pro-preview",
      contents,
      config: {
        ...(options.responseMimeType && {
          responseMimeType: options.responseMimeType,
        }),
        ...(options.responseJsonSchema && {
          responseJsonSchema: options.responseJsonSchema,
        }),
        thinkingConfig: {
          thinkingLevel: options.thinkingLevel
            ? ThinkingLevel[options.thinkingLevel]
            : ThinkingLevel.HIGH,
        },
        ...options.config,
      },
    });

    return response;
  } finally {
    await cleanupGeminiResources(reEncodedPath, file.name);
  }
}

export async function generateContent(
  prompt: string,
  options: GeminiGenerateOptions = {}
): Promise<any> {
  const client = await getGeminiClient();
  const { ThinkingLevel } = await getGeminiHelpers();

  const response = await client.models.generateContent({
    model: options.model || "gemini-3-pro-preview",
    contents: prompt,
    config: {
      ...(options.responseMimeType && {
        responseMimeType: options.responseMimeType,
      }),
      ...(options.responseJsonSchema && {
        responseJsonSchema: options.responseJsonSchema,
      }),
      thinkingConfig: {
        thinkingLevel: options.thinkingLevel
          ? ThinkingLevel[options.thinkingLevel]
          : ThinkingLevel.HIGH,
      },
      ...options.config,
    },
  });

  return response;
}

export async function createGeminiContent(
  prompt: string,
  uploadedFile?: GeminiUploadedFile
): Promise<any> {
  const { createUserContent, createPartFromUri } = await getGeminiHelpers();

  if (uploadedFile) {
    return createUserContent([
      createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
      prompt,
    ]);
  }

  return prompt;
}

/**
 * Generate an image using Gemini's native image generation (Nano Banana Pro).
 * Used as a fallback when FAL is unavailable or times out.
 *
 * Accepts a text prompt and optional reference image URLs.
 * Returns the generated image as a Buffer.
 */
export async function generateImageWithGeminiDirect(options: {
  prompt: string;
  imageUrls?: string[];
}): Promise<Buffer> {
  const client = await getGeminiClient();

  const parts: any[] = [{ text: options.prompt }];

  if (options.imageUrls && options.imageUrls.length > 0) {
    for (const url of options.imageUrls) {
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString("base64");
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64,
        },
      });
    }
  }

  console.log(
    `[GEMINI_IMAGE] Generating image with gemini-3-pro-image-preview (${options.imageUrls?.length || 0} reference images)`
  );

  const response = await client.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: parts,
    config: {
      responseModalities: ["IMAGE"],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      console.log("[GEMINI_IMAGE] Image generated successfully");
      return Buffer.from(part.inlineData.data, "base64");
    }
  }

  throw new Error("Gemini did not return an image");
}
