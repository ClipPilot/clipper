"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { Button,
  Chip,
  Separator,
  ProgressBar,
  Modal,
  Link,
  cn } from "@heroui/react";
import { getPlanName, isAnalyticsPlan, getViralityAccountLimit } from "@/lib/plans";
import { useRouter } from "next/navigation";
import { STRIPE_PRICES } from "@/config/stripe.constants";

interface UsageStats {
  clipsCreated: number;
  baseLimit: number;
  baseRemaining: number;
  addonRemaining: number;
  totalRemaining: number;
  limit: number;
  remaining: number;
}

interface PaidPlanViewProps {
  currentPlan: "creator" | "studio" | "scale" | "enterprise" | "analytics_starter" | "analytics_pro" | "analytics_business";
  teamName?: string;
  teamId?: number;
  isOwner?: boolean;
  usageStats?: UsageStats;
  loadingPortal: boolean;
  loadingAddon: boolean;
  loadingChangePlan?: boolean;
  onManageSubscription: () => void;
  onBuyAddon: () => void;
  onChangePlan?: (newPlan: "creator" | "studio" | "scale") => Promise<{ effectiveDate: string } | void>;
}

export function PaidPlanView({
  currentPlan,
  teamName,
  teamId,
  isOwner = false,
  usageStats,
  loadingPortal,
  loadingAddon,
  loadingChangePlan = false,
  onManageSubscription,
  onBuyAddon,
  onChangePlan,
}: PaidPlanViewProps) {
  const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false);
  const [pendingEffectiveDate, setPendingEffectiveDate] = useState<string | null>(null);

  const usagePercentage = usageStats
    ? (usageStats.clipsCreated / usageStats.baseLimit) * 100
    : 0;

  const isEnterprise = currentPlan === "enterprise";
  const isScale = currentPlan === "scale";
  const isStudio = currentPlan === "studio";
  const isCreator = currentPlan === "creator";
  const canChangePlan = isOwner && (isCreator || isStudio || isScale) && !isEnterprise;

  type UpgradeTarget = "creator" | "studio" | "scale" | "enterprise";
  const availableUpgrades: UpgradeTarget[] = isCreator
    ? ["studio", "scale"]
    : isStudio
      ? ["scale"]
      : isScale
        ? ["enterprise"]
        : [];

  const [selectedTarget, setSelectedTarget] = useState<UpgradeTarget>(availableUpgrades[0] || "studio");

  const handleChangePlan = async () => {
    if (selectedTarget === "enterprise") {
      window.open("https://cuttr.com/contact", "_blank");
      setIsChangePlanModalOpen(false);
      return;
    }
    if (!onChangePlan) return;

    const result = await onChangePlan(selectedTarget as "creator" | "studio" | "scale");
    if (result?.effectiveDate) {
      setPendingEffectiveDate(result.effectiveDate);
    }
    setIsChangePlanModalOpen(false);
  };

  const getPlanDisplayName = () => {
    switch (currentPlan) {
      case "enterprise":
        return "Enterprise";
      case "scale":
        return "Scale";
      case "studio":
        return "Studio";
      case "creator":
        return "Creator";
      default:
        return "Creator";
    }
  };

  const upgradeDetails: Record<UpgradeTarget, {
    name: string;
    credits: string;
    extras: string[];
    iconBg: string;
    iconText: string;
    selectedBg: string;
    selectedBorder: string;
    selectedText: string;
    btnBg: string;
  }> = {
    creator: {
      name: "Creator", credits: "75 credits/month", extras: ["UGC Studio access", "AI Clipping"],
      iconBg: "bg-orange-500/20", iconText: "text-orange-500",
      selectedBg: "bg-orange-500/5", selectedBorder: "border-orange-500/30", selectedText: "text-orange-500",
      btnBg: "bg-orange-500",
    },
    studio: {
      name: "Studio", credits: "400 credits/month", extras: ["Virality Tracker", "Priority support"],
      iconBg: "bg-accent-400/20", iconText: "text-accent-400",
      selectedBg: "bg-accent-400/5", selectedBorder: "border-accent-400/30", selectedText: "text-accent-400",
      btnBg: "bg-accent-400",
    },
    scale: {
      name: "Scale", credits: "1,000 credits/month", extras: ["Team seats included", "Folder management"],
      iconBg: "bg-purple-500/20", iconText: "text-purple-500",
      selectedBg: "bg-purple-500/5", selectedBorder: "border-purple-500/30", selectedText: "text-purple-500",
      btnBg: "bg-purple-500",
    },
    enterprise: {
      name: "Enterprise", credits: "Custom credits", extras: ["Dedicated support", "Custom integrations"],
      iconBg: "bg-emerald-500/20", iconText: "text-emerald-500",
      selectedBg: "bg-emerald-500/5", selectedBorder: "border-emerald-500/30", selectedText: "text-emerald-500",
      btnBg: "bg-emerald-500",
    },
  };

  const getCurrentPlanDetails = () => {
    switch (currentPlan) {
      case "creator":
        return { credits: "75 credits/month" };
      case "studio":
        return { credits: "400 credits/month" };
      case "scale":
        return { credits: "1,000 credits/month" };
      default:
        return { credits: "75 credits/month" };
    }
  };

  const router = useRouter();

  if (isAnalyticsPlan(currentPlan)) {
    const accountLimit = getViralityAccountLimit(currentPlan);
    return (
      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-12 lg:py-16">
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

        <div className="relative z-10 w-full space-y-8">
          <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
            <div className="flex flex-col gap-1 p-6 pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", "bg-accent-400/20")}>
                    <Icon icon="solar:chart-bold-duotone" className="text-accent-400" width={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-primary">
                      {getPlanName(currentPlan)}
                    </h2>
                    <p className="text-sm text-text-secondary">{teamName}</p>
                  </div>
                </div>
                <Chip
                  variant="tertiary"
                  size="lg"
                  className="bg-accent-400/10 text-accent-400"
                >
                  Active
                </Chip>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="p-6 pt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-dark/50">
                  <span className="text-xs text-text-tertiary uppercase tracking-wider">
                    Plan
                  </span>
                  <span className="text-lg font-semibold text-text-primary">
                    {getPlanName(currentPlan)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-dark/50">
                  <span className="text-xs text-text-tertiary uppercase tracking-wider">
                    Account Limit
                  </span>
                  <span className="text-lg font-semibold text-text-primary">
                    {accountLimit === -1 ? "Unlimited" : `${accountLimit} profiles`}
                  </span>
                </div>
              </div>
            </div>
            <Separator />
            <div className="p-6 flex flex-col gap-3">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="tertiary"
                  onPress={onManageSubscription}
                  isPending={loadingPortal}
                  className="text-text-secondary"
                >
                  <Icon icon="solar:settings-bold-duotone" width={20} />
                  Manage Subscription
                </Button>
                <Button
                  variant="tertiary"
                  onPress={() => router.push("/dashboard/pricing/analytics")}
                  className="text-text-secondary"
                >
                  <Icon icon="solar:arrow-up-bold-duotone" width={20} />
                  Change Analytics Plan
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text-primary">
              Need clips & editing tools?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  name: "Studio",
                  price: "$1,500/mo",
                  credits: "400 credits",
                  features: ["Unlimited virality tracking", "Advanced editing suite", "Priority support"],
                  priceId: STRIPE_PRICES.STUDIO,
                },
                {
                  name: "Scale",
                  price: "$2,990/mo",
                  credits: "1,000 credits",
                  features: ["Unlimited virality tracking", "Mass Posting", "Team seats", "API access"],
                  priceId: STRIPE_PRICES.SCALE,
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className="rounded-xl border border-border-base bg-surface-base p-5 space-y-4"
                >
                  <div>
                    <h4 className="text-lg font-semibold text-text-primary">{plan.name}</h4>
                    <p className="text-sm text-text-secondary">{plan.credits} &middot; {plan.price}</p>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" className="text-accent-400 flex-shrink-0" width={16} />
                        <span className="text-sm text-text-secondary">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    fullWidth
                    variant="outline"
                    className="text-text-secondary"
                    onPress={async () => {
                      if (!teamId) return;
                      const { stripeAPI } = await import("@/api/stripe");
                      const { url } = await stripeAPI.createCheckoutSession(teamId, plan.priceId);
                      window.open(url, "_blank");
                    }}
                  >
                    Upgrade to {plan.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-12 lg:py-16">
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

      <div className="relative z-10 w-full space-y-8">
        <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
          <div className="flex flex-col gap-1 p-6 pb-0">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl",
                    isEnterprise
                      ? "bg-emerald-500/20"
                      : isScale
                        ? "bg-purple-500/20"
                        : isCreator
                          ? "bg-orange-500/20"
                          : "bg-accent-400/20"
                  )}
                >
                  <Icon
                    icon="solar:verified-check-bold"
                    className={cn(
                      isEnterprise
                        ? "text-emerald-500"
                        : isScale
                          ? "text-purple-500"
                          : isCreator
                            ? "text-orange-500"
                            : "text-accent-400"
                    )}
                    width={28}
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">
                    {getPlanDisplayName()} Plan
                  </h2>
                  <p className="text-sm text-text-secondary">{teamName}</p>
                </div>
              </div>
              <Chip
                variant="tertiary"
                size="lg"
                className="bg-accent-400/10 text-accent-400"
              >
                {isEnterprise ? "Managed" : "Active"}
              </Chip>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="p-6 pt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-dark/50">
                <span className="text-xs text-text-tertiary uppercase tracking-wider">
                  Plan
                </span>
                <span className="text-lg font-semibold text-text-primary">
                  {getPlanName(currentPlan)}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-dark/50">
                <span className="text-xs text-text-tertiary uppercase tracking-wider">
                  Monthly Limit
                </span>
                <span className="text-lg font-semibold text-text-primary">
                  {usageStats?.baseLimit || 0} credits
                </span>
              </div>
              <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-dark/50">
                <span className="text-xs text-text-tertiary uppercase tracking-wider">
                  Bonus Credits
                </span>
                <span className="text-lg font-semibold text-green-500">
                  +{usageStats?.addonRemaining || 0}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-dark/50">
                <span className="text-xs text-text-tertiary uppercase tracking-wider">
                  Total Remaining
                </span>
                <span className="text-lg font-semibold text-text-primary">
                  {usageStats?.totalRemaining || 0} credits
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">
                  Plan usage this period
                </span>
                <span className="text-text-primary font-medium">
                  {usageStats?.clipsCreated || 0} / {usageStats?.baseLimit || 0}
                </span>
              </div>
              <ProgressBar
                value={usagePercentage}
              >
                <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
              </ProgressBar>
            </div>
          </div>
          <Separator />
          <div className="p-6 flex flex-col gap-3">
            {pendingEffectiveDate && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Icon icon="solar:clock-circle-bold" className="text-amber-500" width={18} />
                <p className="text-sm text-amber-500">
                  Your plan will change to <span className="font-semibold capitalize">{selectedTarget}</span> on{" "}
                  {new Date(pendingEffectiveDate).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {currentPlan !== "enterprise" && (
                <Button
                  variant="tertiary"
                  onPress={onManageSubscription}
                  isPending={loadingPortal}
                  className="text-text-secondary"
                >
                  <Icon icon="solar:settings-bold-duotone" width={20} />
                  Manage Subscription
                </Button>
              )}
              {canChangePlan && !pendingEffectiveDate && availableUpgrades.length > 0 && (
                <Button
                  variant="tertiary"
                  onPress={() => setIsChangePlanModalOpen(true)}
                  className="text-text-secondary"
                >
                  <Icon icon="solar:arrow-up-bold-duotone" width={20} />
                  Upgrade Plan
                </Button>
              )}
            </div>
          </div>
        </div>

        {isEnterprise && (
          <div className="text-center space-y-2">
            <p className="text-text-secondary">
              Your enterprise plan is managed by your account administrator.
            </p>
            <p className="text-sm text-text-tertiary">
              Contact support@cuttr.com for billing inquiries.
            </p>
          </div>
        )}
      </div>

      <Modal>
        <Modal.Backdrop isOpen={isChangePlanModalOpen} onOpenChange={() => setIsChangePlanModalOpen(false)}><Modal.Container><Modal.Dialog className="sm:max-w-2xl bg-surface-base border border-border-accent">
          <Modal.Header className="pb-0">
            <h3 className="text-xl font-bold text-text-primary">Upgrade Your Plan</h3>
          </Modal.Header>
          <Modal.Body className="py-6">
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-surface-dark/30 border border-border-base">
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Current</p>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", upgradeDetails[currentPlan].iconBg)}>
                    <Icon icon="solar:star-bold" className={upgradeDetails[currentPlan].iconText} width={16} />
                  </div>
                  <span className="text-lg font-semibold text-text-primary">{getPlanDisplayName()}</span>
                </div>
                <p className="text-sm text-text-secondary">{getCurrentPlanDetails().credits}</p>
              </div>

              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-3">Upgrade to</p>
                <div className={cn("grid gap-3", availableUpgrades.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                  {availableUpgrades.map((plan) => {
                    const details = upgradeDetails[plan];
                    const isSelected = selectedTarget === plan;
                    return (
                      <div
                        key={plan}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedTarget(plan)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedTarget(plan); }}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all cursor-pointer",
                          isSelected
                            ? cn(details.selectedBg, details.selectedBorder)
                            : "bg-surface-dark/30 border-border-base hover:border-border-light"
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", details.iconBg)}>
                              <Icon icon="solar:star-bold" className={details.iconText} width={16} />
                            </div>
                            <span className={cn("text-lg font-semibold", isSelected ? details.selectedText : "text-text-primary")}>
                              {details.name}
                            </span>
                          </div>
                          {isSelected && (
                            <Icon icon="solar:check-circle-bold" className={details.iconText} width={20} />
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-text-secondary">
                          <p>{details.credits}</p>
                          {details.extras.map((extra) => (
                            <p key={extra}>{extra}</p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedTarget !== "enterprise" && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-dark/50">
                  <Icon icon="solar:clock-circle-bold" className="text-text-tertiary flex-shrink-0" width={20} />
                  <p className="text-sm text-text-secondary">
                    Changes take effect at your <span className="text-text-primary font-medium">next billing cycle</span>.
                    You'll keep your current plan until then.
                  </p>
                </div>
              )}

              <Separator className="bg-border-base" />

              <div className="flex flex-col sm:flex-row gap-4 text-sm">
                <Link
                  href="https://cuttr.com/contact"
                  target="_blank"
                  className="flex items-center gap-2 text-accent-400/80 hover:text-accent-400 transition-colors"
                >
                  <Icon icon="solar:letter-bold" width={16} />
                  <span>Need it immediately? Contact support</span>
                </Link>
                {selectedTarget !== "enterprise" && (
                  <Link
                    href="https://cuttr.com/contact"
                    target="_blank"
                    className="flex items-center gap-2 text-emerald-500/80 hover:text-emerald-400 transition-colors"
                  >
                    <Icon icon="solar:buildings-bold" width={16} />
                    <span>Looking for Enterprise?</span>
                  </Link>
                )}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="tertiary"
              onPress={() => setIsChangePlanModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className={cn("font-semibold text-white", upgradeDetails[selectedTarget].btnBg)}
              onPress={handleChangePlan}
              isPending={loadingChangePlan}
            >
              {!loadingChangePlan && <Icon icon={selectedTarget === "enterprise" ? "solar:buildings-bold" : "solar:check-circle-bold"} width={18} />}
              {selectedTarget === "enterprise" ? "Contact Sales" : `Upgrade to ${upgradeDetails[selectedTarget].name}`}
            </Button>
          </Modal.Footer>
        </Modal.Dialog></Modal.Container></Modal.Backdrop>
      </Modal>
    </div>
  );
}
