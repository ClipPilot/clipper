"use client";

import { useMemo } from "react";
import { Avatar } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ViralityAccount, ViralityPost } from "../lib/viralityTypes";
import { formatNumber } from "../lib/formatters";
import { platformIcon, platformIconColor } from "../lib/platformUtils";

interface BestPerformingAccountsProps {
  accounts: ViralityAccount[];
  postsByAccount: Record<number, ViralityPost[]>;
}

export function BestPerformingAccounts({
  accounts,
  postsByAccount,
}: BestPerformingAccountsProps) {
  const ranked = useMemo(() => {
    return accounts
      .map((account) => {
        const posts = postsByAccount[account.id] || [];
        const totalViews = posts.reduce(
          (sum, p) => sum + (p.video_play_count || 0),
          0
        );
        return { account, totalViews };
      })
      .sort((a, b) => b.totalViews - a.totalViews);
  }, [accounts, postsByAccount]);

  if (ranked.length === 0) {
    return (
      <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden h-full">
        <div className="p-5 h-full flex flex-col">
          <p className="text-xs text-text-tertiary font-medium tracking-wide mb-4">
            BEST PERFORMING ACCOUNTS
          </p>
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <Icon
              icon="solar:users-group-rounded-linear"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-sm text-text-tertiary text-center">
              No accounts to rank yet
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden h-full">
      <div className="p-5 h-full flex flex-col">
        <p className="text-xs text-text-tertiary font-medium tracking-wide mb-4">
          BEST PERFORMING ACCOUNTS
        </p>
        <div className="space-y-3 flex-1 overflow-y-auto">
          {ranked.map(({ account, totalViews }, index) => (
            <div
              key={account.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <span className="text-sm font-bold text-text-tertiary w-6 text-center">
                {index + 1}
              </span>
              <Avatar
 size="sm"
 />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon
                    icon={platformIcon(account.platform)}
                    width={14}
                    className={platformIconColor(account.platform)}
                  />
                  <span className="text-sm text-text-primary truncate">
                    @{account.username}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-text-primary">
                  {formatNumber(totalViews)}
                </p>
                <p className="text-xs text-text-tertiary">views</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
