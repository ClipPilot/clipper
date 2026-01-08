import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import type {
  Character,
  CharacterConfig,
  GeneratePreviewResponse,
  GenerationStatusResponse,
  CreateCharacterResponse,
  StyleConfig,
  AppearanceConfig,
} from "@/components/ugc-studio/actors/types";

class ActorsAPI {
  async generatePreview(
    teamId: number,
    config: CharacterConfig
  ): Promise<GeneratePreviewResponse> {
    const response = await apiFetch(`${API_URL}/actors/generate-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ teamId, config }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate preview");
    }

    return response.json();
  }

  async getGenerationStatus(jobId: string): Promise<GenerationStatusResponse> {
    const response = await apiFetch(
      `${API_URL}/actors/generation-status/${jobId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get generation status");
    }

    return response.json();
  }

  async create(data: {
    teamId: number;
    name: string;
    isPublic?: boolean;
    gender?: string;
    ageRange?: string;
    appearanceConfig?: AppearanceConfig;
    styleConfig?: StyleConfig;
    selectedImageKeys: string[];
    generationPrompt?: string;
    referenceImages?: string[];
    parentCharacterId?: number;
  }): Promise<CreateCharacterResponse> {
    const response = await apiFetch(`${API_URL}/actors/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create character");
    }

    return response.json();
  }

  async list(
    teamId: number,
    options?: { limit?: number; offset?: number; sort?: "recent" | "popular" }
  ): Promise<{ success: boolean; characters: Character[]; total?: number }> {
    const params = new URLSearchParams({ teamId: String(teamId) });
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    if (options?.sort) params.set("sort", options.sort);

    const response = await apiFetch(`${API_URL}/actors?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list characters");
    }

    return response.json();
  }

  async listCommunity(options?: {
    limit?: number;
    offset?: number;
    sort?: "recent" | "popular";
  }): Promise<{ success: boolean; characters: Character[]; total?: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    if (options?.sort) params.set("sort", options.sort);

    const response = await apiFetch(
      `${API_URL}/actors/community?${params.toString()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list community characters");
    }

    return response.json();
  }

  async getById(id: number): Promise<{ success: boolean; character: Character }> {
    const response = await apiFetch(`${API_URL}/actors/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get character");
    }

    return response.json();
  }

  async update(
    id: number,
    data: { name?: string; isPublic?: boolean; primaryImageIndex?: number }
  ): Promise<{ success: boolean; character: Character }> {
    const response = await apiFetch(`${API_URL}/actors/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update character");
    }

    return response.json();
  }

  async delete(id: number): Promise<{ success: boolean }> {
    const response = await apiFetch(`${API_URL}/actors/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete character");
    }

    return response.json();
  }

  async incrementUse(id: number): Promise<{ success: boolean }> {
    const response = await apiFetch(`${API_URL}/actors/${id}/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to increment use count");
    }

    return response.json();
  }

  async createVariation(
    id: number,
    teamId: number,
    styleConfig: StyleConfig
  ): Promise<{ success: boolean; jobId: string; status: string; originalCharacterId: number; message: string }> {
    const response = await apiFetch(`${API_URL}/actors/${id}/create-variation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ teamId, styleConfig }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create variation");
    }

    return response.json();
  }

  async getPresignedUploadUrl(
    teamId: number,
    fileName: string
  ): Promise<{ success: boolean; uploadUrl: string; s3Key: string }> {
    const response = await apiFetch(`${API_URL}/actors/upload-reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ teamId, fileName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get upload URL");
    }

    return response.json();
  }
}

export const actorsAPI = new ActorsAPI();
