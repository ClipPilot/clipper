import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface WidgetConfig {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardPreferences {
  dashboardLayout: WidgetConfig[] | null;
  widgetColors: Record<string, string> | null;
}

class PreferencesAPI {
  async getPreferences(): Promise<DashboardPreferences> {
    const response = await apiFetch(`${API_URL}/user/preferences`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get preferences");
    }

    return response.json();
  }

  async updatePreferences(data: {
    dashboardLayout?: WidgetConfig[];
    widgetColors?: Record<string, string>;
  }): Promise<DashboardPreferences> {
    const response = await apiFetch(`${API_URL}/user/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update preferences");
    }

    return response.json();
  }

  async resetPreferences(): Promise<void> {
    const response = await apiFetch(`${API_URL}/user/preferences/reset`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to reset preferences");
    }
  }
}

export const preferencesAPI = new PreferencesAPI();
