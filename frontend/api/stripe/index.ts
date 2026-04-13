import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import type { Subscription as SharedSubscription, AnalyticsPricesResponse, paths } from "@clipper/shared-types";

export { STRIPE_PRICES, PLAN_DETAILS } from "@/config/stripe.constants";

export type Subscription = SharedSubscription;

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

  async changePlan(
    teamId: number,
    newPriceId: string
  ): Promise<{
    success: boolean;
    effectiveDate: string;
    newPlan: string;
    message: string;
  }> {
    const response = await apiFetch(`${API_URL}/stripe/change-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, newPriceId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to change plan");
    }

    return response.json();
  }
  async getAnalyticsPrices(): Promise<AnalyticsPricesResponse> {
    const response = await apiFetch(`${API_URL}/stripe/analytics-prices`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch analytics prices");
    }

    return response.json();
  }
}

export const stripeAPI = new StripeAPI();
