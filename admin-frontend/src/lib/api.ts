const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export interface TeamUsage {
  clips_created: number;
  limit: number;
}

export interface TeamSubscription {
  id: number;
  status: string;
  plan: string;
  stripe_subscription_id: string;
  current_period_end: string;
}

export interface Team {
  id: number;
  name: string;
  type: string;
  plan: string;
  stripeCustomerId: string | null;
  enterpriseClipLimit: number | null;
  enterpriseMonthlyPrice: number | null;
  createdAt: string;
  subscription: TeamSubscription | null;
  usage: TeamUsage | null;
  ownerEmail: string | null;
  memberCount: number;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TeamsResponse {
  teams: Team[];
  pagination: Pagination;
}

export interface EnterpriseSetupResult {
  checkoutUrl: string;
  team: Team;
}

export interface ChangePlanResult {
  success: boolean;
  checkoutUrl: string;
  priceId: string;
  cancelledSubscription: boolean;
}

export interface AdminReferral {
  id: number;
  code: string;
  referrerTeamId: number;
  referrerTeamName: string;
  referrerEmail: string;
  referredTeamId: number;
  referredTeamName: string;
  referredEmail: string;
  referredPlan: string | null;
  status: "pending" | "active" | "churned";
  percentOff: string;
  bonusClips: number;
  rewardApplied: boolean;
  createdAt: string;
}

export interface ReferralsResponse {
  referrals: AdminReferral[];
}

export interface LoginResponse {
  message: string;
  email: string;
  requires2FA: boolean;
}

export interface Verify2FAResponse {
  token: string;
  email: string;
}

export const adminAPI = {
  // Step 1: Login with credentials - returns requires2FA: true
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  // Step 2: Verify 2FA code - returns token
  async verify2FA(email: string, code: string): Promise<Verify2FAResponse> {
    const response = await fetch(`${API_URL}/admin/verify-2fa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    return handleResponse(response);
  },

  // Resend 2FA code
  async resend2FA(email: string, password: string): Promise<{ message: string; email: string }> {
    const response = await fetch(`${API_URL}/admin/resend-2fa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  async getTeams(options?: { search?: string; limit?: number; offset?: number }): Promise<TeamsResponse> {
    const params = new URLSearchParams();
    if (options?.search) params.set("search", options.search);
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());

    const queryString = params.toString();
    const url = `${API_URL}/admin/teams${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async getTeam(teamId: string): Promise<{ team: Team }> {
    const response = await fetch(`${API_URL}/admin/teams/${teamId}`, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async setupEnterprise(
    teamId: string,
    clipLimit: number,
    monthlyPrice: number,
    customerEmail: string
  ): Promise<EnterpriseSetupResult> {
    const response = await fetch(`${API_URL}/admin/enterprise/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ teamId, clipLimit, monthlyPrice, customerEmail }),
    });
    return handleResponse(response);
  },

  async changePlan(
    teamId: string,
    newPlan: string,
    clipLimit?: number,
    monthlyPrice?: number,
    customerEmail?: string
  ): Promise<ChangePlanResult> {
    const response = await fetch(`${API_URL}/admin/teams/change-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ teamId, newPlan, clipLimit, monthlyPrice, customerEmail }),
    });
    return handleResponse(response);
  },

  async getReferrals(): Promise<ReferralsResponse> {
    const response = await fetch(`${API_URL}/admin/referrals`, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async setReferralReward(
    referralId: number,
    bonusClips: number,
    percentOff: number
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}/admin/referrals/reward`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ referralId, bonusClips, percentOff }),
    });
    return handleResponse(response);
  },
};
