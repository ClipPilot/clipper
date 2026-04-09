"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Chip, Separator, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { toast } from "@/lib/toast";
import { useTeams } from "@/hooks/useTeams";
import { stripeAPI } from "@/api/stripe";
import { STRIPE_PRICES } from "@/config/stripe.constants";
import { isAnalyticsPlan, getPlanName, isMainPlatformPlan } from "@/lib/plans";

interface AnalyticsTier {
  key: string;
  title: string;
  price: string;
  priceSuffix: string;
  accountLimit: number;
  features: string[];
  priceId: string;
  mostPopular?: boolean;
}

const analyticsTiers: AnalyticsTier[] = [
  {
    key: "analytics_starter",
    title: "Starter",
    price: "$XX",
    priceSuffix: "month",
    accountLimit: 50,
    features: [
      "Track up to 50 accounts",
      "Free syncs (no credit cost)",
      "Competitor benchmarking",
      "Viral alerts",
    ],
    priceId: STRIPE_PRICES.ANALYTICS_STARTER,
  },
  {
    key: "analytics_pro",
    title: "Pro",
    price: "$XX",
    priceSuffix: "month",
    accountLimit: 100,
    mostPopular: true,
    features: [
      "Track up to 100 accounts",
      "Free syncs (no credit cost)",
      "Competitor benchmarking",
      "Viral alerts",
    ],
    priceId: STRIPE_PRICES.ANALYTICS_PRO,
  },
  {
    key: "analytics_business",
    title: "Business",
    price: "$XX",
    priceSuffix: "month",
    accountLimit: 250,
    features: [
      "Track up to 250 accounts",
      "Free syncs (no credit cost)",
      "Competitor benchmarking",
      "Viral alerts",
    ],
    priceId: STRIPE_PRICES.ANALYTICS_BUSINESS,
  },
];

// TODO(human): Decide what features to list per tier and set pricing.
// The `features` arrays above are placeholders. Consider differentiating
// tiers beyond just account limits — e.g. alert frequency, export options,
// or historical data retention. Set real prices in the `price` fields.

export default function AnalyticsPricingPage() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const currentPlan = selectedTeam?.plan;

  const hasMainPlan = isMainPlatformPlan(currentPlan);
  const isOnAnalytics = isAnalyticsPlan(currentPlan);

  const handleCheckout = async (tier: AnalyticsTier) => {
    if (!selectedTeam) {
      toast.danger("No workspace selected");
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
      toast.danger("Checkout failed", { description: error.message });
    } finally {
      setLoadingTier(null);
    }
  };

  const getButtonState = (tier: AnalyticsTier) => {
    if (currentPlan === tier.key) return { text: "Current Plan", disabled: true };
    if (hasMainPlan) return { text: "Current plan includes unlimited tracking", disabled: true };
    if (isOnAnalytics) return { text: "Switch Plan", disabled: false };
    return { text: "Get Started", disabled: false };
  };

  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <h1 className="text-3xl font-bold text-text-primary">Analytics Plans</h1>
          <p className="text-text-secondary max-w-lg mx-auto">
            Track competitor performance and viral trends. No credit cost for syncs — just pick your account limit.
          </p>
        </motion.div>

        {hasMainPlan && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Icon icon="solar:check-circle-bold" className="text-emerald-500 flex-shrink-0" width={20} />
            <p className="text-sm text-emerald-400">
              Your {getPlanName(currentPlan)} plan already includes unlimited virality tracking.
            </p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {analyticsTiers.map((tier) => {
            const { text, disabled } = getButtonState(tier);
            const isCurrent = currentPlan === tier.key;

            return (
              <div
                key={tier.key}
                className={cn(
                  "rounded-xl border border-border-base bg-surface-base overflow-hidden p-3 flex flex-col",
                  {
                    "border-cyan-500/50 shadow-lg shadow-cyan-500/10": tier.mostPopular && !isCurrent,
                    "border-cyan-400 shadow-lg shadow-cyan-400/20": isCurrent,
                  }
                )}
              >
                <div className="flex items-center gap-2 px-4 pt-4">
                  {isCurrent && <Chip size="sm" className="bg-cyan-500/20 text-cyan-400">Current</Chip>}
                  {tier.mostPopular && !isCurrent && <Chip size="sm">Popular</Chip>}
                </div>
                <div className="flex flex-col items-start gap-2 p-4 pb-6">
                  <h2 className="text-xl font-semibold text-text-primary">{tier.title}</h2>
                </div>
                <Separator className="bg-border-base" />
                <div className="p-4 space-y-6 flex-1">
                  <div className="pt-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-text-primary">{tier.price}</span>
                      <span className="text-sm text-text-tertiary">/{tier.priceSuffix}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 rounded-lg bg-surface-dark/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-tertiary">Account Limit</span>
                      <span className="text-sm font-medium text-text-primary">{tier.accountLimit}</span>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Icon className="text-cyan-400 flex-shrink-0" icon="solar:check-circle-bold" width={20} />
                        <p className="text-sm text-text-secondary">{feature}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 pt-0">
                  <Button
                    fullWidth
                    className={cn({
                      "bg-cyan-500 text-white font-semibold": !disabled && tier.mostPopular,
                    })}
                    variant={disabled ? "tertiary" : "outline"}
                    isDisabled={disabled}
                    isPending={loadingTier === tier.key}
                    onPress={() => handleCheckout(tier)}
                  >
                    {text}
                  </Button>
                </div>
              </div>
            );
          })}
        </motion.div>

        <div className="text-center">
          <button
            className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
            onClick={() => router.push("/dashboard/pricing")}
          >
            Looking for clips & editing? View all plans &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
