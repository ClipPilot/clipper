"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { Button, Chip, Divider, Tooltip, cn } from "@heroui/react";
import { Tier, TiersEnum } from "./pricing-types";
import { PricingFeatures } from "./pricing-comparison-types";

interface PricingTableProps {
  tiers: Tier[];
  features: PricingFeatures;
  loadingTier: string | null;
  isButtonDisabled: (tier: Tier) => boolean;
  getButtonText: (tier: Tier) => string;
  onUpgrade: (tier: Tier) => void;
}

export function PricingTable({
  tiers,
  features,
  loadingTier,
  isButtonDisabled,
  getButtonText,
  onUpgrade,
}: PricingTableProps) {
  return (
    <div className="relative z-10 hidden w-full xl:block">
      <div className="relative">
        {tiers.some((tier) => tier.mostPopular) && (
          <div className="absolute inset-x-4 inset-y-0 z-[-1] flex">
            <div
              aria-hidden="true"
              className="flex px-1"
              style={{
                width: `${100 / (tiers.length + 1)}%`,
                marginLeft: `${
                  ((tiers.findIndex((tier) => tier.mostPopular) + 1) * 100) /
                  (tiers.length + 1)
                }%`,
              }}
            >
              <div className="w-full rounded-xl border border-accent-400/30 bg-accent-400/5 backdrop-blur-md" />
            </div>
          </div>
        )}

        <table className="w-full table-fixed border-separate border-spacing-x-4 text-left">
          <caption className="sr-only">Pricing plan comparison</caption>
          <colgroup>
            {Array.from({ length: tiers.length + 1 }).map((_, index) => (
              <col key={index} className={`w-1/${tiers.length + 1}`} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <td />
              {tiers.map((tier) => (
                <th
                  key={tier.key}
                  className="relative px-6 pt-6 xl:px-8 xl:pt-8"
                  scope="col"
                >
                  {tier.mostPopular && (
                    <Chip
                      classNames={{
                        base: "absolute top-2 right-2 bg-accent-400",
                        content: "text-white text-xs font-semibold",
                      }}
                      size="sm"
                    >
                      Most Popular
                    </Chip>
                  )}
                  <div className="text-xl font-semibold text-text-primary">
                    {tier.title}
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {tier.description}
                  </p>
                </th>
              ))}
            </tr>
            <tr>
              <th scope="row">
                <span className="sr-only">Price</span>
              </th>
              {tiers.map((tier) => (
                <td key={tier.key} className="relative px-6 py-4 xl:px-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-text-primary">
                      {tier.price}
                    </span>
                    {tier.priceSuffix && (
                      <span className="text-sm text-text-tertiary">
                        /{tier.priceSuffix}
                      </span>
                    )}
                  </div>
                  {tier.billedAmount && (
                    <p className="text-sm font-medium text-text-secondary mt-1">{tier.billedAmount}</p>
                  )}

                  <div className="mt-3 flex flex-col gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Icon
                        className="text-accent-400"
                        icon="solar:magic-stick-3-bold"
                        width={16}
                      />
                      <span className="text-text-secondary">
                        {tier.generations}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon
                        className="text-accent-400"
                        icon="solar:bookmark-bold"
                        width={16}
                      />
                      <span className="text-text-secondary">
                        {tier.savedClips}
                      </span>
                    </div>
                  </div>

                  <Button
                    fullWidth
                    className={cn("mt-6", {
                      "bg-accent-400 text-white font-semibold shadow-lg shadow-accent-400/25":
                        tier.mostPopular && !isButtonDisabled(tier),
                    })}
                    color={
                      tier.mostPopular && !isButtonDisabled(tier)
                        ? "primary"
                        : "default"
                    }
                    variant={isButtonDisabled(tier) ? "flat" : tier.buttonVariant}
                    isDisabled={isButtonDisabled(tier)}
                    isLoading={loadingTier === tier.key}
                    onPress={() => onUpgrade(tier)}
                  >
                    {getButtonText(tier)}
                  </Button>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feat, featIndex) => (
              <React.Fragment key={feat.title}>
                <tr>
                  <th
                    className={cn(
                      "pt-12 pb-4 text-lg font-semibold text-text-primary",
                      {
                        "pt-16": featIndex === 0,
                      }
                    )}
                    colSpan={1}
                    scope="colgroup"
                  >
                    {feat.title}
                    <Divider className="absolute -inset-x-4 mt-2 bg-border-base/50" />
                  </th>
                  {tiers.map((tier) => (
                    <td key={tier.key} className="relative py-4" />
                  ))}
                </tr>
                {feat.items.map((tierFeature) => (
                  <tr key={tierFeature.title}>
                    <th
                      className="py-4 text-sm font-normal text-text-secondary"
                      scope="row"
                    >
                      {tierFeature.helpText ? (
                        <div className="flex items-center gap-1">
                          <span>{tierFeature.title}</span>
                          <Tooltip
                            className="max-w-[240px] bg-surface-elevated text-text-primary"
                            content={tierFeature.helpText}
                            placement="right"
                          >
                            <span className="cursor-help">
                              <Icon
                                className="text-text-tertiary"
                                icon="solar:info-circle-line-duotone"
                                width={18}
                              />
                            </span>
                          </Tooltip>
                        </div>
                      ) : (
                        tierFeature.title
                      )}
                    </th>

                    {tiers.map((tier) => {
                      const value = tierFeature.tiers[tier.key];
                      return (
                        <td
                          key={tier.key}
                          className="relative px-6 py-4 xl:px-8"
                        >
                          {typeof value === "string" ? (
                            <div className="text-center text-sm text-text-secondary">
                              {value}
                            </div>
                          ) : (
                            <>
                              {value === true ? (
                                <Icon
                                  className="mx-auto text-green-500"
                                  icon="solar:check-circle-bold"
                                  width={22}
                                />
                              ) : (
                                <Icon
                                  className="mx-auto text-red-500/70"
                                  icon="solar:close-circle-bold"
                                  width={22}
                                />
                              )}
                              <span className="sr-only">
                                {value === true ? "Included" : "Not included"}
                                &nbsp;in&nbsp;{tier.title}
                              </span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
