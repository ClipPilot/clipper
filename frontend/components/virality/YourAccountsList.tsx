"use client";

import { useMemo, useState } from "react";
import {
  Button,
  toast,
  Modal,
  useOverlayState } from "@heroui/react";
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
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const overlayState = useOverlayState();
const isOpen = overlayState.isOpen;
const onOpen = overlayState.open;
const onClose = overlayState.close;

  const ranked = useMemo(() => {
    return accounts
      .map((account) => {
        const posts = postsByAccount[account.id] || [];
        const totalViews = posts.reduce(
          (sum, p) => sum + (p.video_play_count || 0),
          0
        );
        const totalLikes = posts.reduce(
          (sum, p) => sum + (p.like_count || 0),
          0
        );
        return { account, totalViews, totalLikes, totalPosts: posts.length };
      })
      .sort((a, b) => b.totalViews - a.totalViews);
  }, [accounts, postsByAccount]);

  const handleDeleteClick = (accountId: number) => {
    setPendingDeleteId(accountId);
    onOpen();
  };

  const handleConfirmDelete = async () => {
    if (!selectedTeam?.id || !pendingDeleteId) return;
    setDeletingId(pendingDeleteId);
    onClose();
    try {
      await userPerformanceAPI.deleteAccount(selectedTeam.id, pendingDeleteId);
      toast.success("Account removed");
      onAccountDeleted();
    } catch (err: any) {
      toast.danger("Failed to remove account", { description: err.message });
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  if (ranked.length === 0) {
    return (
      <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
        <div className="p-5">
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
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
      <div className="p-3">
        <p className="text-[10px] text-text-tertiary font-medium tracking-wide mb-2">
          ACCOUNTS
        </p>
        <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
          {ranked.map(({ account, totalViews, totalLikes, totalPosts }, index) => (
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
              <span className="text-[10px] text-text-tertiary flex-shrink-0 flex items-center gap-1 sm:gap-1.5">
                <span>{formatNumber(totalViews)} <span className="hidden sm:inline">views</span><span className="sm:hidden">v</span></span>
                <span>·</span>
                <span>{formatNumber(totalLikes)} <span className="hidden sm:inline">likes</span><span className="sm:hidden">l</span></span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">{totalPosts} posts</span>
              </span>
              <Button
 size="sm"
 isIconOnly
 variant="tertiary"
 className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-red-500 w-5 h-5 min-w-5"
 isPending={deletingId === account.id}
 onPress={() => handleDeleteClick(account.id)}
 >
                <Icon icon="solar:trash-bin-trash-linear" width={12} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}><Modal.Container><Modal.Dialog className="sm:max-w-sm bg-surface-base border border-border-accent">
          {({ close: onCloseDialog }) => {
            const account = accounts.find((a) => a.id === pendingDeleteId);
            return (
              <>
                <Modal.Header>
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                      <Icon
                        icon="solar:trash-bin-trash-bold-duotone"
                        className="text-2xl text-red-500"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-text-primary">Remove Account</h3>
                  </div>
                </Modal.Header>
                <Modal.Body className="py-6">
                  <p className="text-text-secondary">
                    Are you sure you want to remove this account? All synced posts and metrics will be deleted.
                  </p>
                  {account && (
                    <p className="text-text-primary font-medium mt-3">
                      <span className="text-text-tertiary">Account:</span> @{account.username}
                    </p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button
 variant="tertiary"
 onPress={onCloseDialog}
 className="bg-surface-elevated hover:bg-surface-raised text-text-primary"
 >
                    Cancel
                  </Button>
                  <Button variant="danger"
 onPress={handleConfirmDelete}
 className="bg-red-500 hover:bg-red-600 text-white font-semibold"
 >
                    Remove
                  </Button>
                </Modal.Footer>
              </>
            );
          }}
        </Modal.Dialog></Modal.Container></Modal.Backdrop>
      </Modal>
    </div>
  );
}
