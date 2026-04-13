"use client";

import { useState } from "react";
import { Modal, Button, Select, ListBox } from "@heroui/react";
import type { Key } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ViralityCompetitor } from "@/api/virality";

interface DeleteGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: { id: number; name: string; accountCount: number } | null;
  availableGroups: ViralityCompetitor[];
  onDelete: (groupId: number) => Promise<void>;
  onMoveAndDelete: (sourceGroupId: number, targetGroupId: number) => Promise<void>;
}

export function DeleteGroupModal({
  isOpen,
  onClose,
  group,
  availableGroups,
  onDelete,
  onMoveAndDelete,
}: DeleteGroupModalProps) {
  const [targetGroupId, setTargetGroupId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!group) return null;

  const otherGroups = availableGroups.filter((g) => g.id !== group.id);
  const hasAccounts = group.accountCount > 0;

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await onDelete(group.id);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveAndDelete = async () => {
    if (!targetGroupId) return;
    setIsLoading(true);
    try {
      await onMoveAndDelete(group.id, targetGroupId);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (open: boolean) => { if (!open) onClose(); };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.Body className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                <Icon icon="solar:trash-bin-minimalistic-bold" width={20} className="text-red-400" />
                Delete &ldquo;{group.name}&rdquo;
              </div>
          {hasAccounts ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Icon icon="solar:danger-triangle-bold" width={20} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-text-secondary">
                  This group has <span className="font-semibold text-text-primary">{group.accountCount} account{group.accountCount !== 1 ? "s" : ""}</span>.
                  Deleting will permanently remove all accounts and their tracked data.
                </p>
              </div>

              {otherGroups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-text-primary">Move accounts to another group first:</p>
                  <Select
                    placeholder="Select a group"
                    value={targetGroupId ? String(targetGroupId) : null}
                    onChange={(val: Key | null) => setTargetGroupId(val ? Number(val) : null)}
                  >
                    <Select.Trigger className="w-full px-3 py-2.5 rounded-xl bg-surface-dark border border-border-base text-text-primary text-sm">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {otherGroups.map((g) => (
                          <ListBox.Item key={String(g.id)} id={String(g.id)} textValue={g.name}>
                            {g.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <Button
                    className="w-full bg-accent-400 text-white"
                    isDisabled={!targetGroupId || isLoading}
                    isPending={isLoading}
                    onPress={handleMoveAndDelete}
                  >
                    <Icon icon="solar:transfer-horizontal-bold" width={16} />
                    Move Accounts & Delete Group
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-xs text-text-tertiary">or</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>

              <Button
                className="w-full bg-red-500/10 text-red-400 hover:bg-red-500/20"
                isDisabled={isLoading}
                isPending={isLoading}
                onPress={handleDelete}
              >
                <Icon icon="solar:trash-bin-minimalistic-bold" width={16} />
                Delete Group & All Accounts
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                This group has no accounts. Are you sure you want to delete it?
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-500 text-white"
                  isPending={isLoading}
                  onPress={handleDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
