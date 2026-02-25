import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface IntakeFormData {
  name?: string;
  brand_description?: string;
  company_website_url?: string;
  icps?: Array<{
    name: string;
    description: string;
    demographics?: string;
    painPoints?: string[];
  }>;
  company_socials?: Array<{
    platform:
      | "instagram"
      | "tiktok"
      | "youtube"
      | "twitter"
      | "linkedin"
      | "facebook"
      | "other";
    url: string;
    handle?: string;
  }>;
  competitor_socials?: Array<{
    companyName: string;
    accounts: Array<{ platform: string; url: string }>;
  }>;
  completed?: boolean;
  budget?: number | null;
}

export interface IntakeForm extends IntakeFormData {
  id: number;
  team_id: number;
  created_at: string;
  updated_at: string;
}

export interface MassPostingApplication {
  id: number;
  team_id: number;
  intake_form_id: number | null;
  status: "pending" | "accepted" | "rejected" | "appeal";
  details: any;
  google_drive_folder_id: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationStatus {
  hasIntakeForm: boolean;
  intakeFormCompleted: boolean;
  applicationStatus: string | null;
  googleDriveFolderId: string | null;
}

class IntakeAPI {
  async getIntakeForm(teamId: number): Promise<{ form: IntakeForm | null }> {
    const response = await apiFetch(`${API_URL}/intake/teams/${teamId}/form`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch intake form");
    }

    return response.json();
  }

  async saveIntakeForm(
    teamId: number,
    data: IntakeFormData
  ): Promise<{ form: IntakeForm }> {
    const response = await apiFetch(`${API_URL}/intake/teams/${teamId}/form`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save intake form");
    }

    return response.json();
  }

  async submitApplication(
    teamId: number,
    data: IntakeFormData
  ): Promise<{ application: MassPostingApplication }> {
    const response = await apiFetch(
      `${API_URL}/intake/teams/${teamId}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to submit application");
    }

    return response.json();
  }

  async submitAppeal(
    teamId: number,
    data: IntakeFormData
  ): Promise<{ application: MassPostingApplication }> {
    const response = await apiFetch(
      `${API_URL}/intake/teams/${teamId}/appeal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to submit appeal");
    }

    return response.json();
  }

  async getApplicationStatus(teamId: number): Promise<ApplicationStatus> {
    const response = await apiFetch(
      `${API_URL}/intake/teams/${teamId}/status`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch application status");
    }

    return response.json();
  }

  async getLatestApplication(
    teamId: number
  ): Promise<{ application: MassPostingApplication | null }> {
    const response = await apiFetch(
      `${API_URL}/intake/teams/${teamId}/application`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch application");
    }

    return response.json();
  }
}

export const intakeAPI = new IntakeAPI();
