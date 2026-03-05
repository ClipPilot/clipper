const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      const hadToken = !!localStorage.getItem("admin_token");
      if (hadToken) {
        localStorage.removeItem("admin_token");
        window.location.href = "/login";
        throw new Error("Session expired");
      }
    }
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
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
  hasPreviousSubscription: boolean;
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

export interface AdminAffiliate {
  id: number;
  affiliateCodeId: number;
  affiliateCode: string;
  affiliateEmail: string;
  affiliateName: string;
  referredTeamId: number;
  referredPlan: string | null;
  status: "pending" | "active" | "churned";
  commissionEarned: string;
  commissionPercent: string;
  payoutSent: boolean;
  createdAt: string;
  teamName: string;
  teamPlan: string;
}

export interface AffiliatesResponse {
  affiliates: AdminAffiliate[];
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: "info" | "warning" | "critical";
  status: "draft" | "published" | "archived";
  icon?: string;
  action_label?: string;
  action_url?: string;
  created_by_admin_email: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementsResponse {
  announcements: Announcement[];
  total: number;
}

export interface CreateAnnouncementData {
  title: string;
  content: string;
  priority?: "info" | "warning" | "critical";
  icon?: string;
  action_label?: string;
  action_url?: string;
}

// Incidents
export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export interface IncidentUpdate {
  status: string;
  message: string;
  timestamp: string;
}

export interface Incident {
  id: number;
  title: string;
  status: IncidentStatus;
  affected_services: string[];
  updates: IncidentUpdate[];
  created_by_admin_email: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentsResponse {
  incidents: Incident[];
  total: number;
}

export interface CreateIncidentData {
  title: string;
  status?: IncidentStatus;
  affected_services: string[];
  message: string;
}

export interface AddIncidentUpdateData {
  status: IncidentStatus;
  message: string;
}

// Mass Posting Applications
export interface IntakeForm {
  id: number;
  team_id: number;
  brand_description: string | null;
  company_website_url: string | null;
  icps: any;
  company_socials: any;
  competitor_socials: any;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

// Campaign Management
export interface Campaign {
  id: number;
  team_id: number;
  name: string;
  status:
    | "pending"
    | "accepted"
    | "rejected"
    | "appeal"
    | "started"
    | "paused"
    | "completed";
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
  team_name: string;
  team_plan: string;
}

export interface CampaignDetail extends Campaign {
  intake_form_id: number | null;
  intakeForm: IntakeForm | null;
}

export interface CampaignVideo {
  id: number;
  campaign_id: number;
  clip_id: number | null;
  file_name: string | null;
  title: string | null;
  duration_seconds: number | null;
  presigned_url: string | null;
  status: string;
  created_at: string;
  post_count: number;
}

export interface CampaignsResponse {
  campaigns: Campaign[];
  total: number;
  pagination: Pagination;
}

export interface CampaignPost {
  id: number;
  clip_id: number | null;
  clip_title: string | null;
  clip_url: string | null;
  platform: string;
  status: "processing" | "scheduled" | "posted" | "failed";
  content: string;
  post_url: string | null;
  posted_time: string | null;
  created_at: string;
  accountHandle?: string | null;
}

export interface CampaignPostsResponse {
  posts: CampaignPost[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    totalPosts: number;
  };
}

export interface ContractClauses {
  parties?: string;
  providerObligations?: string;
  clientObligations?: string;
  paymentTerms?: string;
  additionalClauses?: string[];
}

export interface CampaignContract {
  id: number;
  campaign_id: number;
  team_id: number;
  terms: {
    cpmRate: string | null;
    budget: string | null;
    videoMinimum: number | null;
    teamName: string;
    campaignName: string;
    date: string;
    clauses?: ContractClauses;
  };
  status: "pending" | "signed" | "voided";
  signed_at: string | null;
  legal_name: string | null;
  presigned_pdf_url: string | null;
  created_at: string;
  updated_at: string;
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
  async resend2FA(
    email: string,
    password: string,
  ): Promise<{ message: string; email: string }> {
    const response = await fetch(`${API_URL}/admin/resend-2fa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  async getTeams(options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<TeamsResponse> {
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
    customerEmail: string,
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
    customerEmail?: string,
  ): Promise<ChangePlanResult> {
    const response = await fetch(`${API_URL}/admin/teams/change-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        teamId,
        newPlan,
        clipLimit,
        monthlyPrice,
        customerEmail,
      }),
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
    percentOff: number,
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

