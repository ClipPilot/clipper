import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import type {
  Campaign as SharedCampaign,
  CampaignVideo as SharedCampaignVideo,
  CampaignGates as SharedCampaignGates,
  CampaignPaymentMethod as SharedCampaignPaymentMethod,
  CampaignWallet as SharedCampaignWallet,
  MasterAgreement as SharedMasterAgreement,
  CpmDailyCharge as SharedCpmDailyCharge,
  CpmBillingBreakdown as SharedCpmBillingBreakdown,
} from "@clipper/shared-types";

export type Campaign = SharedCampaign;

export type CampaignVideo = SharedCampaignVideo;

export type CampaignGates = SharedCampaignGates;

export type CampaignPaymentMethod = SharedCampaignPaymentMethod;

/** @deprecated Use CampaignPaymentMethod */
export type CampaignCard = CampaignPaymentMethod;

export type CampaignWallet = SharedCampaignWallet;

export type MasterAgreement = SharedMasterAgreement;

export type CpmDailyCharge = SharedCpmDailyCharge;

export type CpmBillingBreakdown = SharedCpmBillingBreakdown;

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
  ): Promise<{ success: boolean }> {
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
    campaignId: number,
    options?: { sortBy?: string; sortOrder?: string; page?: number; pageSize?: number; filter?: "published" | "unpublished" | "queued" },
  ): Promise<{ videos: CampaignVideo[]; pagination: { page: number; pageSize: number; totalVideos: number; totalPages: number } }> {
    const params = new URLSearchParams();
    if (options?.sortBy) params.set("sortBy", options.sortBy);
    if (options?.sortOrder) params.set("sortOrder", options.sortOrder);
    if (options?.page) params.set("page", options.page.toString());
    if (options?.pageSize) params.set("pageSize", options.pageSize.toString());
    if (options?.filter) params.set("filter", options.filter);
    const qs = params.toString();
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/videos${qs ? `?${qs}` : ""}`,
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
  ): Promise<{ wallet: CampaignWallet; card: CampaignPaymentMethod | null }> {
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
  ): Promise<{ saved: boolean; card: CampaignPaymentMethod | null }> {
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

  async fundWithCredits(
    teamId: number,
    campaignId: number,
    creditCount: number
  ): Promise<{ confirmed: boolean; balanceCents: number; creditsUsed: number; amountCents: number }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/wallet/fund-with-credits`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ creditCount }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fund with credits");
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

  async getMasterAgreement(
    teamId: number,
  ): Promise<{ agreement: MasterAgreement }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/master-agreement`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get agreement");
    }

    return response.json();
  }

  async signMasterAgreement(
    teamId: number,
    data: {
      legalEntityName: string;
      signerName: string;
      signerTitle: string;
      signerEmail: string;
      signatureDataUrl: string;
    }
  ): Promise<{ agreement: MasterAgreement }> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/master-agreement/sign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to sign agreement");
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

  async getBillingBreakdown(
    teamId: number,
    campaignId: number
  ): Promise<CpmBillingBreakdown> {
    const response = await apiFetch(
      `${API_URL}/campaigns/teams/${teamId}/campaigns/${campaignId}/billing`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch billing breakdown");
    }

    return response.json();
  }

  async startCampaign(
    teamId: number,
    campaignId: number
  ): Promise<{ campaign: Campaign; message?: string }> {
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
