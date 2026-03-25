"use client";

import { useState } from "react";
import { Card, Avatar, Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ViralityAccount } from "@/api/virality";
import { formatNumber } from "@/lib/formatters";
import { platformIcon, platformIconColor, syncStatusColor, timeAgo } from "@/lib/platformUtils";

interface AccountCardProps {
  account: ViralityAccount;
  onSync: () => Promise<void>;
  onDelete: () => Promise<void>;
  onViewPosts: () => void;
}

export function AccountCard({
  account,
  onSync,
  onDelete,
  onViewPosts,
}: AccountCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onSync();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <Card
 className="bg-surface-base border border-border-base hover:border-accent-400/40 transition-all"
 >
      <Card.Content className="p-4">
        <div
          className="flex items-start gap-3 mb-4 cursor-pointer"
          onClick={onViewPosts}
        >
          <Avatar
 size="lg"
 />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-text-accent truncate">
                {account.display_name || account.username}
              </p>
              {account.is_verified && (
                <Icon
                  icon="solar:verified-check-bold"
                  className="text-blue-500 flex-shrink-0"
                  width={16}
                />
              )}
            </div>
            <p className="text-sm text-text-tertiary">@{account.username}</p>
            <div className="flex items-center gap-1 mt-1">
              <Icon icon={platformIcon(account.platform)} className={platformIconColor(account.platform)} width={14} />
              <span className="text-xs text-text-tertiary capitalize">{account.platform}</span>
            </div>
          </div>
          <Chip
 size="sm"
 variant="tertiary"
 color={syncStatusColor(account.sync_status)}
 >
            {account.sync_status}
          </Chip>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-surface-elevated">
            <p className="text-lg font-bold text-text-accent">
              {formatNumber(account.follower_count)}
            </p>
            <p className="text-xs text-text-tertiary">Followers</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-surface-elevated">
            <p className="text-lg font-bold text-text-accent">
              {formatNumber(account.total_likes)}
            </p>
            <p className="text-xs text-text-tertiary">Likes</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-surface-elevated">
            <p className="text-lg font-bold text-text-accent">
              {formatNumber(account.post_count)}
            </p>
            <p className="text-xs text-text-tertiary">Posts</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-text-tertiary">
            <Icon
              icon="solar:clock-circle-bold"
              width={12}
              className="inline mr-1"
            />
            {account.last_synced_at ? timeAgo(account.last_synced_at) : "Never synced"}
          </p>
          {account.sync_error && (
            <p className="text-xs text-red-500 truncate max-w-[150px]">
              {account.sync_error}
            </p>
          )}
        </div>

        {account.sync_status === "completed" && (
          <Button
 size="sm"
 variant="tertiary"
 className="w-full mb-2 bg-accent-400/10 text-accent-400"
 onPress={onViewPosts}
 >
            <Icon icon="solar:gallery-bold" width={14} />
            View Posts
            <Icon icon="solar:arrow-right-linear" width={14} />
</Button>
        )}

        <div className="flex gap-2">
          <Button
 size="sm"
 variant="tertiary"
 className="flex-1"
 onPress={handleSync}
 isPending={isSyncing}
 isDisabled={account.sync_status === "syncing"}
 >
            {!isSyncing && <Icon icon="solar:refresh-bold" width={14} />}
            {isSyncing ? "Syncing..." : "Refresh"}
          </Button>
          <Button
 size="sm"
 variant="danger-soft"
 isIconOnly
 onPress={handleDelete}
 isPending={isDeleting}
 >
            {!isDeleting && <Icon icon="solar:trash-bin-trash-bold" width={14} />}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