  async getAffiliates(): Promise<AffiliatesResponse> {
    const response = await fetch(`${API_URL}/admin/affiliates`, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  // Announcements
  async getAnnouncements(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<AnnouncementsResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());

    const queryString = params.toString();
    const url = `${API_URL}/announcements/admin${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async getAnnouncement(id: number): Promise<{ announcement: Announcement }> {
    const response = await fetch(`${API_URL}/announcements/admin/${id}`, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async createAnnouncement(
    data: CreateAnnouncementData,
  ): Promise<{ announcement: Announcement }> {
    const response = await fetch(`${API_URL}/announcements/admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateAnnouncement(
    id: number,
    data: Partial<CreateAnnouncementData>,
  ): Promise<{ announcement: Announcement }> {
    const response = await fetch(`${API_URL}/announcements/admin/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteAnnouncement(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/announcements/admin/${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async publishAnnouncement(
    id: number,
  ): Promise<{ announcement: Announcement }> {
    const response = await fetch(
      `${API_URL}/announcements/admin/${id}/publish`,
      {
        method: "POST",
        headers: { ...getAuthHeaders() },
      },
    );
    return handleResponse(response);
  },

  // Incidents
  async getIncidents(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<IncidentsResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());

    const queryString = params.toString();
    const url = `${API_URL}/incidents/admin${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async createIncident(
    data: CreateIncidentData,
  ): Promise<{ incident: Incident }> {
    const response = await fetch(`${API_URL}/incidents/admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateIncident(
    id: number,
    data: { title?: string; affected_services?: string[] },
  ): Promise<{ incident: Incident }> {
    const response = await fetch(`${API_URL}/incidents/admin/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async addIncidentUpdate(
    id: number,
    data: AddIncidentUpdateData,
  ): Promise<{ incident: Incident }> {
    const response = await fetch(`${API_URL}/incidents/admin/${id}/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteIncident(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/incidents/admin/${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  // Campaign Management
  async getCampaigns(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<CampaignsResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());

    const queryString = params.toString();
    const url = `${API_URL}/admin/campaigns${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async getCampaign(id: number): Promise<{ campaign: CampaignDetail }> {
    const response = await fetch(`${API_URL}/admin/campaigns/${id}`, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async approveCampaign(
    id: number,
    quotedCpm: string,
    videoMinimum: number,
    adminNotes?: string,
    minimumFund?: number,
  ): Promise<{ campaign: Campaign }> {
    const response = await fetch(`${API_URL}/admin/campaigns/${id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ quotedCpm, videoMinimum, adminNotes, minimumFund }),
    });
    return handleResponse(response);
  },

  async rejectCampaign(
    id: number,
    rejectionReason: string,
    adminNotes?: string,
  ): Promise<{ campaign: Campaign }> {
    const response = await fetch(`${API_URL}/admin/campaigns/${id}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ rejectionReason, adminNotes }),
    });
    return handleResponse(response);
  },

  async updateCampaign(
    id: number,
    data: { quotedCpm?: string; videoMinimum?: number; adminNotes?: string; minimumFund?: number; budget?: number },
  ): Promise<{ campaign: Campaign }> {
    const response = await fetch(`${API_URL}/admin/campaigns/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async pauseCampaign(id: number): Promise<{ campaign: Campaign }> {
    const response = await fetch(`${API_URL}/admin/campaigns/${id}/pause`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async endCampaign(id: number): Promise<{ campaign: Campaign }> {
    const response = await fetch(`${API_URL}/admin/campaigns/${id}/end`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async getCampaignContract(
    campaignId: number,
  ): Promise<{ contract: CampaignContract | null }> {
    const response = await fetch(
      `${API_URL}/admin/campaigns/${campaignId}/contract`,
      {
        headers: { ...getAuthHeaders() },
      },
    );
    return handleResponse(response);
  },

  async generateCampaignContract(
    campaignId: number,
  ): Promise<{ contract: CampaignContract }> {
    const response = await fetch(
      `${API_URL}/admin/campaigns/${campaignId}/contract/generate`,
      {
        method: "POST",
        headers: { ...getAuthHeaders() },
      },
    );
    return handleResponse(response);
  },

  async updateCampaignContract(
    campaignId: number,
    clauses: ContractClauses,
  ): Promise<{ contract: CampaignContract }> {
    const response = await fetch(
      `${API_URL}/admin/campaigns/${campaignId}/contract`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(clauses),
      },
    );
    return handleResponse(response);
  },

  async getCampaignVideos(
    campaignId: number,
    options?: { page?: number; pageSize?: number },
  ): Promise<{
    videos: CampaignVideo[];
    pagination: { page: number; pageSize: number; totalVideos: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", options.page.toString());
    if (options?.pageSize) params.set("pageSize", options.pageSize.toString());
    const qs = params.toString();
    const response = await fetch(
      `${API_URL}/admin/campaigns/${campaignId}/videos${qs ? `?${qs}` : ""}`,
      { headers: { ...getAuthHeaders() } },
    );
    return handleResponse(response);
  },

  async getCampaignPosts(
    campaignId: number,
    options?: {
      tab?: "queued" | "published";
      platform?: string;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    },
  ): Promise<CampaignPostsResponse> {
    const params = new URLSearchParams();
    if (options?.tab) params.set("tab", options.tab);
    if (options?.platform) params.set("platform", options.platform);
    if (options?.page) params.set("page", options.page.toString());
    if (options?.pageSize) params.set("pageSize", options.pageSize.toString());
    if (options?.sortBy) params.set("sortBy", options.sortBy);
    if (options?.sortOrder) params.set("sortOrder", options.sortOrder);

    const qs = params.toString();
    const response = await fetch(
      `${API_URL}/admin/campaigns/${campaignId}/posts${qs ? `?${qs}` : ""}`,
      { headers: { ...getAuthHeaders() } },
    );
    return handleResponse(response);
  },

  async getMasterAgreement(
    teamId: number,
  ): Promise<{ agreement: any }> {
    const response = await fetch(
      `${API_URL}/admin/teams/${teamId}/master-agreement`,
      { headers: { ...getAuthHeaders() } },
    );
    return handleResponse(response);
  },

  async voidAndRegenerateMasterContract(
    teamId: number,
  ): Promise<{ agreement: any }> {
    const response = await fetch(
      `${API_URL}/admin/teams/${teamId}/void-and-regenerate-contract`,
      {
        method: "POST",
        headers: { ...getAuthHeaders() },
      },
    );
    return handleResponse(response);
  },

  async postCampaignClip(
    campaignId: number,
    clipId: number,
    platformQuantities: Record<string, number>,
  ): Promise<{ message: string; postIds: Array<{ id: number; platform: string }> }> {
    const response = await fetch(
      `${API_URL}/admin/campaigns/${campaignId}/post`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ clipId, platformQuantities }),
      },
    );
    return handleResponse(response);
  },
};
