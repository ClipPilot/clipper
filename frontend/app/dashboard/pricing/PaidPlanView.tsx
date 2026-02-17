"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  Divider,
  Progress,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Link,
  cn,
} from "@heroui/react";

interface UsageStats {
  clipsCreated: number;
  baseLimit: number;
  baseRemaining: number;
  addonRemaining: number;
  totalRemaining: number;
  // Legacy fields
  limit: number;
  remaining: number;
}

interface PaidPlanViewProps {
  currentPlan: "creator" | "studio" | "scale" | "enterprise";
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
  // Only allow upgrades, not downgrades
  const canChangePlan = isOwner && (isCreator || isStudio) && onChangePlan;
  const targetPlan: "studio" | "scale" = isCreator ? "studio" : "scale";

  const handleChangePlan = async () => {
    if (!onChangePlan) return;

    const result = await onChangePlan(targetPlan);
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

  const getColorClass = () => {
    if (isEnterprise) return "emerald-500";
    if (isScale) return "purple-500";
    if (isCreator) return "orange-500";
    return "accent-400";
  };

  const getTargetPlanDetails = () => {
    if (isCreator) {
      return {
        name: "Studio",
        color: "accent-400",
        credits: "400 credits/month",
        extra1: "Virality Tracker",
        extra2: "Priority support",
      };
    }
    return {
      name: "Scale",
      color: "purple-500",
      credits: "1,000 credits/month",
      extra1: "Team seats included",
      extra2: "Folder management",
    };
  };

  const getCurrentPlanDetails = () => {
    if (isCreator) {
      return {
        credits: "75 credits/month",
        extra1: "Single seat",
        extra2: "No virality tracking",
      };
    }
    return {
      credits: "400 credits/month",
      extra1: "Single seat",
      extra2: "No folders",
    };
  };

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
        <Card className="bg-surface-elevated/80 border border-border-base backdrop-blur-md">
          <CardHeader className="flex flex-col gap-1 pb-0">
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
                color="primary"
                variant="flat"
                size="lg"
                classNames={{
                  base: isEnterprise
                    ? "bg-emerald-500/20"
                    : isScale
                      ? "bg-purple-500/20"
                      : isCreator
                        ? "bg-orange-500/20"
                        : "",
                  content: cn(
                    "font-semibold",
                    isEnterprise
                      ? "text-emerald-500"
                      : isScale
                        ? "text-purple-500"
                        : isCreator
                          ? "text-orange-500"
                          : ""
                  ),
                }}
              >
                {isEnterprise ? "Managed" : "Active"}
              </Chip>
            </div>
          </CardHeader>
          <Divider className="my-4" />
          <CardBody className="gap-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-dark/50">
                <span className="text-xs text-text-tertiary uppercase tracking-wider">
                  Plan
                </span>
                <span className="text-lg font-semibold text-text-primary capitalize">
                  {currentPlan}
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
              <Progress
                value={usagePercentage}
                color={
                  usagePercentage >= 100
                    ? "danger"
                    : usagePercentage >= 75
                      ? "warning"
                      : "primary"
                }
                size="md"
                classNames={{
                  indicator: "transition-all",
                }}
              />
            </div>
          </CardBody>
          <Divider />
          <CardFooter className="flex-col gap-3 items-stretch">
            {pendingEffectiveDate && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Icon icon="solar:clock-circle-bold" className="text-amber-500" width={18} />
                <p className="text-sm text-amber-500">
                  Your plan will change to <span className="font-semibold capitalize">{targetPlan}</span> on{" "}
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
                  variant="flat"
                  color="default"
                  startContent={
                    <Icon icon="solar:settings-bold-duotone" width={20} />
                  }
                  onPress={onManageSubscription}
                  isLoading={loadingPortal}
                  className="text-text-secondary"
                >
                  Manage Subscription
                </Button>
              )}
              {canChangePlan && !pendingEffectiveDate && (
                <Button
                  variant="flat"
                  color="default"
                  startContent={
                    <Icon icon="solar:arrow-up-bold-duotone" width={20} />
                  }
                  onPress={() => setIsChangePlanModalOpen(true)}
                  className="text-text-secondary"
                >
                  Upgrade Plan
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* Addon credits section — hidden for now
        {!isEnterprise && (
          <div className="space-y-4">
            ...
          </div>
        )}
        */}

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

      {/* Upgrade Plan Modal */}
      <Modal
        isOpen={isChangePlanModalOpen}
        onClose={() => setIsChangePlanModalOpen(false)}
        size="lg"
      >
        <ModalContent className="bg-surface-base border border-border-accent">
          <ModalHeader className="pb-0">
            <h3 className="text-xl font-bold text-text-primary">Upgrade Your Plan</h3>
          </ModalHeader>
          <ModalBody className="py-6">
            <div className="space-y-6">
              {/* Plan Comparison Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Current Plan */}
                <div className="p-4 rounded-xl bg-surface-dark/30 border border-border-base">
                  <p className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Current</p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isCreator ? "bg-orange-500/20" : "bg-accent-400/20")}>
                      <Icon icon="solar:star-bold" className={isCreator ? "text-orange-500" : "text-accent-400"} width={16} />
                    </div>
                    <span className="text-lg font-semibold text-text-primary">{getPlanDisplayName()}</span>
                  </div>
                  <div className="space-y-1 text-sm text-text-secondary">
                    <p>{getCurrentPlanDetails().credits}</p>
                    <p>{getCurrentPlanDetails().extra1}</p>
                    <p>{getCurrentPlanDetails().extra2}</p>
                  </div>
                </div>

                {/* Target Plan */}
                <div className={cn(
                  "p-4 rounded-xl border-2",
                  isCreator
                    ? "bg-accent-400/5 border-accent-400/30"
                    : "bg-purple-500/5 border-purple-500/30"
                )}>
                  <p className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Upgrade to</p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      isCreator ? "bg-accent-400/20" : "bg-purple-500/20"
                    )}>
                      <Icon icon="solar:star-bold" className={isCreator ? "text-accent-400" : "text-purple-500"} width={16} />
                    </div>
                    <span className={cn("text-lg font-semibold", isCreator ? "text-accent-400" : "text-purple-500")}>{getTargetPlanDetails().name}</span>
                  </div>
                  <div className="space-y-1 text-sm text-text-secondary">
                    <p>{getTargetPlanDetails().credits}</p>
                    <p>{getTargetPlanDetails().extra1}</p>
                    <p>{getTargetPlanDetails().extra2}</p>
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-dark/50">
                <Icon icon="solar:clock-circle-bold" className="text-text-tertiary flex-shrink-0" width={20} />
                <p className="text-sm text-text-secondary">
                  Changes take effect at your <span className="text-text-primary font-medium">next billing cycle</span>.
                  You'll keep your current plan until then.
                </p>
              </div>

              {/* Divider */}
              <Divider className="bg-border-base" />

              {/* Contact Links */}
              <div className="flex flex-col sm:flex-row gap-4 text-sm">
                <Link
                  href="https://cuttr.com/contact"
                  target="_blank"
                  className="flex items-center gap-2 text-accent-400/80 hover:text-accent-400 transition-colors"
                >
                  <Icon icon="solar:letter-bold" width={16} />
                  <span>Need it immediately? Contact support</span>
                </Link>
                <Link
                  href="https://cuttr.com/contact"
                  target="_blank"
                  className="flex items-center gap-2 text-emerald-500/80 hover:text-emerald-400 transition-colors"
                >
                  <Icon icon="solar:buildings-bold" width={16} />
                  <span>Looking for Enterprise?</span>
                </Link>
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="border-t border-border-base pt-4">
            <Button
              variant="light"
              onPress={() => setIsChangePlanModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className={cn("font-semibold text-white", isCreator ? "bg-accent-400" : "bg-purple-500")}
              onPress={handleChangePlan}
              isLoading={loadingChangePlan}
              startContent={!loadingChangePlan && <Icon icon="solar:check-circle-bold" width={18} />}
            >
              Upgrade to {getTargetPlanDetails().name}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
