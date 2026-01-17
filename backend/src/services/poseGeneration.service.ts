import { fal } from "@fal-ai/client";
import { config } from "../config/env";

fal.config({
  credentials: config.fal.apiKey,
});

export interface GeneratePoseOptions {
  faceImageUrl: string;
  videoFrameUrl: string;
}

export interface GeneratePoseResult {
  imageUrl: string;
}

interface FalImageResponse {
  images: Array<{
    url: string;
    file_name?: string;
    content_type?: string;
  }>;
}

const POSE_PROMPT = `Place the person from the first image into the exact same pose as the second image. Match the pose, body position, and background from the second image exactly. Keep the person's face, identity, and clothes from the first image. High quality, no text or captions.`;

/**
 * Generate a posed image using FAL AI's nano-banana-pro/edit model
 * Takes a character image and a video frame, outputs the character in the video frame's pose
 *
 * Image order:
 * - First image (faceImageUrl): The character/person to pose (keeps their face, clothes, identity)
 * - Second image (videoFrameUrl): The pose reference (extracts pose, body position, background context)
 */
export async function generatePose(options: GeneratePoseOptions): Promise<GeneratePoseResult> {
  const { faceImageUrl, videoFrameUrl } = options;

  console.log(`[POSE_GEN] Generating pose with nano-banana-pro - character first, pose reference second`);

  const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
    input: {
      prompt: POSE_PROMPT,
      image_urls: [faceImageUrl, videoFrameUrl],
      num_images: 1,
      aspect_ratio: "auto",
      resolution: "1K",
      output_format: "png",
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS" && update.logs) {
        update.logs.map((log: { message: string }) => log.message).forEach((msg: string) => {
          console.log(`[POSE_GEN] ${msg}`);
        });
      }
    },
  }) as { data: FalImageResponse };

  if (!result.data?.images?.[0]?.url) {
    throw new Error("FAL AI did not return an image for pose generation");
  }

  console.log(`[POSE_GEN] Successfully generated pose image`);

  return {
    imageUrl: result.data.images[0].url,
  };
}

export const poseGenerationService = {
  generatePose,
};
