"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, Avatar, Button, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ViralityAccount, ViralityPost } from "@/api/virality";
import { userPerformanceAPI } from "@/api/userPerformance";
import { formatNumber } from "@/lib/formatters";
import { platformIcon, platformIconColor } from "@/lib/platformUtils";
import { useTeams } from "@/hooks/useTeams";

interface YourAccountsListProps {
  accounts: ViralityAccount[];
  postsByAccount: Record<number, ViralityPost[]>;
  onAccountDeleted: () => void;
}

export function YourAccountsList({
  accounts,
  postsByAccount,
  onAccountDeleted,
}: YourAccountsListProps) {
  const { selectedTeam } = useTeams();
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const handleDelete = async (accountId: number) => {
    if (!selectedTeam?.id) return;
    setDeletingId(accountId);
    try {
      await userPerformanceAPI.deleteAccount(selectedTeam.id, accountId);
      addToast({ title: "Account removed", color: "success" });
      onAccountDeleted();
    } catch (err: any) {
      addToast({ title: "Failed to remove account", description: err.message, color: "danger" });
    } finally {
      setDeletingId(null);
    }
  };

  if (ranked.length === 0) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-5">
          <p className="text-xs text-text-tertiary font-medium tracking-wide mb-4">
            ACCOUNTS
          </p>
          <div className="flex flex-col items-center justify-center h-[250px] gap-3">
            <Icon
              icon="solar:users-group-rounded-linear"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-sm text-text-tertiary text-center">
              No accounts added yet
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-3">
        <p className="text-[10px] text-text-tertiary font-medium tracking-wide mb-2">
          ACCOUNTS
        </p>
        <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
          {ranked.map(({ account, totalViews }, index) => (
            <div
              key={account.id}
              className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-surface-hover transition-colors group"
            >
              <span className="text-[10px] font-bold text-text-tertiary w-4 text-center">
                {index + 1}
              </span>
              <Icon
                icon={platformIcon(account.platform)}
                width={12}
                className={platformIconColor(account.platform)}
              />
              <span className="text-xs text-text-primary truncate flex-1 min-w-0">
                @{account.username}
              </span>
              <span className="text-xs font-medium text-text-secondary flex-shrink-0">
                {formatNumber(totalViews)} views
              </span>
              <Button
                size="sm"
                isIconOnly
                variant="light"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-red-500 w-5 h-5 min-w-5"
                isLoading={deletingId === account.id}
                onPress={() => handleDelete(account.id)}
              >
                <Icon icon="solar:trash-bin-trash-linear" width={12} />
              </Button>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
