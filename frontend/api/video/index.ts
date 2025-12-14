import API_URL from "@/config/constants";

export interface ClipVideoParams {
  teamId: number;
  video: File;
  length?: number;
  hookLength?: number;
  promptType?: "business" | "viral";
  customPrompt?: string;
  numberOfVideos?: number;
  customText?: string;
  textPosition?: "top" | "middle" | "bottom";
  textColor?: string;
  captions?: boolean;
  captionColor?: string;
}

export interface ClipVideoResponse {
  videos: Array<{
    id: number;
    clipPath: string;
    clipSuggestions: any;
    finalMessage: string;
    evalScore: number;
  }>;
  parameters: {
    length: number;
    hookLength: number;
    promptType: string;
    numberOfVideos: number;
  };
  message: string;
}

class VideoAPI {
  private getHeaders(includeContentType = false): HeadersInit {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;
    const headers: HeadersInit = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (includeContentType) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  async clipVideo(params: ClipVideoParams): Promise<ClipVideoResponse> {
    const formData = new FormData();
    formData.append("video", params.video);
    formData.append("teamId", params.teamId.toString());

    if (params.length) formData.append("length", params.length.toString());
    if (params.hookLength)
      formData.append("hookLength", params.hookLength.toString());
    if (params.promptType) formData.append("promptType", params.promptType);
    if (params.customPrompt)
      formData.append("textPrompt", params.customPrompt);
    if (params.numberOfVideos)
      formData.append("numberOfVideos", params.numberOfVideos.toString());
    if (params.customText) formData.append("customText", params.customText);
    if (params.textPosition)
      formData.append("textPosition", params.textPosition);
    if (params.textColor) formData.append("textColor", params.textColor);
    if (params.captions !== undefined)
      formData.append("captions", params.captions.toString());
    if (params.captionColor)
      formData.append("captionColor", params.captionColor);

    const response = await fetch(`${API_URL}/clip-video`, {
      method: "POST",
      headers: this.getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || "Failed to clip video");
    }

    return await response.json();
  }
}

export const videoAPI = new VideoAPI();

