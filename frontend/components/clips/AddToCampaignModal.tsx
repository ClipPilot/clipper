"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Spinner,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { campaignAPI, type Campaign } from "@/api/campaign";

interface AddToCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  clipId: number;
  clipTitle?: string;
  onAdded?: () => void;
  campaignClipMap?: Record<number, number[]>;
}

export default function AddToCampaignModal({
  isOpen,
  onClose,
  clipId,
  clipTitle,
  onAdded,
  campaignClipMap = {},
}: AddToCampaignModalProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingTo, setAddingTo] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !selectedTeam?.id) return;
    setIsLoading(true);
    campaignAPI
      .listCampaigns(selectedTeam.id)
      .then(({ campaigns: list }) => {
        // Show campaigns that can accept videos (accepted or started)
        setCampaigns(
          list.filter(
            (c) => c.status === "accepted" || c.status === "started",
          ),
        );
      })
      .catch(() => {
        addToast({
          title: "Failed to load campaigns",
          color: "danger",
        });
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, selectedTeam?.id]);

  const handleAdd = async (campaignId: number) => {
    if (!selectedTeam?.id) return;
    setAddingTo(campaignId);
    try {
      await campaignAPI.addVideos(selectedTeam.id, campaignId, [clipId]);
      addToast({
        title: "Clip added to campaign",
        color: "success",
      });
      onAdded?.();
      onClose();
    } catch (err: any) {
      addToast({
        title: "Failed to add clip",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    } finally {
      setAddingTo(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      classNames={{
        wrapper: "z-[9999] isolate",
        backdrop: "z-[9998]",
        base: "bg-surface-base border border-border-base z-[9999]",
        header: "border-b border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon
            icon="solar:video-library-bold-duotone"
            className="text-xl text-accent-400"
          />
          <span>Add to Campaign</span>
        </ModalHeader>

        <ModalBody className="py-4">
          <p className="text-sm text-text-secondary mb-4">
            Add{" "}
            <span className="font-medium text-text-primary">
              {clipTitle || `Clip #${clipId}`}
            </span>{" "}
            to a campaign
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" color="primary" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Icon
                icon="solar:inbox-bold-duotone"
                className="text-text-tertiary"
                width={32}
              />
              <p className="text-sm text-text-secondary">
                No active campaigns
              </p>
              <p className="text-xs text-text-tertiary">
                Create a campaign in Publish Posts first.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((campaign) => {
                const alreadyAdded = campaignClipMap[campaign.id]?.includes(clipId);
                return (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border-base hover:bg-surface-elevated transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {campaign.name}
                      </p>
                      <p className="text-xs text-text-secondary capitalize">
                        {campaign.status}
                      </p>
                    </div>
                    {alreadyAdded ? (
                      <div className="flex items-center gap-1.5 ml-3 text-success-500">
                        <Icon icon="solar:check-circle-bold" width={18} />
                        <span className="text-sm font-medium">Added</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-accent-400 text-white font-medium ml-3"
                        onPress={() => handleAdd(campaign.id)}
                        isLoading={addingTo === campaign.id}
                        isDisabled={addingTo !== null}
                        startContent={
                          addingTo !== campaign.id && (
                            <Icon icon="solar:add-circle-bold" width={16} />
                          )
                        }
                      >
                        Add
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
