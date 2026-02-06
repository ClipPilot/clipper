"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface AddTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (platform: "instagram", profileUrl: string) => Promise<void>;
}

export function AddTargetModal({
  isOpen,
  onClose,
  onSubmit,
}: AddTargetModalProps) {
  const [profileUrl, setProfileUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!profileUrl.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit("instagram", profileUrl);
      setProfileUrl("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add target");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setProfileUrl("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      classNames={{
        base: "bg-surface-base border border-border-base",
        header: "border-b border-border-base",
        body: "py-6",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-pink-500/10">
            <Icon icon="ri:instagram-fill" width={24} className="text-pink-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Add Instagram Target
            </h3>
            <p className="text-sm text-text-tertiary font-normal">
              Track posts and engagement metrics
            </p>
          </div>
        </ModalHeader>

        <ModalBody className="gap-4">
          <Input
            label="Profile URL or Username"
            placeholder="@username or instagram.com/username"
            value={profileUrl}
            onValueChange={setProfileUrl}
            startContent={
              <Icon
                icon="ri:instagram-fill"
                width={20}
                className="text-text-tertiary"
              />
            }
            classNames={{
              input: "text-text-primary",
              inputWrapper:
                "bg-surface-elevated border-border-base hover:border-accent-400",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && profileUrl.trim()) {
                handleSubmit();
              }
            }}
          />

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Icon icon="solar:danger-triangle-bold" className="text-red-500" width={18} />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <div className="p-3 rounded-lg bg-surface-elevated border border-border-base">
            <div className="flex items-start gap-2">
              <Icon
                icon="solar:info-circle-bold"
                className="text-accent-400 mt-0.5"
                width={16}
              />
              <div className="text-xs text-text-tertiary">
                <p className="mb-1">You can enter:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Username: @creatorname</li>
                  <li>Profile URL: instagram.com/creatorname</li>
                </ul>
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={handleClose}>
            Cancel
          </Button>
          <Button
            className="bg-accent-400 text-white"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            isDisabled={!profileUrl.trim()}
            startContent={
              !isSubmitting && (
                <Icon icon="solar:add-circle-bold" width={18} />
              )
            }
          >
            Start Tracking
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
