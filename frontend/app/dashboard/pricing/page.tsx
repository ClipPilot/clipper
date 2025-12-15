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
  Link,
  Spacer,
  Tooltip,
} from "@heroui/react";
import { cn } from "@heroui/react";

import { tiers } from "./pricing-tiers";
import features from "./pricing-tiers-features";

export default function PricingPage() {
  return (
    <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-12 lg:py-24">
      {/* Background gradient */}
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

      {/* Header */}
      <div className="relative z-10 flex max-w-xl flex-col text-center">
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
      </div>

      <Spacer y={12} />

      {/* Subscription Tiers Grid - Mobile/Tablet */}
      <div className="relative z-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:hidden">
        {tiers.map((tier) => (
          <Card
            key={tier.key}
            className={cn(
              "bg-surface-elevated/80 border border-border-base p-3 backdrop-blur-md",
              {
                "border-accent-400/50 shadow-lg shadow-accent-400/10":
                  tier.mostPopular,
              }
            )}
            shadow="none"
          >
            {tier.mostPopular ? (
              <Chip
                classNames={{
                  base: "absolute top-4 right-4 bg-accent-400",
                  content: "text-white text-xs font-semibold",
                }}
                size="sm"
              >
                Most Popular
              </Chip>
            ) : null}
            <CardHeader className="flex flex-col items-start gap-2 pb-6">
              <h2 className="text-xl font-semibold text-text-primary">
                {tier.title}
              </h2>
              <p className="text-sm text-text-secondary">{tier.description}</p>
            </CardHeader>
            <Divider className="bg-border-base" />
            <CardBody className="gap-6">
              <div className="flex items-baseline gap-1 pt-2">
                <span className="text-4xl font-bold text-text-primary">
                  {tier.price}
                </span>
                {tier.priceSuffix && (
                  <span className="text-sm text-text-tertiary">
                    /{tier.priceSuffix}
                  </span>
                )}
              </div>

              {/* Generation & Clips info */}
              <div className="flex flex-col gap-2 rounded-lg bg-surface-dark/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">
                    Generations
                  </span>
                  <span className="text-sm font-medium text-text-primary">
                    {tier.generations}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">
                    Saved Clips
                  </span>
                  <span className="text-sm font-medium text-text-primary">
                    {tier.savedClips}
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
                  "bg-accent-400 text-white font-semibold": tier.mostPopular,
                })}
                color={tier.mostPopular ? "primary" : "default"}
                variant={tier.buttonVariant}
              >
                {tier.buttonText}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Subscription Tiers Table - Desktop */}
      <div className="relative z-10 hidden w-full xl:block">
        <div className="relative">
          {/* Highlight column for most popular */}
          {tiers.some((tier) => tier.mostPopular) ? (
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
          ) : null}

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
                    {tier.mostPopular ? (
                      <Chip
                        classNames={{
                          base: "absolute top-2 right-2 bg-accent-400",
                          content: "text-white text-xs font-semibold",
                        }}
                        size="sm"
                      >
                        Most Popular
                      </Chip>
                    ) : null}
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

                    {/* Generation & Clips info */}
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
                          tier.mostPopular,
                      })}
                      color={tier.mostPopular ? "primary" : "default"}
                      variant={tier.buttonVariant}
                    >
                      {tier.buttonText}
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
                                    className="mx-auto text-accent-400"
                                    icon="solar:check-circle-bold"
                                    width={22}
                                  />
                                ) : (
                                  <Icon
                                    className="mx-auto text-text-tertiary/60"
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

      <Spacer y={12} />

      {/* FAQ / Help Link */}
      <div className="relative z-10 flex py-2">
        <p className="text-text-tertiary">
          Questions about pricing?{" "}
          <Link
            className="text-accent-400 hover:text-accent-300"
            href="#"
            underline="always"
          >
            Contact us
          </Link>
        </p>
      </div>
    </div>
  );
}
