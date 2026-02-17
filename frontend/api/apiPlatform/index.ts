import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  revoked: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreatedApiKey extends ApiKey {
  key: string;
}

export interface Wallet {
  balance_cents: number;
  total_spent_cents: number;
  total_topped_up_cents: number;
  active: boolean;
}

export interface UsageLog {
  id: number;
  api_key_id: number;
  product_slug: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  cost_cents: number;
  quantity: number;
  response_time_ms: number | null;
  created_at: string;
}

export interface AutoRefillSettings {
  auto_refill: boolean;
  refill_threshold_cents: number;
  refill_amount_cents: number;
  has_payment_method: boolean;
}

class ApiPlatformAPI {
  async createKey(teamId: number, name: string): Promise<CreatedApiKey> {
    const response = await apiFetch(`${API_URL}/platform/teams/${teamId}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create API key");
    }

    return response.json();
  }

  async listKeys(teamId: number): Promise<{ keys: ApiKey[] }> {
    const response = await apiFetch(`${API_URL}/platform/teams/${teamId}/keys`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list API keys");
    }

    return response.json();
  }

  async revokeKey(teamId: number, keyId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/platform/teams/${teamId}/keys/${keyId}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to revoke API key");
    }
  }

  async getWallet(teamId: number): Promise<Wallet> {
    const response = await apiFetch(`${API_URL}/platform/teams/${teamId}/wallet`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get wallet");
    }

    return response.json();
  }

  async createTopUp(teamId: number, amountCents: number): Promise<{ url: string }> {
    const response = await apiFetch(
      `${API_URL}/platform/teams/${teamId}/wallet/topup`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: amountCents }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create top-up");
    }

    return response.json();
  }

  async getUsageLogs(
    teamId: number,
    limit = 50,
    offset = 0,
  ): Promise<{ logs: UsageLog[]; total: number }> {
    const response = await apiFetch(
      `${API_URL}/platform/teams/${teamId}/usage?limit=${limit}&offset=${offset}`,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get usage logs");
    }

    return response.json();
  }

  async getAutoRefill(teamId: number): Promise<AutoRefillSettings> {
    const response = await apiFetch(
      `${API_URL}/platform/teams/${teamId}/wallet/auto-refill`,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get auto-refill settings");
    }

    return response.json();
  }

  async updateAutoRefill(
    teamId: number,
    settings: Partial<Omit<AutoRefillSettings, "has_payment_method">>,
  ): Promise<AutoRefillSettings> {
    const response = await apiFetch(
      `${API_URL}/platform/teams/${teamId}/wallet/auto-refill`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update auto-refill settings");
    }

    return response.json();
  }
}

export const apiPlatformAPI = new ApiPlatformAPI();
