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
  cn,
} from "@heroui/react";
import { Tier } from "./pricing-types";

interface PricingTierCardProps {
  tier: Tier;
  isDisabled: boolean;
  isLoading: boolean;
  buttonText: string;
  onUpgrade: () => void;
}

export function PricingTierCard({
  tier,
  isDisabled,
  isLoading,
  buttonText,
  onUpgrade,
}: PricingTierCardProps) {
  return (
    <Card
      className={cn(
        "bg-surface-elevated/80 border border-border-base p-3 backdrop-blur-md h-full flex flex-col",
        {
          "border-accent-400/50 shadow-lg shadow-accent-400/10": tier.mostPopular,
        }
      )}
      shadow="none"
    >
      {tier.mostPopular && (
        <Chip
          classNames={{
            base: "absolute top-4 right-4 bg-accent-400",
            content: "text-white text-xs font-semibold",
          }}
          size="sm"
        >
          Most Popular
        </Chip>
      )}
      <CardHeader className="flex flex-col items-start gap-2 pb-6">
        <h2 className="text-xl font-semibold text-text-primary">{tier.title}</h2>
        <p className="text-sm text-text-secondary">{tier.description}</p>
      </CardHeader>
      <Divider className="bg-border-base" />
      <CardBody className="gap-6 flex-1">
        <div className="pt-2 min-h-[88px]">
          <div className="flex items-baseline gap-1 min-h-[48px]">
            <span className="text-4xl font-bold text-text-primary">
              {tier.price}
            </span>
            <span className="text-sm text-text-tertiary min-w-[70px]">
              {tier.priceSuffix ? `/${tier.priceSuffix}` : "\u00A0"}
            </span>
          </div>
          <p className="text-sm font-medium text-text-secondary mt-1 min-h-[20px]">
            {tier.billedAmount || "\u00A0"}
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-surface-dark/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-tertiary">Generations</span>
            <span className="text-sm font-medium text-text-primary">
              {tier.generations}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-tertiary">Credits</span>
            <span className="text-sm font-medium text-text-primary">
              {tier.credits}
            </span>
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {tier.features?.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Icon
                className="text-accent-400 flex-shrink-0"
                icon="solar:check-circle-bold"
                width={20}
              />
              <p className="text-sm text-text-secondary">{feature}</p>
            </li>
          ))}
        </ul>
      </CardBody>
      <CardFooter>
        <Button
          fullWidth
          className={cn({
            "bg-accent-400 text-white font-semibold":
              tier.mostPopular && !isDisabled,
          })}
          color={tier.mostPopular && !isDisabled ? "primary" : "default"}
          variant={isDisabled ? "flat" : tier.buttonVariant}
          isDisabled={isDisabled}
          isLoading={isLoading}
          onPress={onUpgrade}
        >
          {buttonText}
        </Button>
      </CardFooter>
    </Card>
  );
}
