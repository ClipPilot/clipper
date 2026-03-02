import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface Campaign {
  id: number;
  team_id: number;
  intake_form_id: number | null;
  name: string;
  status: "pending" | "accepted" | "rejected" | "appeal" | "started" | "paused" | "completed";
  quoted_cpm: string | null;
  budget: string | null;
  video_minimum: number | null;
  minimum_fund: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  google_drive_folder_id: string | null;
  videos_ready: boolean;
  payment_ready: boolean;
  contract_ready: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignVideo {
  id: number;
  campaign_id: number;
  clip_id: number | null;
  s3_key: string | null;
  file_name: string | null;
  title: string | null;
  status: "pending" | "uploaded" | "processing" | "ready" | "failed";
  presigned_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignPaymentMethod {
  type: "card" | "us_bank_account";
  brand?: string;
  last4: string;
  exp_month?: number;
  exp_year?: number;
  bank_name?: string;
}

/** @deprecated Use CampaignPaymentMethod */
export type CampaignCard = CampaignPaymentMethod;

export interface CampaignWallet {
  id: number;
  campaign_id: number;
  balance_cents: number;
  total_topped_up_cents: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignContract {
  id: number;
  campaign_id: number;
  team_id: number;
  status: "pending" | "signed" | "voided";
  terms: Record<string, unknown> | null;
  legal_name: string | null;
  presigned_pdf_url: string | null;
  signed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CampaignGates {
  videos: {
    complete: boolean;
    videoCount: number;
    videoMinimum: number;
  };
  payment: {
    complete: boolean;
    balanceCents: number;
    requiredCents: number;
  };
  contract: {
    complete: boolean;
    signedAt: string | null;
  };
}

class CampaignAPI {
  async listCampaigns(
    teamId: number,
    status?: string
  ): Promise<{ campaigns: Campaign[] }> {
    const url = status
      ? `${API_URL}/campaigns/teams/${teamId}/campaigns?status=${encodeURIComponent(status)}`
      : `${API_URL}/campaigns/teams/${teamId}/campaigns`;

    const response = await apiFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list campaigns");
    }

    return response.json();
  }

  async getCampaign(
    teamId: number,
    campaignId: number
  ): Promise<{ campaign: Campaign; gates: CampaignGates }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch campaign");
    }

    return response.json();
  }

  async createCampaign(
    teamId: number,
    data: {
      name: string;
      budget?: number;
      brand_description?: string;
      company_website_url?: string;
      icps?: any;
      company_socials?: any;
      competitor_socials?: any;
    }
  ): Promise<{ campaign: Campaign }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create campaign");
    }

    return response.json();
  }

  async appealCampaign(
    teamId: number,
    campaignId: number
  ): Promise<{ campaign: Campaign }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/appeal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to appeal campaign");
    }

    return response.json();
  }

  async addVideos(
    teamId: number,
    campaignId: number,
    clipIds: number[]
  ): Promise<{ videos: CampaignVideo[] }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/videos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clipIds }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add videos");
    }

    return response.json();
  }

  async uploadVideo(
    teamId: number,
    campaignId: number,
    fileName: string,
    contentType: string
  ): Promise<{ video: CampaignVideo; uploadUrl: string; s3Key: string }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/videos/upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileName, contentType }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get upload URL");
    }

    return response.json();
  }

  async completeUpload(
    teamId: number,
    campaignId: number,
    videoId: number
  ): Promise<{ video: CampaignVideo }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/videos/${videoId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to complete upload");
    }

    return response.json();
  }

  async removeVideo(
    teamId: number,
    campaignId: number,
    videoId: number
  ): Promise<{ deleted: boolean }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/videos/${videoId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to remove video");
    }

    return response.json();
  }

  async listVideos(
    teamId: number,
    campaignId: number
  ): Promise<{ videos: CampaignVideo[] }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/videos`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list videos");
    }

    return response.json();
  }

  async getWallet(
    teamId: number,
    campaignId: number
  ): Promise<{ wallet: CampaignWallet; card: CampaignCard | null }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/wallet`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get wallet");
    }

    return response.json();
  }

  async createSetupIntent(
    teamId: number,
    campaignId: number
  ): Promise<{ clientSecret: string }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/wallet/setup-intent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create setup intent");
    }

    return response.json();
  }

  async saveCard(
    teamId: number,
    campaignId: number,
    paymentMethodId: string
  ): Promise<{ saved: boolean; card: CampaignCard | null }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/wallet/save-card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentMethodId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save card");
    }

    return response.json();
  }

  async createTopUp(
    teamId: number,
    campaignId: number,
    amountCents: number
  ): Promise<{ confirmed: boolean; processing?: boolean; clientSecret: string; paymentIntentId: string }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/wallet/top-up`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amountCents }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create top-up");
    }

    return response.json();
  }

  async getTopUpStatus(
    teamId: number,
    campaignId: number,
    piId: string
  ): Promise<{ credited: boolean }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/wallet/top-up/${piId}/status`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to check top-up status");
    }

    return response.json();
  }

  async getContract(
    teamId: number,
    campaignId: number
  ): Promise<{ contract: CampaignContract | null }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/contract`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get contract");
    }

    return response.json();
  }

  async signContract(
    teamId: number,
    campaignId: number,
    legalName: string,
    signatureDataUrl: string
  ): Promise<{ contract: CampaignContract }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/contract/sign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ legalName, signatureDataUrl }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to sign contract");
    }

    return response.json();
  }

  async endCampaign(
    teamId: number,
    campaignId: number
  ): Promise<{ campaign: Campaign }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/end`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to end campaign");
    }

    return response.json();
  }

  async getCampaignClipIds(teamId: number): Promise<{
    clipIds: number[];
    campaignClipMap: Record<number, number[]>;
  }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaign-clip-ids`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch campaign clip IDs");
    }

    return response.json();
  }

  async startCampaign(
    teamId: number,
    campaignId: number
  ): Promise<{ campaign: Campaign; message: string }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/start`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to start campaign");
    }

    return response.json();
  }
}

export const campaignAPI = new CampaignAPI();
