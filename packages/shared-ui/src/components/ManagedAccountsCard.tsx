"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatNumber } from "../lib/formatters";
import { platformIcon, platformIconColor } from "../lib/platformUtils";

export interface ManagedAccount {
  id: string;
  handle: string;
  platform: string;
  totalReposts: number;
}

export interface ManagedAccountsStats {
  totalAccounts: number;
  totalReposts: number;
  avgPostsPerAccount: number;
}

interface ManagedAccountsCardProps {
  accounts: ManagedAccount[];
  stats: ManagedAccountsStats;
  onView?: () => void;
}

export function ManagedAccountsCard({ accounts, stats, onView }: ManagedAccountsCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (accounts.length === 0) return null;

  const platforms = Array.from(new Set(accounts.map((a) => a.platform)));

  const metrics = [
    { label: "Total Posts", value: formatNumber(stats.totalReposts) },
    { label: "Accounts", value: formatNumber(stats.totalAccounts) },
    { label: "Avg. Posts/Acct", value: String(stats.avgPostsPerAccount) },
    { label: "Platforms", value: String(platforms.length) },
  ];

  return (
    <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
      <div className="p-4 flex flex-col gap-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 border-cyan-500 text-cyan-500 bg-cyan-500/10">
            <Icon icon="solar:server-bold-duotone" width={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">Cuttr Managed</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-text-tertiary">
                {stats.totalAccounts} account{stats.totalAccounts !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                {platforms.map((p) => (
                  <Icon key={p} icon={platformIcon(p)} width={11} className={platformIconColor(p)} />
                ))}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="tertiary"
            className="bg-cyan-500/10 text-cyan-500 text-[11px] h-7 min-w-0 px-2.5"
            onPress={() => onView?.()}
          >
            View
          </Button>
        </div>

        <motion.div
          initial={false}
          animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="grid grid-cols-2 gap-2 pt-3">
            {metrics.map((m) => (
              <div key={m.label} className="bg-surface-elevated rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-text-tertiary font-medium">{m.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-sm font-bold text-text-primary">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center pt-2 group cursor-pointer"
        >
          <div className="rounded-full p-1 transition-colors group-hover:bg-surface-elevated">
            <Icon
              icon="solar:alt-arrow-down-linear"
              width={16}
              className={cn(
                "text-text-tertiary transition-all group-hover:text-text-primary",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
