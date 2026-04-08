import { apiFetch } from "@/lib/apiClient";
import type { Team } from "@/store/auth";

export type { Team };

const API_URL = process.env.NEXT_PUBLIC_API_URL;

class TeamAPI {
  private toLogoUrl(team: Team): Team {
    return {
      ...team,
      logo_url: team.logo_url ? `${API_URL}/teams/${team.id}/logo` : undefined,
    };
  }

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
    return (data.teams as Team[]).map((t) => this.toLogoUrl(t));
  }
}

export const teamAPI = new TeamAPI();
