import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export const STRIPE_PRICES = {
  STUDIO: "price_1SeiLyGu9cYiGgY365Gs60AW",
  SCALE: "price_1SeiLyGu9cYiGgY320k4zUWp",
  STUDIO_ADDON: "price_1SeiLzGu9cYiGgY3c734FM7S",
  SCALE_ADDON: "price_1SeiLzGu9cYiGgY3KT3zya5Z",
} as const;

export const PLAN_DETAILS = {
  free: { name: "Free", clips: 3, price: 0 },
  studio: { name: "Studio", clips: 500, price: 8495 },
  scale: { name: "Scale", clips: 1000, price: 8990 },
} as const;

export interface Subscription {
  id: number;
  team_id: number;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  plan: string;
  price_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

class StripeAPI {
  async createCheckoutSession(
    teamId: number,
    priceId: string
  ): Promise<{ url: string }> {
    const response = await apiFetch(`${API_URL}/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        priceId,
        successUrl: `${window.location.origin}/dashboard/pricing?success=true`,
        cancelUrl: `${window.location.origin}/dashboard/pricing?canceled=true`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create checkout session");
    }

    return response.json();
  }

  async createPortalSession(teamId: number): Promise<{ url: string }> {
    const response = await apiFetch(`${API_URL}/stripe/portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        returnUrl: `${window.location.origin}/dashboard/settings`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create portal session");
    }

    return response.json();
  }

  async getSubscription(
    teamId: number
  ): Promise<{ subscription: Subscription | null; plan: string }> {
    const response = await apiFetch(`${API_URL}/stripe/subscription/${teamId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get subscription");
    }

    return response.json();
  }
}

export const stripeAPI = new StripeAPI();
