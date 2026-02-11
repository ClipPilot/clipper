"use client";

import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  Input,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { adPostingAPI } from "@/api/adPosting";

interface Clip {
  id: number;
  title?: string;
  clipUrl?: string;
}

interface AdPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: Clip;
}

const PLATFORMS = [
  { key: "tiktok", name: "TikTok", icon: "logos:tiktok-icon" },
  { key: "instagram", name: "Instagram", icon: "skill-icons:instagram" },
  { key: "facebook", name: "Facebook", icon: "logos:facebook" },
  { key: "youtube", name: "YouTube", icon: "logos:youtube-icon" },
  { key: "x", name: "X", icon: "ri:twitter-x-fill" },
] as const;

function QuantityInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(String(value));

  // Sync draft when value changes externally
  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const clamp = (n: number) => Math.max(1, Math.min(50, n));

  const handleBlur = () => {
    const parsed = parseInt(draft, 10);
    const clamped = clamp(isNaN(parsed) ? 1 : parsed);
    setDraft(String(clamped));
    onChange(clamped);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        isIconOnly
        size="sm"
        variant="flat"
        className="h-7 w-7 min-w-0 bg-surface-elevated border border-border-base"
        isDisabled={disabled || value <= 1}
        onPress={() => onChange(clamp(value - 1))}
      >
        <Icon icon="mdi:minus" className="text-sm" />
      </Button>
      <Input
        type="text"
        inputMode="numeric"
        value={draft}
        isDisabled={disabled}
        onValueChange={(v) => setDraft(v.replace(/[^0-9]/g, ""))}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === "Enter" && handleBlur()}
        size="sm"
        classNames={{
          base: "w-14",
          input: "text-center text-sm font-medium",
          inputWrapper: "h-7 min-h-0 bg-surface-elevated border border-border-base",
        }}
      />
      <Button
        isIconOnly
        size="sm"
        variant="flat"
        className="h-7 w-7 min-w-0 bg-surface-elevated border border-border-base"
        isDisabled={disabled || value >= 50}
        onPress={() => onChange(clamp(value + 1))}
      >
        <Icon icon="mdi:plus" className="text-sm" />
      </Button>
    </div>
  );
}

export default function AdPostingModal({
  isOpen,
  onClose,
  clip,
}: AdPostingModalProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  // Record<platformKey, quantity> — absent key means platform is off
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isPosting, setIsPosting] = useState(false);

  const togglePlatform = (key: string) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (key in next) {
        delete next[key];
      } else {
        next[key] = 1;
      }
      return next;
    });
  };

  const setQuantity = (key: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [key]: qty }));
  };

  const handlePost = async () => {
    if (!selectedTeam?.id || creditCount === 0) return;

    setIsPosting(true);
    try {
      await adPostingAPI.postToPlatforms(
        selectedTeam.id,
        clip.id,
        quantities
      );

      addToast({
        title: "Ad posting started",
        description: `Processing ${creditCount} cop${creditCount > 1 ? "ies" : "y"} in the background...`,
        color: "primary",
      });

      setQuantities({});
      onClose();
    } catch (error: any) {
      addToast({
        title: "Posting failed",
        description: error.message || "Failed to start ad posting",
        color: "danger",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const creditCount = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      classNames={{
        wrapper: "z-[9999] isolate",
        backdrop: "z-[9998]",
        base: "bg-surface-base border border-border-base z-[9999]",
        header: "border-b border-border-base",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon
            icon="mdi:megaphone"
            className="text-xl text-accent-400"
          />
          <span>Send to Ad Posting</span>
        </ModalHeader>

        <ModalBody className="py-4">
          <p className="text-sm text-text-secondary mb-4">
            Select platforms and quantities for{" "}
            <span className="font-medium text-text-primary">
              {clip.title || `Clip #${clip.id}`}
            </span>
          </p>

          <div className="space-y-2">
            {PLATFORMS.map((platform) => {
              const isActive = platform.key in quantities;
              return (
                <div
                  key={platform.key}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isActive
                      ? "border-accent-400 bg-accent-400/5"
                      : "border-border-base hover:bg-surface-elevated"
                  }`}
                >
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => !isPosting && togglePlatform(platform.key)}
                  >
                    <Icon icon={platform.icon} className="text-xl" />
                    <span className="text-sm font-medium text-text-primary">
                      {platform.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {isActive && (
                      <QuantityInput
                        value={quantities[platform.key]}
                        onChange={(v) => setQuantity(platform.key, v)}
                        disabled={isPosting}
                      />
                    )}
                    <Switch
                      size="sm"
                      isSelected={isActive}
                      onValueChange={() => togglePlatform(platform.key)}
                      isDisabled={isPosting}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ModalBody>

        <ModalFooter className="flex items-center justify-between">
          <div className="text-sm text-text-secondary">
            {creditCount > 0 ? (
              <span>
                <span className="font-semibold text-text-primary">
                  {creditCount}
                </span>{" "}
                credit{creditCount !== 1 ? "s" : ""}
              </span>
            ) : (
              "Select platforms"
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="flat" onPress={onClose} isDisabled={isPosting}>
              Cancel
            </Button>
            <Button
              color="primary"
              className="bg-accent-400"
              isLoading={isPosting}
              isDisabled={creditCount === 0 || isPosting}
              onPress={handlePost}
              startContent={
                !isPosting && <Icon icon="mdi:megaphone" />
              }
            >
              Post
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
