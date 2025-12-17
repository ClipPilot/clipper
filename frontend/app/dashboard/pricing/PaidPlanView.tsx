"use client";

import React from "react";
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
  cn,
} from "@heroui/react";

interface UsageStats {
  clipsCreated: number;
  limit: number;
  remaining: number;
}

interface PaidPlanViewProps {
  currentPlan: "studio" | "scale";
  teamName?: string;
  usageStats?: UsageStats;
  loadingPortal: boolean;
  loadingAddon: boolean;
  onManageSubscription: () => void;
  onBuyAddon: () => void;
}

export function PaidPlanView({
  currentPlan,
  teamName,
  usageStats,
  loadingPortal,
  loadingAddon,
  onManageSubscription,
  onBuyAddon,
}: PaidPlanViewProps) {
  const usagePercentage = usageStats
    ? (usageStats.clipsCreated / usageStats.limit) * 100
    : 0;

  const isScale = currentPlan === "scale";
  const planColor = isScale ? "purple" : "primary";
  const colorClass = isScale ? "purple-500" : "accent-400";

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
                    isScale ? "bg-purple-500/20" : "bg-accent-400/20"
                  )}
                >
                  <Icon
                    icon="solar:verified-check-bold"
                    className={isScale ? "text-purple-500" : "text-accent-400"}
                    width={28}
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">
                    {isScale ? "Scale" : "Studio"} Plan
                  </h2>
                  <p className="text-sm text-text-secondary">{teamName}</p>
                </div>
              </div>
              <Chip
                color="primary"
                variant="flat"
                size="lg"
                classNames={{
                  base: isScale ? "bg-purple-500/20" : "",
                  content: isScale
                    ? "text-purple-500 font-semibold"
                    : "font-semibold",
                }}
              >
                Active
              </Chip>
            </div>
          </CardHeader>
          <Divider className="my-4" />
          <CardBody className="gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  {usageStats?.limit || 0} clips
                </span>
              </div>
              <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-dark/50">
                <span className="text-xs text-text-tertiary uppercase tracking-wider">
                  Remaining
                </span>
                <span className="text-lg font-semibold text-text-primary">
                  {usageStats?.remaining || 0} clips
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Usage this period</span>
                <span className="text-text-primary font-medium">
                  {usageStats?.clipsCreated || 0} / {usageStats?.limit || 0}
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
          <CardFooter>
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
          </CardFooter>
        </Card>

        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold text-text-primary">
              Need more clips?
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Purchase additional clip packs to increase your monthly limit
            </p>
          </div>

          <Card
            className={cn(
              "bg-surface-elevated/80 backdrop-blur-md max-w-md mx-auto",
              isScale
                ? "border border-purple-500/30"
                : "border border-border-base"
            )}
          >
            <CardBody className="gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-lg",
                    isScale ? "bg-purple-500/20" : "bg-accent-400/20"
                  )}
                >
                  <Icon
                    icon="solar:add-circle-bold"
                    className={isScale ? "text-purple-500" : "text-accent-400"}
                    width={28}
                  />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-text-primary">
                    +{isScale ? "100" : "50"} Clips
                  </h4>
                  <p className="text-sm text-text-tertiary">
                    {isScale ? "Scale" : "Studio"} Pack
                  </p>
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-text-primary">
                    ${isScale ? "8.99" : "16.99"}
                  </span>
                  <span className="text-sm text-text-tertiary">/per clip</span>
                </div>
                <p className="text-xs text-text-tertiary mt-1">
                  ${isScale ? "899" : "849.50"} one time purchase
                </p>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-warning-500/10 border border-warning-500/20">
                <Icon
                  icon="solar:clock-circle-bold"
                  className="text-warning-500"
                  width={16}
                />
                <p className="text-xs text-warning-500">
                  Clips expire at end of billing period
                </p>
              </div>
            </CardBody>
            <CardFooter>
              <Button
                fullWidth
                size="lg"
                className={isScale ? "bg-purple-500 text-white" : ""}
                color={isScale ? "default" : "primary"}
                startContent={<Icon icon="solar:cart-bold" width={20} />}
                onPress={onBuyAddon}
                isLoading={loadingAddon}
              >
                Buy Now
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
