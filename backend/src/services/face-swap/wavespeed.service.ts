const { Client: WaveSpeed } = require("wavespeed");

const client = new WaveSpeed(process.env.WAVESPEED_KEY);

const MODEL_ID = "wavespeed-ai/wan-2.2/animate";

export type WanAnimateMode = "animate" | "replace";
export type WanResolution = "480p" | "720p";

export interface WanAnimateOptions {
  imageUrl: string;
  videoUrl: string;
  mode?: WanAnimateMode;
  prompt?: string;
  resolution?: WanResolution;
  seed?: number;
}

export interface WanAnimateResult {
  outputUrl: string;
}

export class WaveSpeedService {
  async wanAnimate(options: WanAnimateOptions): Promise<WanAnimateResult> {
    const {
      imageUrl,
      videoUrl,
      mode = "replace",
      prompt = "",
      resolution = "720p",
      seed = -1,
    } = options;

    console.log(
      `[WaveSpeed] Starting wan-2.2/animate (mode=${mode}, resolution=${resolution})`,
    );

    try {
      const response = await client.run(MODEL_ID, {
        image: imageUrl,
        video: videoUrl,
        mode,
        prompt,
        resolution,
        seed,
      });

      const outputUrl = response.outputs?.[0];
      if (!outputUrl) {
        throw new Error("No output URL in WaveSpeed response");
      }

      console.log(`[WaveSpeed] Complete: ${outputUrl}`);
      return { outputUrl };
    } catch (error) {
      console.error("[WaveSpeed] wan-2.2/animate failed:", error);
      throw error;
    }
  }

  async wanAnimateWithRetry(
    options: WanAnimateOptions,
    maxRetries: number = 3,
  ): Promise<WanAnimateResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.wanAnimate(options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[WaveSpeed] Attempt ${attempt}/${maxRetries} failed:`,
          lastError.message,
        );

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[WaveSpeed] Retrying in ${delay / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("WaveSpeed animate failed after retries");
  }
}

export const waveSpeedService = new WaveSpeedService();
