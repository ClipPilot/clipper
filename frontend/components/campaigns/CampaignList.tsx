"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { useCampaigns } from "@/hooks/useCampaigns";
import { campaignAPI, type Campaign } from "@/api/campaign";

function statusColor(
  status: Campaign["status"]
): "default" | "warning" | "success" | "danger" | "primary" | "secondary" {
  switch (status) {
    case "pending":
    case "appeal":
      return "warning";
    case "accepted":
      return "primary";
    case "started":
      return "success";
    case "paused":
      return "warning";
    case "completed":
      return "secondary";
    case "rejected":
      return "danger";
    default:
      return "default";
  }
}

function statusLabel(status: Campaign["status"]): string {
  switch (status) {
    case "pending":
      return "Pending Review";
    case "accepted":
      return "Accepted";
    case "started":
      return "Active";
    case "paused":
      return "Paused";
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    case "appeal":
      return "Under Appeal";
    default:
      return status;
  }
}

interface CampaignListProps {
  onSelectCampaign: (campaignId: number) => void;
}

export function CampaignList({ onSelectCampaign }: CampaignListProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const { campaigns, isLoading, refetch } = useCampaigns();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!selectedTeam?.id || !newName.trim()) return;
    setIsCreating(true);
    try {
      const { campaign } = await campaignAPI.createCampaign(selectedTeam.id, {
        name: newName.trim(),
      });
      addToast({
        title: "Campaign created",
        description: `"${campaign.name}" is ready to set up.`,
        color: "success",
      });
      setNewName("");
      setIsCreateOpen(false);
      refetch();
      onSelectCampaign(campaign.id);
    } catch (err: any) {
      addToast({
        title: "Failed to create campaign",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
              Campaigns
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Manage your ad campaigns and track their progress.
            </p>
          </div>
          <Button
            color="primary"
            onPress={() => setIsCreateOpen(true)}
            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
          >
            New Campaign
          </Button>
        </div>

        {/* Campaign grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" color="primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="bg-surface-base border border-border-base">
            <CardBody className="flex flex-col items-center text-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-accent-400/10 flex items-center justify-center">
                <Icon
                  icon="solar:megaphone-bold-duotone"
                  className="text-accent-400"
                  width={32}
                />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-text-primary">
                  No campaigns yet
                </h3>
                <p className="text-sm text-text-secondary max-w-xs">
                  Create your first campaign to start reaching your audience
                  with targeted video ads.
                </p>
              </div>
              <Button
                color="primary"
                onPress={() => setIsCreateOpen(true)}
                startContent={<Icon icon="solar:add-circle-bold" width={18} />}
              >
                Create Campaign
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => onSelectCampaign(campaign.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setNewName("");
        }}
        size="sm"
        classNames={{ base: "bg-surface-base border border-border-base" }}
      >
        <ModalContent>
          <ModalHeader className="border-b border-border-base">
            <div className="flex items-center gap-2">
              <Icon
                icon="solar:megaphone-bold-duotone"
                className="text-accent-400"
                width={22}
              />
              <span className="text-text-primary">New Campaign</span>
            </div>
          </ModalHeader>
          <ModalBody className="py-6">
            <Input
              label="Campaign name"
              placeholder="e.g. Q1 Brand Awareness"
              value={newName}
              onValueChange={setNewName}
              variant="bordered"
              classNames={{
                inputWrapper: "border-border-base bg-surface-elevated",
                input: "text-text-primary",
                label: "text-text-secondary",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              autoFocus
            />
          </ModalBody>
          <ModalFooter className="border-t border-border-base">
            <Button
              variant="flat"
              className="bg-surface-elevated text-text-secondary"
              onPress={() => {
                setIsCreateOpen(false);
                setNewName("");
              }}
              isDisabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleCreate}
              isLoading={isCreating}
              isDisabled={!newName.trim()}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function CampaignCard({
  campaign,
  onClick,
}: {
  campaign: Campaign;
  onClick: () => void;
}) {
  const budgetNum = campaign.budget ? parseFloat(campaign.budget) : null;
  const cpmNum = campaign.quoted_cpm ? parseFloat(campaign.quoted_cpm) : null;

  const budget =
    budgetNum != null
      ? `$${budgetNum.toLocaleString()}`
      : "No budget set";

  const cpm = cpmNum != null ? `$${cpmNum.toFixed(2)} CPM` : null;

  return (
    <button
      onClick={onClick}
      className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 rounded-xl"
    >
      <Card className="bg-surface-base border border-border-base hover:border-accent-400/50 transition-colors cursor-pointer h-full">
        <CardBody className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-text-primary truncate">
              {campaign.name}
            </p>
            <Chip
              color={statusColor(campaign.status)}
              variant="flat"
              size="sm"
              className="flex-shrink-0"
            >
              {statusLabel(campaign.status)}
            </Chip>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">Budget</span>
              <span className="text-text-primary font-medium">{budget}</span>
            </div>
            {cpm && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">CPM</span>
                <span className="text-text-primary font-medium">{cpm}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-auto pt-1">
            <Icon
              icon="solar:arrow-right-line-duotone"
              className="text-text-tertiary ml-auto"
              width={14}
            />
            <span className="text-xs text-text-tertiary">View details</span>
          </div>
        </CardBody>
      </Card>
    </button>
  );
}
