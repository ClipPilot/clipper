import API_URL from "@/config/constants";
import { apiFetch, apiJson } from "@/lib/apiClient";

export interface AffiliateCode {
  id: number;
  code: string;
  commission_percent: string;
  is_active: boolean;
  created_at: string;
}

export interface AffiliatedTeam {
  id: number;
  referredTeamId: number;
  referredPlan: string | null;
  status: "pending" | "active" | "churned";
  commissionEarned: string;
  createdAt: string;
  teamName: string;
  teamPlan: string;
}

export interface AffiliateStats {
  totalAffiliates: number;
  activeAffiliates: number;
  pendingAffiliates: number;
  totalCommission: number;
  unpaidCommission: number;
}

export const affiliateAPI = {
  async getMe(): Promise<{ isAffiliate: boolean }> {
    return apiJson(`${API_URL}/affiliates/me`);
  },

  async becomeAffiliate(): Promise<{ success: boolean; message: string }> {
    return apiJson(`${API_URL}/affiliates/become`, { method: "POST" });
  },

  async generateCode(): Promise<{ code: AffiliateCode }> {
    return apiJson(`${API_URL}/affiliates/code`, { method: "POST" });
  },

  async getCode(): Promise<{ code: AffiliateCode | null }> {
    return apiJson(`${API_URL}/affiliates/code`);
  },

  async getTeams(): Promise<{ code: AffiliateCode | null; affiliates: AffiliatedTeam[] }> {
    return apiJson(`${API_URL}/affiliates/teams`);
  },

  async getStats(): Promise<AffiliateStats> {
    return apiJson(`${API_URL}/affiliates/stats`);
  },
};
