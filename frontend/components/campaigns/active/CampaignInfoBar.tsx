"use client";

import { Card, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { Campaign, CampaignWallet, CampaignCard } from "@/api/campaign";

interface CampaignInfoBarProps {
  campaign: Campaign;
  wallet: CampaignWallet | null;
  savedCard: CampaignCard | null;
  onChangeBilling?: () => void;
  onViewContract?: () => void;
}

export function CampaignInfoBar({
  campaign,
  wallet,
  savedCard,
  onChangeBilling,
  onViewContract,
}: CampaignInfoBarProps) {
  const balance = wallet ? (wallet.balance_cents / 100).toFixed(2) : "0.00";
  const cpm = campaign.quoted_cpm ? `$${parseFloat(campaign.quoted_cpm).toFixed(2)}` : "—";

  const cardLabel = savedCard
    ? `${(savedCard.brand ?? "Card").charAt(0).toUpperCase() + (savedCard.brand ?? "card").slice(1)} ••${savedCard.last4}`
    : "No card";

  const stats = [
    {
      title: "REMAINING BUDGET",
      value: `$${balance}`,
      icon: "solar:wallet-bold-duotone",
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-400/10",
    },
    {
      title: "AUTO RECHARGE",
      value: "ON",
      valueColor: "text-emerald-400",
      icon: "solar:refresh-circle-bold-duotone",
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-400/10",
    },
    {
      title: "CPM",
      value: cpm,
      icon: "solar:chart-bold-duotone",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
    },
    {
      title: "BILLING",
      value: cardLabel,
      icon: "solar:card-bold-duotone",
      iconColor: "text-blue-400",
      iconBg: "bg-blue-400/10",
      onClick: onChangeBilling,
      hint: "Change",
    },
    {
      title: "CONTRACT",
      value: "Signed",
      valueColor: "text-emerald-400",
      icon: "solar:check-circle-bold",
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-400/10",
      onClick: onViewContract,
      hint: "View",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <Card
 key={stat.title}
 className={cn(
 "bg-surface-base border border-border-base",
 stat.onClick && "cursor-pointer hover:border-accent-400/40 transition-colors",
 )}
 onPress={stat.onClick}
 >
          <Card.Content className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-text-tertiary font-medium tracking-wide">
                {stat.title}
              </p>
              {stat.hint && (
                <span className="text-[10px] text-accent-400 font-medium">
                  {stat.hint}
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-2">
              <p
                className={cn(
                  "text-xl font-bold truncate",
                  stat.valueColor || "text-text-accent"
                )}
              >
                {stat.value}
              </p>
              <div
                className={cn(
                  "w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center",
                  stat.iconBg
                )}
              >
                <Icon
                  icon={stat.icon}
                  width={18}
                  className={stat.iconColor}
                />
              </div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
