import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface Team {
  id: number;
  name: string;
  type: "personal" | "business" | "enterprise";
  role: "owner" | "manager" | "member";
  teamSubscriptionId?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamUsageStats {
  teamId: number;
  teamName: string;
  clipsCreated: number;
  limit: number;
  remaining: number;
  resetsDate: string;
  rollover: boolean;
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
}

export const teamAPI = new TeamAPI();
