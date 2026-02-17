"use client";

import React, { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Link, Spacer, addToast, Input, Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

import { tiers } from "./pricing-tiers";
import features from "./pricing-tiers-features";
import { TiersEnum, Tier } from "./pricing-types";
import { PaidPlanView } from "./PaidPlanView";
import { PricingTierCard } from "./PricingTierCard";
import { PricingTable } from "./PricingTable";
import { useTeams } from "@/hooks/useTeams";
import { useUsageStats } from "@/hooks/useUsageStats";
import { stripeAPI, STRIPE_PRICES } from "@/api/stripe";
import { apiJson } from "@/lib/apiClient";
import API_URL from "@/config/constants";

function PricingContent() {
  const searchParams = useSearchParams();
  const { selectedTeam, fetchTeams } = useTeams();
  const { usageStats, refetch: refetchUsage } = useUsageStats(selectedTeam?.id);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingChangePlan, setLoadingChangePlan] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [appliedReferral, setAppliedReferral] = useState<string | null>(null);
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [showReferralInput, setShowReferralInput] = useState(false);

  const currentPlan = selectedTeam?.plan || "free";
  const isPaidPlan = ["creator", "studio", "scale", "enterprise"].includes(currentPlan);
  const isOwner = selectedTeam?.role === "owner";

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      addToast({
        title: "Payment successful!",
        description: isPaidPlan
          ? "Your clips have been added."
          : "Your plan has been upgraded.",
        color: "success",
      });
      fetchTeams();
      refetchUsage();
    }
    if (searchParams.get("canceled") === "true") {
      addToast({
        title: "Checkout canceled",
        description: "Your subscription was not changed.",
        color: "warning",
      });
    }
  }, [searchParams, fetchTeams, refetchUsage, isPaidPlan]);

  const handleUpgrade = async (tier: Tier) => {
    if (!selectedTeam) {
      addToast({
        title: "No workspace selected",
        description: "Please select a workspace to upgrade.",
        color: "danger",
      });
      return;
    }

    if (tier.key === TiersEnum.Free) return;

    const priceId = tier.priceId;
    if (!priceId) return;

    try {
      setLoadingTier(tier.key);
      const { url } = await stripeAPI.createCheckoutSession(
        selectedTeam.id,
        priceId
      );
      window.open(url, "_blank");
    } catch (error: any) {
      addToast({
        title: "Checkout failed",
        description: error.message || "Failed to start checkout",
        color: "danger",
      });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!selectedTeam) return;

    try {
      setLoadingPortal(true);
      const { url } = await stripeAPI.createPortalSession(selectedTeam.id);
      window.open(url, "_blank");
    } catch (error: any) {
      addToast({
        title: "Portal failed",
        description: error.message || "Failed to open billing portal",
        color: "danger",
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleBuyAddon = async () => {
    if (!selectedTeam) return;

    const priceId =
      currentPlan === "studio"
        ? STRIPE_PRICES.STUDIO_ADDON
        : STRIPE_PRICES.SCALE_ADDON;

    try {
      setLoadingTier(currentPlan);
      const { url } = await stripeAPI.createCheckoutSession(
        selectedTeam.id,
        priceId
      );
      window.open(url, "_blank");
    } catch (error: any) {
      addToast({
        title: "Checkout failed",
        description: error.message || "Failed to start checkout",
        color: "danger",
      });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleChangePlan = async (newPlan: "creator" | "studio" | "scale"): Promise<{ effectiveDate: string } | void> => {
    if (!selectedTeam) return;

    const newPriceId = newPlan === "creator"
      ? STRIPE_PRICES.CREATOR
      : newPlan === "studio"
        ? STRIPE_PRICES.STUDIO
        : STRIPE_PRICES.SCALE;

    try {
      setLoadingChangePlan(true);
      const result = await stripeAPI.changePlan(selectedTeam.id, newPriceId);

      addToast({
        title: "Plan change scheduled",
        description: result.message,
        color: "success",
      });

      return { effectiveDate: result.effectiveDate };
    } catch (error: any) {
      addToast({
        title: "Failed to change plan",
        description: error.message || "Failed to change plan",
        color: "danger",
      });
    } finally {
      setLoadingChangePlan(false);
    }
  };

  const getButtonText = (tier: Tier) => {
    if (tier.key === TiersEnum.Free) {
      return currentPlan === "free" ? "Current Plan" : "Free";
    }
    if (tier.key === currentPlan) {
      return "Current Plan";
    }
    return tier.buttonText;
  };

  const isButtonDisabled = (tier: Tier) => {
    return tier.key === TiersEnum.Free || tier.key === currentPlan;
  };

  const handleApplyReferral = async () => {
    if (!referralCode.trim() || !selectedTeam) return;

    setIsApplyingCode(true);
    try {
      const validation = await apiJson<{
        valid: boolean;
        type: "affiliate" | "referral" | null;
        code: string;
      }>(
        `${API_URL}/referrals/validate-code/${encodeURIComponent(referralCode.trim())}`,
        { skipAuth: true }
      );

      if (validation.valid && validation.type) {
        const applyEndpoint =
          validation.type === "affiliate"
            ? `${API_URL}/affiliates/${selectedTeam.id}/apply`
            : `${API_URL}/referrals/${selectedTeam.id}/apply`;

        await apiJson(applyEndpoint, {
          method: "POST",
          body: JSON.stringify({ code: referralCode.trim() }),
        });

        setAppliedReferral(validation.code);
        setShowReferralInput(false);
        addToast({
          title: `${validation.type === "affiliate" ? "Affiliate" : "Referral"} code applied!`,
          description: "Your code has been linked successfully.",
          color: "success",
        });
      } else {
        addToast({
          title: "Invalid code",
          description: "Please check your code and try again.",
          color: "danger",
        });
      }
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "Failed to apply code",
        color: "danger",
      });
    } finally {
      setIsApplyingCode(false);
    }
  };

  const handleRemoveReferral = () => {
    setAppliedReferral(null);
    setReferralCode("");
  };

  if (isPaidPlan) {
    return (
      <PaidPlanView
        currentPlan={currentPlan as "creator" | "studio" | "scale" | "enterprise"}
        teamName={selectedTeam?.name}
        teamId={selectedTeam?.id}
        isOwner={isOwner}
        usageStats={usageStats ?? undefined}
        loadingPortal={loadingPortal}
        loadingAddon={loadingTier === currentPlan}
        loadingChangePlan={loadingChangePlan}
        onManageSubscription={handleManageSubscription}
        onBuyAddon={handleBuyAddon}
        onChangePlan={handleChangePlan}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-12 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-full w-full transform-gpu overflow-hidden blur-3xl"
      >
        <div
          className="mx-auto aspect-[1155/678] w-[72rem] bg-gradient-to-tr from-accent-400/30 to-purple-500/20 opacity-30"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative z-10 flex max-w-xl flex-col text-center xl:translate-x-[12.5%]"
      >
        <h2 className="text-accent-400 text-sm font-medium uppercase tracking-wider">
          Pricing
        </h2>
        <Spacer y={2} />
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Choose your plan
        </h1>
        <Spacer y={4} />
        <p className="text-lg text-text-secondary">
          Generate unlimited clips. Only pay for what you save.
        </p>
      </motion.div>

      <Spacer y={8} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="relative z-10 w-full max-w-md xl:translate-x-[12.5%]"
      >
        {appliedReferral ? (
          <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <Icon
              icon="solar:verified-check-bold"
              className="text-green-500"
              width={20}
            />
            <span className="text-sm text-green-500 font-medium">
              Referral code applied: {appliedReferral}
            </span>
            <button
              onClick={handleRemoveReferral}
              className="text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <Icon icon="solar:close-circle-bold" width={18} />
            </button>
          </div>
        ) : showReferralInput ? (
          <div className="flex flex-col sm:flex-row items-stretch gap-2 p-3 rounded-lg bg-surface-base border border-border-base">
            <Input
              placeholder="Enter referral code"
              value={referralCode}
              onValueChange={setReferralCode}
              size="sm"
              classNames={{
                input: "bg-surface-elevated text-text-primary",
                inputWrapper:
                  "bg-surface-elevated border-border-base hover:border-border-light",
              }}
              startContent={
                <Icon
                  icon="solar:ticket-bold-duotone"
                  className="text-text-tertiary"
                  width={16}
                />
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplyReferral();
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-accent-400 text-white font-medium"
                onPress={handleApplyReferral}
                isLoading={isApplyingCode}
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="flat"
                className="text-text-secondary"
                onPress={() => {
                  setShowReferralInput(false);
                  setReferralCode("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowReferralInput(true)}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 hover:border-amber-500/50 hover:from-amber-500/20 hover:via-orange-500/20 hover:to-amber-500/20 transition-all group"
          >
            <div className="p-2 rounded-lg bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors">
              <Icon
                icon="solar:gift-bold-duotone"
                className="text-amber-500"
                width={20}
              />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-amber-500">
                Have a referral or affiliate code?
              </p>
            </div>
            <Icon
              icon="solar:arrow-right-bold"
              className="text-amber-500/50 group-hover:text-amber-500 transition-colors"
              width={16}
            />
          </button>
        )}
      </motion.div>

      <Spacer y={8} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:hidden items-stretch"
      >
        {tiers.map((tier) => (
          <PricingTierCard
            key={tier.key}
            tier={tier}
            isDisabled={isButtonDisabled(tier)}
            isLoading={loadingTier === tier.key}
            buttonText={getButtonText(tier)}
            onUpgrade={() => handleUpgrade(tier)}
          />
        ))}
      </motion.div>

      <PricingTable
        tiers={tiers}
        features={features}
        loadingTier={loadingTier}
        isButtonDisabled={isButtonDisabled}
        getButtonText={getButtonText}
        onUpgrade={handleUpgrade}
      />

      <Spacer y={12} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="relative z-10 flex py-2"
      >
        <p className="text-text-tertiary">
          Questions about pricing?{" "}
          <Link
            className="text-accent-400 hover:text-accent-300"
            href="mailto:support@cuttr.com"
            underline="always"
          >
            Contact us
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}

function PricingFallback() {
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

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingFallback />}>
      <PricingContent />
    </Suspense>
  );
}
