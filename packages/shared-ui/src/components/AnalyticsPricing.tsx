"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Link, cn } from "@heroui/react";
import { Icon } from "@iconify/react";

export interface AnalyticsTier {
  key: string;
  title: string;
  description: string;
  price: string;
  priceSuffix: string;
  accountLimit: string;
  features: string[];
  priceId: string;
  mostPopular?: boolean;
  buttonText: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: "What platforms do you track?",
    answer:
      "Cuttr analytics tracks Instagram, TikTok, and X (Twitter). You can monitor any public account across these platforms and receive synced performance data including views, likes, shares, and engagement rates.",
  },
  {
    question: "How often does data sync?",
    answer:
      "Both plans sync data every 12 hours. This keeps your competitor and trend data fresh without overwhelming the platform. For real-time monitoring needs, reach out about our enterprise options.",
  },
  {
    question: "What is the difference between Cuttr Pulse and Max?",
    answer:
      "Cuttr Pulse covers the essentials: track up to 50 profiles, competitor benchmarking, and viral alerts at $19/month. Max expands your limit to 250 profiles and adds hashtag and keyword tracking, making it ideal for agencies or brands running large-scale competitor research.",
  },
  {
    question: "Can I upgrade from Pulse to Max later?",
    answer:
      "Yes. You can switch plans at any time from the pricing page. When you upgrade, the change takes effect immediately and you are billed the prorated difference for the remainder of your billing period.",
  },
  {
    question: "Do analytics plans include clip credits?",
    answer:
      "No. Analytics plans are standalone add-ons focused purely on virality tracking. They do not include clip credits. If you need both, consider a main platform plan (Studio or Scale) which bundles clip credits with unlimited virality tracking.",
  },
  {
    question: "What happens if I hit my profile limit?",
    answer:
      "You will not be able to add new accounts to track until you either remove existing ones or upgrade to a higher tier. Your existing tracked profiles will continue syncing normally.",
  },
];

