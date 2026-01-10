import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface GenerateUGCVideoRequest {
  teamId: number;
  scriptId: string;
  voiceId: string;
}

export interface GenerateUGCVideoResponse {
  success: boolean;
  jobId: string;
  status: "queued";
  message: string;
}

export interface SceneStatus {
  sceneId: string;
  sceneNumber: number;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  audioUrl?: string;
}

export interface VideoGenerationStatus {
  jobId: string;
  scriptId?: string;
  status: "queued" | "generating" | "completed" | "failed";
  progress: number;
  progressMessage: string;
  currentScene?: number;
  totalScenes?: number;
  sceneStatuses?: SceneStatus[];
  finalVideoUrl?: string;
  finalVideoKey?: string;
  totalDurationSeconds?: number;
  sceneVideos?: Array<{
    sceneId: string;
    sceneNumber: number;
    audioKey: string;
    videoKey: string;
  }>;
  error?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RegenerateSceneRequest {
  jobId: string;
  sceneId: string;
  teamId: number;
}

export interface RegenerateSceneResponse {
  success: boolean;
  sceneJobId: string;
  message: string;
}

export interface FinalizeVideoRequest {
  jobId: string;
  teamId: number;
}

export interface FinalizeVideoResponse {
  success: boolean;
  clipId: number;
  clipPath: string;
}

export interface ScriptVideoResponse {
  jobId: string;
  videoKey: string;
  videoUrl: string;
  totalDurationSeconds: number;
  sceneVideos: Array<{
    sceneId: string;
    sceneNumber: number;
    audioKey: string;
    videoKey: string;
  }>;
  createdAt: string;
  completedAt: string;
}

export interface UGCVideoJob {
  id: string;
  scriptId: string;
  scriptTitle: string;
  status: "queued" | "generating" | "completed" | "failed";
  progress: number;
  progressMessage: string;
  thumbnailUrl?: string;
  finalVideoUrl?: string;
  totalDurationSeconds?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ListVideoJobsResponse {
  jobs: UGCVideoJob[];
  total: number;
  limit: number;
  offset: number;
}

class UGCVideoAPI {
  /**
   * List video generation jobs for a team
   */
  async listVideoJobs(
    teamId: number,
    limit = 10,
    offset = 0
  ): Promise<ListVideoJobsResponse> {
    const params = new URLSearchParams({
      teamId: String(teamId),
      limit: String(limit),
      offset: String(offset),
    });

    const response = await apiFetch(`${API_URL}/ugc-video/jobs?${params}`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list video jobs");
    }

    return response.json();
  }

  /**
   * Start video generation (costs 15 credits)
   */
  async generateVideo(data: GenerateUGCVideoRequest): Promise<GenerateUGCVideoResponse> {
    const response = await apiFetch(`${API_URL}/ugc-video/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate video");
    }

    return response.json();
  }

  /**
   * Poll for video generation status
   */
  async getVideoStatus(jobId: string): Promise<VideoGenerationStatus> {
    const response = await apiFetch(`${API_URL}/ugc-video/status/${jobId}`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get video status");
    }

    return response.json();
  }

  /**
   * Regenerate a single scene (costs 3 credits)
   */
  async regenerateScene(data: RegenerateSceneRequest): Promise<RegenerateSceneResponse> {
    const response = await apiFetch(`${API_URL}/ugc-video/regenerate-scene`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to regenerate scene");
    }

    return response.json();
  }

  /**
   * Finalize video and create clip in library
   */
  async finalizeVideo(data: FinalizeVideoRequest): Promise<FinalizeVideoResponse> {
    const response = await apiFetch(`${API_URL}/ugc-video/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to finalize video");
    }

    return response.json();
  }

  /**
   * Get the generated video for a script (if completed)
   */
  async getScriptVideo(scriptId: string): Promise<ScriptVideoResponse> {
    const response = await apiFetch(`${API_URL}/ugc-video/script/${scriptId}`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get script video");
    }

    return response.json();
  }
}

export const ugcVideoAPI = new UGCVideoAPI();
