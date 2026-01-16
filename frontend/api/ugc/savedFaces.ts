import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface SavedFace {
  id: number;
  name: string;
  imageKey: string;
  imageUrl: string;
  createdAt: string;
}

class SavedFacesAPI {
  private baseUrl = `${API_URL}/c`;

  async list(teamId: number): Promise<SavedFace[]> {
    const response = await apiFetch(`${this.baseUrl}/saved-faces/${teamId}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Failed to fetch saved faces");
    }

    const data = await response.json();
    return data.faces || [];
  }

  async save(teamId: number, name: string, file: File): Promise<SavedFace> {
    const formData = new FormData();
    formData.append("teamId", teamId.toString());
    formData.append("name", name);
    formData.append("image", file);

    const response = await apiFetch(`${this.baseUrl}/saved-faces`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Failed to save face");
    }

    const data = await response.json();
    return data.face;
  }

  async delete(id: number): Promise<void> {
    const response = await apiFetch(`${this.baseUrl}/saved-faces/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Failed to delete face");
    }
  }
}

export const savedFacesAPI = new SavedFacesAPI();