function FaqAccordionItem({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 * index }}
      className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] overflow-hidden"
    >
      <button
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-text-primary">
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 text-text-tertiary"
        >
          <Icon icon="solar:add-circle-bold" width={18} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              <div className="h-px w-full bg-white/[0.06] mb-4" />
              <p className="text-sm text-text-secondary leading-relaxed">
                {item.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export interface AnalyticsPricingProps {
  tiers: AnalyticsTier[];
  currentPlan?: string | null;
  currentPlanDisplayName?: string;
  hasMainPlan: boolean;
  isOnAnalytics: boolean;
  livePrices?: Record<string, { amount: number; currency: string }>;
  loadingTier: string | null;
  onCheckout: (tier: AnalyticsTier) => void;
  onNavigateToMainPricing: () => void;
  contactEmail?: string;
}

export function AnalyticsPricing({
  tiers,
  currentPlan,
  currentPlanDisplayName,
  hasMainPlan,
  isOnAnalytics,
  livePrices = {},
  loadingTier,
  onCheckout,
  onNavigateToMainPricing,
  contactEmail = "support@cuttr.com",
}: AnalyticsPricingProps) {
  const getButtonText = (tier: AnalyticsTier) => {
    if (currentPlan === tier.key) return "Current Plan";
    if (hasMainPlan) return "Included in your plan";
    if (isOnAnalytics) return "Switch Plan";
    return tier.buttonText;
  };

  const isButtonDisabled = (tier: AnalyticsTier) => {
    return currentPlan === tier.key || hasMainPlan;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-12 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full bg-amber-400/12 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-rose-500/20 blur-[140px]" />
        <div className="absolute bottom-0 left-1/4 h-[28rem] w-[28rem] rounded-full bg-accent-400/25 blur-[140px]" />
        <div className="absolute top-10 right-1/4 h-64 w-64 rounded-full bg-violet-500/15 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative z-10 flex max-w-xl flex-col text-center"
      >
        <h2 className="text-accent-400 text-sm font-medium uppercase tracking-wider">
          Analytics
        </h2>
        <div className="h-2" />
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Virality tracking plans
        </h1>
        <div className="h-4" />
        <p className="text-lg text-text-secondary">
          Track competitor performance and viral trends. No credit cost — just
          pick your plan.
        </p>
      </motion.div>

      <div className="h-8" />

      {hasMainPlan && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="relative z-10 w-full max-w-2xl"
        >
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <Icon
              icon="solar:verified-check-bold"
              className="text-green-500 flex-shrink-0"
              width={20}
            />
            <p className="text-sm text-green-500">
              Your{" "}
              <span className="font-semibold">{currentPlanDisplayName}</span>{" "}
              plan already includes unlimited virality tracking.
            </p>
          </div>
          <div className="h-6" />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="relative z-10 mx-auto grid max-w-2xl w-full grid-cols-1 gap-4 sm:grid-cols-2 items-stretch"
      >
        {tiers.map((tier, i) => {
          const isCurrent = currentPlan === tier.key;
          const disabled = isButtonDisabled(tier);

          return (
            <motion.div
              key={tier.key}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 + i * 0.08 }}
              whileHover={
                !disabled
                  ? {
                      scale: 1.015,
                      boxShadow: tier.mostPopular
                        ? "0 0 40px 0 rgba(var(--color-accent-400), 0.18)"
                        : "0 0 30px 0 rgba(255,255,255,0.04)",
                    }
                  : {}
              }
              className={cn(
                "rounded-2xl overflow-hidden flex flex-col border bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]",
                {
                  "border-accent-400/40 shadow-lg shadow-accent-400/10":
                    tier.mostPopular && !isCurrent,
                  "border-accent-400 shadow-lg shadow-accent-400/20": isCurrent,
                  "border-black/[0.08] dark:border-white/[0.08]":
                    !tier.mostPopular && !isCurrent,
                }
              )}
            >
              <div className="px-5 pt-5 min-h-[40px] flex items-start">
                {(tier.mostPopular || isCurrent) && (
                  <span
                    className={cn(
                      "inline-block px-2.5 py-1 rounded-full text-xs font-semibold",
                      isCurrent
                        ? "bg-accent-400/20 text-accent-400"
                        : "bg-accent-400 text-white"
                    )}
                  >
                    {isCurrent ? "Current Plan" : "Most Popular"}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-start gap-2 px-5 pt-3 pb-5">
                <h2 className="text-xl font-semibold text-text-primary">
                  {tier.title}
                </h2>
                <p className="text-sm text-text-secondary">{tier.description}</p>
              </div>

              <div className="mx-5 h-px bg-black/[0.08] dark:bg-white/[0.06]" />

              <div className="p-5 space-y-5 flex-1">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-text-primary">
                      {livePrices[tier.priceId]
                        ? formatPrice(livePrices[tier.priceId].amount, livePrices[tier.priceId].currency)
                        : tier.price}
                    </span>
                    <span className="text-sm text-text-tertiary">
                      /{tier.priceSuffix}
                    </span>
                  </div>
                </div>

                <div className="bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] flex flex-col gap-2 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-tertiary">
                      Account Limit
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {tier.accountLimit}
                    </span>
                  </div>
                </div>

                <ul className="flex flex-col gap-2">
                  {tier.features.map((feature) => (
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
              </div>

              <div className="p-5 pt-0">
                <Button
                  fullWidth
                  className={cn({
                    "bg-accent-400 text-white font-semibold":
                      tier.mostPopular && !disabled,
                  })}
                  variant={disabled ? "tertiary" : tier.mostPopular ? undefined : "outline"}
                  isDisabled={disabled}
                  isPending={loadingTier === tier.key}
                  onPress={() => onCheckout(tier)}
                >
                  {getButtonText(tier)}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="h-16" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <h3 className="text-lg font-semibold text-text-primary text-center mb-6">
          Frequently asked questions
        </h3>
        <div className="flex flex-col gap-2">
          {faqs.map((item, i) => (
            <FaqAccordionItem key={item.question} item={item} index={i} />
          ))}
        </div>
      </motion.div>

      <div className="h-12" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="relative z-10 flex flex-col items-center gap-4"
      >
        <p className="text-text-tertiary">
          Questions about pricing?{" "}
          <Link
            className="text-accent-400 hover:text-accent-300 underline"
            href={`mailto:${contactEmail}`}
          >
            Contact us
          </Link>
        </p>
        <button
          className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
          onClick={onNavigateToMainPricing}
        >
          Looking for clips & editing plans &rarr;
        </button>
      </motion.div>
    </motion.div>
  );
}
