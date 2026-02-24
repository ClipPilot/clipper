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

export interface MassPostingApplication {
  id: number;
  team_id: number;
  status: "pending" | "accepted" | "rejected" | "appeal";
  google_drive_folder_id: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  budget: string | null;
  quoted_cpm: string | null;
  video_minimum: number | null;
  team_name: string;
  team_plan: string;
}

export interface ApplicationDetail extends MassPostingApplication {
  intake_form_id: number | null;
  details: any;
  intakeForm: IntakeForm | null;
}

export interface ApplicationsResponse {
  applications: MassPostingApplication[];
  total: number;
  pagination: Pagination;
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

  async getAffiliates(): Promise<AffiliatesResponse> {
    const response = await fetch(`${API_URL}/admin/affiliates`, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  // Announcements
  async getAnnouncements(options?: { status?: string; limit?: number; offset?: number }): Promise<AnnouncementsResponse> {
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

  async createAnnouncement(data: CreateAnnouncementData): Promise<{ announcement: Announcement }> {
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

  async updateAnnouncement(id: number, data: Partial<CreateAnnouncementData>): Promise<{ announcement: Announcement }> {
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

  async deleteAnnouncement(id: number): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/announcements/admin/${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async publishAnnouncement(id: number): Promise<{ announcement: Announcement }> {
    const response = await fetch(`${API_URL}/announcements/admin/${id}/publish`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  // Mass Posting Applications
  async getApplications(options?: { status?: string; limit?: number; offset?: number }): Promise<ApplicationsResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());

    const queryString = params.toString();
    const url = `${API_URL}/admin/applications${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async getApplication(id: number): Promise<{ application: ApplicationDetail }> {
    const response = await fetch(`${API_URL}/admin/applications/${id}`, {
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async approveApplication(id: number, adminNotes?: string): Promise<{ application: MassPostingApplication }> {
    const response = await fetch(`${API_URL}/admin/applications/${id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ adminNotes }),
    });
    return handleResponse(response);
  },

  async rejectApplication(id: number, rejectionReason: string, adminNotes?: string): Promise<{ application: MassPostingApplication }> {
    const response = await fetch(`${API_URL}/admin/applications/${id}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ rejectionReason, adminNotes }),
    });
    return handleResponse(response);
  },

  async retryDriveFolder(id: number): Promise<{ application: MassPostingApplication }> {
    const response = await fetch(`${API_URL}/admin/applications/${id}/retry-drive`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
    });
    return handleResponse(response);
  },

  async updateApplicationCPM(
    id: number,
    quotedCpm: string,
    videoMinimum?: number,
  ): Promise<{ application: MassPostingApplication }> {
    const response = await fetch(`${API_URL}/admin/applications/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ quotedCpm, videoMinimum }),
    });
    return handleResponse(response);
  },
};
