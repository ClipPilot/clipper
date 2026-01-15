import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface GenerateSceneImagesRequest {
  teamId: number;
  scriptId: string;
  sceneId: string;
  sceneNumber: number;
  characterId: number;
  userRefinement?: string;
  supportingImageKeys?: string[];
}

export interface GenerateSceneImagesResponse {
  success: boolean;
  jobId: string;
  status: string;
  message: string;
}

export interface GenerateAllSceneImagesRequest {
  teamId: number;
  scriptId: string;
  characterId: number;
  scenes: Array<{
    sceneId: string;
    sceneNumber: number;
    userRefinement?: string;
    supportingImageKeys?: string[];
  }>;
}

export interface GenerateAllSceneImagesResponse {
  success: boolean;
  jobIds: string[];
  message: string;
}

export interface GenerationStatusResponse {
  success: boolean;
  jobId: string;
  sceneId: string;
  sceneNumber: number;
  status: "queued" | "generating" | "completed" | "failed";
  progress: number;
  progressMessage: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  images?: { key: string; url: string; index: number }[];
  error?: string;
}

export interface SelectSceneImageRequest {
  scriptId: string;
  sceneId: string;
  sceneNumber: number;
  imageKey: string;
  endImageKey?: string;
  generationJobId?: string;
}

export interface SceneImage {
  id: number;
  script_id: string;
  scene_id: string;
  scene_number: number;
  image_key: string;
  end_image_key?: string;
  generation_job_id?: string;
  imageUrl: string;
  endImageUrl?: string;
  created_at: string;
  updated_at: string;
}

export interface GetSceneImagesResponse {
  success: boolean;
  sceneImages: Record<string, SceneImage>;
}

export interface UploadUrlResponse {
  success: boolean;
  uploadUrl: string;
  s3Key: string;
}

class SceneBuilderAPI {
  /**
   * Generate images for a single scene
   */
  async generateSceneImages(
    data: GenerateSceneImagesRequest
  ): Promise<GenerateSceneImagesResponse> {
    const response = await apiFetch(
      `${API_URL}/scene-builder/generate-scene-images`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to start scene image generation");
    }

    return response.json();
  }

  /**
   * Generate images for all scenes at once
   */
  async generateAllSceneImages(
    data: GenerateAllSceneImagesRequest
  ): Promise<GenerateAllSceneImagesResponse> {
    const response = await apiFetch(
      `${API_URL}/scene-builder/generate-all-scene-images`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || "Failed to start batch scene image generation"
      );
    }

    return response.json();
  }

  /**
   * Poll generation status for a job
   */
  async getGenerationStatus(jobId: string): Promise<GenerationStatusResponse> {
    const response = await apiFetch(
      `${API_URL}/scene-builder/scene-generation-status/${jobId}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get generation status");
    }

    return response.json();
  }

  /**
   * Get all saved scene images for a script
   */
  async getSceneImages(scriptId: string): Promise<GetSceneImagesResponse> {
    const response = await apiFetch(
      `${API_URL}/scene-builder/script/${scriptId}/scene-images`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get scene images");
    }

    return response.json();
  }

  /**
   * Select/save an image for a scene
   */
  async selectSceneImage(
    data: SelectSceneImageRequest
  ): Promise<{ success: boolean; sceneImage: SceneImage }> {
    const response = await apiFetch(
      `${API_URL}/scene-builder/select-scene-image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to select scene image");
    }

    return response.json();
  }

  /**
   * Get presigned URL for uploading supporting images
   */
  async getUploadUrl(
    teamId: number,
    fileName: string
  ): Promise<UploadUrlResponse> {
    const response = await apiFetch(
      `${API_URL}/scene-builder/upload-supporting-image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teamId, fileName }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get upload URL");
    }

    return response.json();
  }

  /**
   * Upload a supporting image
   */
  async uploadSupportingImage(
    teamId: number,
    file: File
  ): Promise<{ key: string; url: string }> {
    const { uploadUrl, s3Key } = await this.getUploadUrl(teamId, file.name);

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload supporting image");
    }

    return {
      key: s3Key,
      url: URL.createObjectURL(file),
    };
  }
}

export const sceneBuilderAPI = new SceneBuilderAPI();
