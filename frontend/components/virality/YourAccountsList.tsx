"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardBody,
  Button,
  addToast,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
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
  const { isOpen, onOpen, onClose } = useDisclosure();

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
      addToast({ title: "Account removed", color: "success" });
      onAccountDeleted();
    } catch (err: any) {
      addToast({ title: "Failed to remove account", description: err.message, color: "danger" });
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
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
              <span className="text-[10px] text-text-tertiary flex-shrink-0 flex items-center gap-1.5">
                <span>{formatNumber(totalViews)} views</span>
                <span>·</span>
                <span>{formatNumber(totalLikes)} likes</span>
                <span>·</span>
                <span>{totalPosts} posts</span>
              </span>
              <Button
                size="sm"
                isIconOnly
                variant="light"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-red-500 w-5 h-5 min-w-5"
                isLoading={deletingId === account.id}
                onPress={() => handleDeleteClick(account.id)}
              >
                <Icon icon="solar:trash-bin-trash-linear" width={12} />
              </Button>
            </div>
          ))}
        </div>
      </CardBody>

      <Modal isOpen={isOpen} onClose={onClose} size="sm">
        <ModalContent className="bg-surface-base border border-border-accent">
          {(onClose) => {
            const account = accounts.find((a) => a.id === pendingDeleteId);
            return (
              <>
                <ModalHeader className="flex flex-col items-start border-b border-border-base pb-4">
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-danger-500/10 flex items-center justify-center">
                      <Icon
                        icon="solar:trash-bin-trash-bold-duotone"
                        className="text-2xl text-danger-500"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-text-primary">Remove Account</h3>
                  </div>
                </ModalHeader>
                <ModalBody className="py-6">
                  <p className="text-text-secondary">
                    Are you sure you want to remove this account? All synced posts and metrics will be deleted.
                  </p>
                  {account && (
                    <p className="text-text-primary font-medium mt-3">
                      <span className="text-text-tertiary">Account:</span> @{account.username}
                    </p>
                  )}
                </ModalBody>
                <ModalFooter className="border-t border-border-base pt-4">
                  <Button
                    variant="flat"
                    onPress={onClose}
                    className="bg-surface-elevated hover:bg-surface-raised text-text-primary"
                  >
                    Cancel
                  </Button>
                  <Button
                    color="danger"
                    onPress={handleConfirmDelete}
                    className="bg-danger-500 hover:bg-danger-600 text-white font-semibold"
                  >
                    Remove
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </Card>
  );
}
