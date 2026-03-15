import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import type {
  GenerateScriptRequest,
  GenerateScriptResponse,
  ScriptStatusResponse,
  RegenerateSceneRequest,
  RegenerateSceneResponse,
  UploadUrlResponse,
  UGCScript,
  UGCScene,
  ScriptSummary,
  AutoStructureResponse,
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

  async getScriptStatus(scriptId: string): Promise<ScriptStatusResponse> {
    const response = await apiFetch(`${API_URL}/ugc/script/${scriptId}/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get script status");
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

  async regenerateBRollPrompt(data: {
    scriptId: string;
    sceneId: string;
    bRollShotIndex: number;
    newAction: string;
  }): Promise<{ success: boolean }> {
    const response = await apiFetch(`${API_URL}/ugc/regenerate-broll-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to regenerate B-roll prompt");
    }

    return response.json();
  }

  async regenerateAllBRollShots(data: {
    scriptId: string;
    sceneId: string;
    newSceneAction: string;
    shotCount: number;
    shotDurations: number[];
  }): Promise<{ success: boolean; bRollShots: any[] }> {
    const response = await apiFetch(`${API_URL}/ugc/regenerate-all-broll-shots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to regenerate B-roll shots");
    }

    return response.json();
  }

  async generateAutoStructure(data: {
    scriptDirection: string;
    productName?: string;
    hasProductImages?: boolean;
  }): Promise<{ success: boolean } & AutoStructureResponse> {
    const response = await apiFetch(`${API_URL}/ugc/auto-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate auto structure");
    }

    return response.json();
  }

  async generateScriptAgent(data: {
    teamId: number;
    structure: Array<{ sceneType: string; slug: string; description: string; shots?: Array<{ label: string; shotType: string }> }>;
    characterId?: number;
    character?: { name: string; gender: string | null; age_range: string | null; appearance_config: any } | null;
    voice?: { name: string; style?: string } | null;
    targetAudience: string;
    productImageKeys?: string[];
    userDirection?: string;
    isSilent: boolean;
    videoType: string;
  }): Promise<{ success: boolean; scriptId: string; script: any }> {
    const response = await apiFetch(`${API_URL}/ugc/generate-script-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate script via agent");
    }

    return response.json();
  }

  async initStructure(data: {
    message: string;
    productImageKeys?: string[];
    threadId?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  }): Promise<{
    success: boolean;
    responseType: "conversation" | "structure";
    message: string;
    videoType: string;
    isSilent: boolean;
    character: boolean;
    structure: Array<{ sceneType: string; slug: string; description: string }>;
  }> {
    const response = await apiFetch(`${API_URL}/ugc/init-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate init structure");
    }

    return response.json();
  }


  async storyboardChat(data: {
    scriptId: string;
    message: string;
    threadId?: string;
  }): Promise<{ success: boolean; message: string; updatedScript: UGCScript }> {
    const response = await apiFetch(`${API_URL}/ugc/storyboard-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to process storyboard edit");
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
  ): Promise<{ success: boolean; scripts: UGCScript[]; selectedVariantIndex: number; characterId?: number }> {
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

  async listScripts(
    teamId: number,
    options?: { limit?: number; offset?: number }
  ): Promise<{ success: boolean; scripts: ScriptSummary[]; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());

    const url = `${API_URL}/ugc/scripts/${teamId}${params.toString() ? `?${params}` : ""}`;
    const response = await apiFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list scripts");
    }

    return response.json();
  }
}

export const ugcScriptAPI = new UGCScriptAPI();
