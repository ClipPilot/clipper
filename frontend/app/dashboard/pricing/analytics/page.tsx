"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { toast } from "@/lib/toast";
import { useTeams } from "@/hooks/useTeams";
import { stripeAPI } from "@/api/stripe";
import { STRIPE_PRICES } from "@/config/stripe.constants";
import { isAnalyticsPlan, getPlanName, isMainPlatformPlan } from "@/lib/plans";
import { AnalyticsPricing, type AnalyticsTier } from "@clipper/shared-ui";

const analyticsTiers: AnalyticsTier[] = [
  {
    key: "analytics_starter",
    title: "Cuttr Pulse",
    description: "Track competitors and monitor trends across social platforms.",
    price: "$19",
    priceSuffix: "month",
    accountLimit: "50 profiles",
    features: [
      "Syncs every 12 hours",
      "Competitor benchmarking",
      "Viral alerts",
    ],
    priceId: STRIPE_PRICES.ANALYTICS_STARTER,
    buttonText: "Get Cuttr Pulse",
  },
  {
    key: "analytics_business",
    title: "Max",
    description: "Full analytics suite with hashtag tracking and higher limits.",
    price: "$99",
    priceSuffix: "month",
    accountLimit: "250 profiles",
    mostPopular: true,
    features: [
      "Syncs every 12 hours",
      "Competitor benchmarking",
      "Viral alerts",
      "Hashtag & keyword tracking",
    ],
    priceId: STRIPE_PRICES.ANALYTICS_BUSINESS,
    buttonText: "Get Max",
  },
];

function AnalyticsPricingContent() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [livePrices, setLivePrices] = useState<Record<string, { amount: number; currency: string }>>({});
  const currentPlan = selectedTeam?.plan;

  useEffect(() => {
    stripeAPI.getAnalyticsPrices().then(({ prices }) => setLivePrices(prices)).catch(() => {});
  }, []);

  const handleCheckout = async (tier: AnalyticsTier) => {
    if (!selectedTeam) {
      toast.danger("No workspace selected", {
        description: "Please select a workspace to continue.",
      });
      return;
    }
    try {
      setLoadingTier(tier.key);
      const { url } = await stripeAPI.createCheckoutSession(
        selectedTeam.id,
        tier.priceId
      );
      window.open(url, "_blank");
    } catch (error: any) {
      toast.danger("Checkout failed", {
        description: error.message || "Failed to start checkout",
      });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <AnalyticsPricing
      tiers={analyticsTiers}
      currentPlan={currentPlan}
      currentPlanDisplayName={getPlanName(currentPlan)}
      hasMainPlan={isMainPlatformPlan(currentPlan)}
      isOnAnalytics={isAnalyticsPlan(currentPlan)}
      livePrices={livePrices}
      loadingTier={loadingTier}
      onCheckout={handleCheckout}
      onNavigateToMainPricing={() => router.push("/dashboard/pricing")}
    />
  );
}

function AnalyticsPricingFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Icon
          icon="solar:loading-circle-bold"
          className="text-4xl animate-spin text-accent-400"
        />
        <p className="text-text-secondary">Loading pricing...</p>
      </div>
    </div>
  );
}

export default function AnalyticsPricingPage() {
  return (
    <Suspense fallback={<AnalyticsPricingFallback />}>
      <AnalyticsPricingContent />
    </Suspense>
  );
}
