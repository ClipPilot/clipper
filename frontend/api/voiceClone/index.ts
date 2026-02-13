import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface ClonedVoice {
  id: number;
  name: string;
  voiceId: string;
  previewUrl: string;
  gender: "male" | "female" | "other";
  createdAt?: string;
}

export interface CloneVoiceResponse {
  success: boolean;
  voice: ClonedVoice;
}

export interface ListClonedVoicesResponse {
  success: boolean;
  voices: ClonedVoice[];
}

class VoiceCloneAPI {
  async cloneVoice(
    teamId: number,
    name: string,
    gender: string,
    audioBlob: Blob,
  ): Promise<CloneVoiceResponse> {
    const formData = new FormData();
    formData.append("teamId", teamId.toString());
    formData.append("name", name);
    formData.append("gender", gender);
    formData.append("audio", audioBlob, "recording.webm");

    const response = await apiFetch(`${API_URL}/voice-clones`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to clone voice");
    }

    return response.json();
  }

  async listClonedVoices(teamId: number): Promise<ListClonedVoicesResponse> {
    const response = await apiFetch(
      `${API_URL}/voice-clones?teamId=${teamId}`,
      {
        method: "GET",
        credentials: "include",
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list cloned voices");
    }

    return response.json();
  }

  async deleteClonedVoice(id: number): Promise<{ success: boolean }> {
    const response = await apiFetch(`${API_URL}/voice-clones/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete cloned voice");
    }

    return response.json();
  }
}

export const voiceCloneAPI = new VoiceCloneAPI();
