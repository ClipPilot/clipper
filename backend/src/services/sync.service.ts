import { config } from "../config/env";

const SYNC_API_BASE = "https://api.sync.so/v2";

type SyncModel = "lipsync-2" | "lipsync-1.9.0-beta" | "lipsync-2-pro";
type SyncStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED";
type SyncMode = "loop" | "freeze" | "bounce";

interface SyncInput {
  type: "video" | "audio";
  url: string;
}

interface ActiveSpeakerConfig {
  auto_detect?: boolean;
  frame_number?: number;
  coordinates?: number[];
}

interface SyncOptions {
  sync_mode?: SyncMode;
  output_format?: "mp4" | "webm";
  fps?: number;
  pads?: { l?: number; r?: number; t?: number; b?: number };
  video_start?: number;
  active_speaker_detection?: ActiveSpeakerConfig;
  occlusion_detection_enabled?: boolean;
}

interface SyncGenerationResponse {
  id: string;
  createdAt: string;
  status: SyncStatus;
  model: SyncModel;
  input: SyncInput[];
  options?: SyncOptions;
  outputUrl: string | null;
  outputDuration: number | null;
  error: string | null;
  error_code: string | null;
}

interface CreateLipSyncOptions {
  model?: SyncModel;
  syncMode?: SyncMode;
  activeSpeakerDetection?: boolean;
  occlusionDetection?: boolean;
}

export class SyncService {
  private apiKey: string;

  constructor() {
    this.apiKey = config.sync?.apiKey || process.env.SYNC_KEY || "";
    if (!this.apiKey) {
      console.warn("[SYNC] No API key configured - lip sync will be skipped");
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async createLipSync(
    videoUrl: string,
    audioUrl: string,
    options: CreateLipSyncOptions = {}
  ): Promise<SyncGenerationResponse> {
    const {
      model = "lipsync-2",
      syncMode = "loop",
      activeSpeakerDetection = true,
      occlusionDetection = true,
    } = options;

    console.log(`[SYNC] Creating lip sync job`);
    console.log(`[SYNC] Video: ${videoUrl}`);
    console.log(`[SYNC] Audio: ${audioUrl}`);
    console.log(`[SYNC] Model: ${model}, Mode: ${syncMode}, ASD: ${activeSpeakerDetection}, Occlusion: ${occlusionDetection}`);

    const syncOptions: SyncOptions = {
      sync_mode: syncMode,
    };

    if (activeSpeakerDetection) {
      syncOptions.active_speaker_detection = { auto_detect: true };
    }

    if (occlusionDetection) {
      syncOptions.occlusion_detection_enabled = true;
    }

    const response = await fetch(`${SYNC_API_BASE}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        model,
        input: [
          { type: "video", url: videoUrl },
          { type: "audio", url: audioUrl },
        ],
        options: syncOptions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lip sync error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as SyncGenerationResponse;
    console.log(`[SYNC] Job created: ${data.id} (status: ${data.status})`);
    return data;
  }

  async getStatus(jobId: string): Promise<SyncGenerationResponse> {
    const response = await fetch(`${SYNC_API_BASE}/generate/${jobId}`, {
      method: "GET",
      headers: {
        "x-api-key": this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lip sync error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as SyncGenerationResponse;
  }

  async waitForCompletion(
    jobId: string,
    options: {
      pollInterval?: number;
      maxWaitTime?: number;
      onProgress?: (status: SyncStatus) => void;
    } = {}
  ): Promise<SyncGenerationResponse> {
    const {
      pollInterval = 5000,
      maxWaitTime = 10 * 60 * 1000,
      onProgress,
    } = options;

    const startTime = Date.now();
    let lastStatus: SyncStatus | null = null;

    console.log(`[SYNC] Waiting for job ${jobId} to complete...`);

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed > maxWaitTime) {
        throw new Error(`Lip sync timed out after ${maxWaitTime / 1000}s`);
      }

      const result = await this.getStatus(jobId);

      if (result.status !== lastStatus) {
        console.log(
          `[SYNC] Status: ${result.status} (${Math.round(elapsed / 1000)}s elapsed)`
        );
        lastStatus = result.status;
        onProgress?.(result.status);
      }

      if (result.status === "COMPLETED") {
        console.log(`[SYNC] Completed! Output: ${result.outputUrl}`);
        return result;
      }

      if (result.status === "FAILED" || result.status === "REJECTED") {
        throw new Error(
          `Lip sync ${result.status.toLowerCase()}: ${result.error || result.error_code || "Unknown error"}`
        );
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  async applyLipSync(
    videoUrl: string,
    audioUrl: string,
    options: CreateLipSyncOptions & {
      pollInterval?: number;
      maxWaitTime?: number;
      onProgress?: (status: SyncStatus) => void;
    } = {}
  ): Promise<string> {
    const job = await this.createLipSync(videoUrl, audioUrl, options);
    const result = await this.waitForCompletion(job.id, options);

    if (!result.outputUrl) {
      throw new Error("Lip sync completed but no output URL returned");
    }

    return result.outputUrl;
  }

  async downloadOutput(outputUrl: string): Promise<Buffer> {
    console.log(`[SYNC] Downloading output from ${outputUrl}`);
    const response = await fetch(outputUrl);

    if (!response.ok) {
      throw new Error(`Failed to download sync output: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

export const syncService = new SyncService();
