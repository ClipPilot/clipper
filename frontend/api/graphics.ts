import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import type {
  GenerateGraphicsResponse,
  GraphicsUploadUrlResponse,
} from "@clipper/shared-types";

export type { GenerateGraphicsResponse };

export type GeneratedGraphic = GenerateGraphicsResponse["images"][number];

export type UploadUrlResponse = GraphicsUploadUrlResponse;

class GraphicsAPI {
  async generate(data: {
    teamId: number;
    prompt: string;
    graphicType: string;
    stylePreset: string;
    aspectRatio: string;
    productImageKeys?: string[];
  }): Promise<GenerateGraphicsResponse> {
    const response = await apiFetch(`${API_URL}/graphics/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate graphics");
    }

    return response.json();
  }

  async getUploadUrl(
    teamId: number,
    fileName: string,
    contentType?: string,
  ): Promise<UploadUrlResponse> {
    const response = await apiFetch(`${API_URL}/graphics/upload-product-image`, {
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
    file: File,
  ): Promise<{ key: string; url: string }> {
    const { uploadUrl, s3Key } = await this.getUploadUrl(
      teamId,
      file.name,
      file.type,
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
}

export const graphicsAPI = new GraphicsAPI();
