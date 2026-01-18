import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface Team {
  id: number;
  name: string;
  type: "personal" | "business" | "enterprise";
  role: "owner" | "manager" | "member";
  plan: "free" | "studio" | "scale" | "enterprise";
  teamSubscriptionId?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamUsageStats {
  teamId: number;
  teamName: string;
  clipsCreated: number;
  baseLimit: number;
  baseRemaining: number;
  addonRemaining: number;
  totalRemaining: number;
  clipsGenerated: number;
  generationLimit: number;
  generationsRemaining: number;
  resetsDate: string;
  rollover: boolean;
  // Legacy fields for backward compatibility
  limit: number;
  remaining: number;
}

export interface UsageHistoryEntry {
  date: string;
  clipsCreated: number;
  creditsUsed: number;
  generationsUsed: number;
}

export interface UsageHistoryResponse {
  history: UsageHistoryEntry[];
  period: "day" | "week" | "month";
  totalClips: number;
  totalCredits: number;
  totalGenerations: number;
}

export interface TeamMember {
  id: number;
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "owner" | "manager" | "member";
  joinedAt: string;
}

export interface TeamInvite {
  id: number;
  email: string;
  role: "owner" | "manager" | "member";
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface InviteDetails {
  id: number;
  email: string;
  role: "owner" | "manager" | "member";
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  team: {
    id: number;
    name: string;
    type: string;
    plan: string;
  };
  invitedBy: {
    firstName: string;
    lastName: string;
  };
}

class TeamAPI {
  async getUserTeams(): Promise<Team[]> {
    const response = await apiFetch(`${API_URL}/teams`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get teams");
    }

    const data = await response.json();
    return data.teams;
  }

  async getDefaultTeam(): Promise<Team> {
    const response = await apiFetch(`${API_URL}/teams/default`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get default team");
    }

    return await response.json();
  }

  async getTeamUsageStats(teamId: number): Promise<TeamUsageStats> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/usage-stats`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get team usage stats");
    }

    return await response.json();
  }

  async getUsageHistory(
    teamId: number,
    period: "day" | "week" | "month" = "day",
    limit: number = 30
  ): Promise<UsageHistoryResponse> {
    const response = await apiFetch(
      `${API_URL}/teams/${teamId}/usage-history?period=${period}&limit=${limit}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get usage history");
    }

    return await response.json();
  }

  async getTeamMembers(teamId: number): Promise<TeamMember[]> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/members`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get team members");
    }

    const data = await response.json();
    return data.members;
  }

  async addTeamMember(teamId: number, email: string, role: "manager" | "member" = "member"): Promise<void> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add team member");
    }
  }

  async removeTeamMember(teamId: number, memberId: number): Promise<void> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/members/${memberId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to remove team member");
    }
  }

  async updateTeamMemberRole(teamId: number, memberId: number, role: "owner" | "manager" | "member"): Promise<void> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/members/${memberId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update member role");
    }
  }

  async leaveTeam(teamId: number): Promise<void> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to leave team");
    }
  }

  async updateTeamName(teamId: number, name: string): Promise<Team> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update team name");
    }

    const data = await response.json();
    return data.team;
  }

  async deleteTeam(teamId: number): Promise<void> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete team");
    }
  }

  async createTeam(name: string): Promise<Team> {
    const response = await apiFetch(`${API_URL}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create team");
    }

    const data = await response.json();
    return data.team;
  }

  async getTeamInvites(teamId: number): Promise<TeamInvite[]> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/invites`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get invites");
    }

    const data = await response.json();
    return data.invites;
  }

  async createInvite(teamId: number, email: string, role: "manager" | "member" = "member"): Promise<void> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send invite");
    }
  }

  async revokeInvite(teamId: number, inviteId: number): Promise<void> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/invites/${inviteId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to revoke invite");
    }
  }

  async resendInvite(teamId: number, inviteId: number): Promise<void> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/invites/${inviteId}/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to resend invite");
    }
  }

  async getInviteByToken(token: string): Promise<InviteDetails> {
    const response = await apiFetch(`${API_URL}/teams/invites/${token}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get invite");
    }

    const data = await response.json();
    return data.invite;
  }

  async acceptInvite(token: string): Promise<{ team: Team; role: string }> {
    const response = await apiFetch(`${API_URL}/teams/invites/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to accept invite");
    }

    return await response.json();
  }

  async uploadTeamLogo(teamId: number, file: File): Promise<Team> {
    const formData = new FormData();
    formData.append("logo", file);

    const response = await apiFetch(`${API_URL}/teams/${teamId}/logo`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to upload logo");
    }

    const data = await response.json();
    return data.team;
  }

  async removeTeamLogo(teamId: number): Promise<Team> {
    const response = await apiFetch(`${API_URL}/teams/${teamId}/logo`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to remove logo");
    }

    const data = await response.json();
    return data.team;
  }
}

export const teamAPI = new TeamAPI();
