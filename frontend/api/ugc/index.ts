import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import type {
  GenerateScriptRequest,
  GenerateScriptResponse,
  RegenerateSceneRequest,
  RegenerateSceneResponse,
  UploadUrlResponse,
  UGCScript,
  UGCScene,
} from "@/components/ugc-studio/script/types";

class UGCScriptAPI {
  async generateScript(data: GenerateScriptRequest): Promise<GenerateScriptResponse> {
    const response = await apiFetch(`${API_URL}/ugc/generate-script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate script");
    }

    return response.json();
  }

  async regenerateScene(data: RegenerateSceneRequest): Promise<RegenerateSceneResponse> {
    const response = await apiFetch(`${API_URL}/ugc/regenerate-scene`, {
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

  async getUploadUrl(
    teamId: number,
    fileName: string,
    contentType?: string
  ): Promise<UploadUrlResponse> {
    const response = await apiFetch(`${API_URL}/ugc/upload-product-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ teamId, fileName, contentType }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get upload URL");
    }

    return response.json();
  }

  async uploadImage(
    teamId: number,
    file: File
  ): Promise<{ key: string; url: string }> {
    const { uploadUrl, s3Key } = await this.getUploadUrl(
      teamId,
      file.name,
      file.type
    );

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload image to S3");
    }

    return {
      key: s3Key,
      url: URL.createObjectURL(file),
    };
  }

  async updateScript(
    scriptId: string,
    data: { scenes?: UGCScene[]; selectedVariantIndex?: number }
  ): Promise<{ success: boolean; scripts: UGCScript[]; selectedVariantIndex: number }> {
    const response = await apiFetch(`${API_URL}/ugc/script/${scriptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update script");
    }

    return response.json();
  }

  async getFullScript(
    scriptId: string
  ): Promise<{ success: boolean; scripts: UGCScript[]; selectedVariantIndex: number }> {
    const response = await apiFetch(`${API_URL}/ugc/script/${scriptId}/full`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get script");
    }

    return response.json();
  }
}

export const ugcScriptAPI = new UGCScriptAPI();
