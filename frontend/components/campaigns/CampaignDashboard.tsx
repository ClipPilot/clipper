"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Spinner,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import {
  campaignAPI,
  type Campaign,
  type CampaignVideo,
  type CampaignWallet,
  type CampaignCard,
  type CampaignContract,
  type CampaignGates,
} from "@/api/campaign";
import { VideosGate } from "./gates/VideosGate";
import { PaymentGate } from "./gates/PaymentGate";
import { ContractGate } from "./gates/ContractGate";
import { ActiveCampaignDashboard } from "./active/ActiveCampaignDashboard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StepStatusIcon({ complete }: { complete: boolean }) {
  if (complete) {
    return (
      <div className="w-6 h-6 rounded-full bg-success-500/20 flex items-center justify-center flex-shrink-0">
        <Icon icon="solar:check-circle-bold" className="text-success-500" width={16} />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-default-100 flex items-center justify-center flex-shrink-0">
      <Icon icon="solar:lock-bold" className="text-text-tertiary" width={14} />
    </div>
  );
}

interface StepSectionProps {
  number: number;
  title: string;
  description: string;
  icon: string;
  complete: boolean;
  children: React.ReactNode;
}

function StepSection({
  number,
  title,
  description,
  icon,
  complete,
  children,
}: StepSectionProps) {
  const [isExpanded, setIsExpanded] = useState(!complete);

  // Auto-collapse when step becomes complete
  useEffect(() => {
    if (complete) setIsExpanded(false);
  }, [complete]);

  return (
    <Card
      className={`bg-surface-base border transition-colors ${
        complete ? "border-success-500/30" : "border-border-base"
      }`}
    >
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 w-full">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              complete ? "bg-success-500/10" : "bg-accent-400/10"
            }`}
          >
            <Icon
              icon={icon}
              className={complete ? "text-success-500" : "text-accent-400"}
              width={18}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-tertiary">
                Step {number}
              </span>
              {complete && (
                <Chip color="success" variant="flat" size="sm" className="h-5">
                  Complete
                </Chip>
              )}
            </div>
            <p className="text-sm font-semibold text-text-primary">{title}</p>
            <p className="text-xs text-text-secondary">{description}</p>
          </div>
          <StepStatusIcon complete={complete} />
          <Icon
            icon={isExpanded ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
            className="text-text-tertiary ml-1 flex-shrink-0"
            width={16}
          />
        </div>
      </CardHeader>
      {isExpanded && (
        <>
          <Divider className="bg-border-base" />
          <CardBody className="p-4 sm:p-5">{children}</CardBody>
        </>
      )}
    </Card>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function StepsProgressBar({ gates }: { gates: CampaignGates }) {
  const completed = [
    gates.videos.complete,
    gates.payment.complete,
    gates.contract.complete,
  ].filter(Boolean).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">Steps complete</span>
        <span className="font-semibold text-text-primary">{completed} / 3</span>
      </div>
      <div className="flex gap-1.5">
        {[gates.videos.complete, gates.payment.complete, gates.contract.complete].map(
          (done, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                done ? "bg-success-500" : "bg-default-200"
              }`}
            />
          )
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CampaignDashboardProps {
  campaignId: number;
  onBack: () => void;
}

export function CampaignDashboard({ campaignId, onBack }: CampaignDashboardProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [gates, setGates] = useState<CampaignGates | null>(null);
  const [videos, setVideos] = useState<CampaignVideo[]>([]);
  const [wallet, setWallet] = useState<CampaignWallet | null>(null);
  const [savedCard, setSavedCard] = useState<CampaignCard | null>(null);
  const [contract, setContract] = useState<CampaignContract | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!selectedTeam?.id) return;
    setIsLoading(true);
    try {
      const [
        campaignRes,
        videosRes,
        walletRes,
        contractRes,
      ] = await Promise.allSettled([
        campaignAPI.getCampaign(selectedTeam.id, campaignId),
        campaignAPI.listVideos(selectedTeam.id, campaignId),
        campaignAPI.getWallet(selectedTeam.id, campaignId),
        campaignAPI.getContract(selectedTeam.id, campaignId),
      ]);

      if (campaignRes.status === "fulfilled") {
        setCampaign(campaignRes.value.campaign);
        setGates(campaignRes.value.gates);
      }
      if (videosRes.status === "fulfilled") {
        setVideos(videosRes.value.videos);
      }
      if (walletRes.status === "fulfilled") {
        setWallet(walletRes.value.wallet);
        setSavedCard(walletRes.value.card);
      }
      if (contractRes.status === "fulfilled") {
        setContract(contractRes.value.contract);
      }
    } catch (err) {
      console.error("Failed to fetch campaign data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam?.id, campaignId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Targeted video state updates (no full refetch) ──────────────────────────

  const handleVideoAdded = useCallback((video: CampaignVideo) => {
    setVideos((prev) => [...prev, video]);
    setGates((prev) =>
      prev
        ? {
            ...prev,
            videos: {
              ...prev.videos,
              videoCount: prev.videos.videoCount + 1,
              complete:
                prev.videos.videoCount + 1 >= prev.videos.videoMinimum,
            },
          }
        : prev
    );
  }, []);

  const handleVideosAdded = useCallback((newVideos: CampaignVideo[]) => {
    setVideos((prev) => [...prev, ...newVideos]);
    setGates((prev) =>
      prev
        ? {
            ...prev,
            videos: {
              ...prev.videos,
              videoCount: prev.videos.videoCount + newVideos.length,
              complete:
                prev.videos.videoCount + newVideos.length >=
                prev.videos.videoMinimum,
            },
          }
        : prev
    );
  }, []);

  const handleVideoRemoved = useCallback((videoId: number) => {
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
    setGates((prev) =>
      prev
        ? {
            ...prev,
            videos: {
              ...prev.videos,
              videoCount: Math.max(0, prev.videos.videoCount - 1),
              complete:
                prev.videos.videoCount - 1 >= prev.videos.videoMinimum,
            },
          }
        : prev
    );
  }, []);

  // ── Targeted payment state updates ─────────────────────────────────────────

  const handleCardSaved = useCallback((card: CampaignCard) => {
    setSavedCard(card);
  }, []);

  const handlePaymentComplete = useCallback((newBalanceCents: number) => {
    setGates((prev) =>
      prev
        ? {
            ...prev,
            payment: {
              ...prev.payment,
              balanceCents: newBalanceCents,
              complete: newBalanceCents >= prev.payment.requiredCents,
            },
          }
        : prev
    );
  }, []);

  // ── Targeted contract state update ─────────────────────────────────────────

  const handleCampaignUpdated = useCallback((updated: Campaign) => {
    setCampaign(updated);
  }, []);

  const handleContractSigned = useCallback((updatedContract: CampaignContract) => {
    setContract(updatedContract);
    setGates((prev) =>
      prev
        ? {
            ...prev,
            contract: {
              ...prev.contract,
              complete: true,
              signedAt: updatedContract.signed_at,
            },
          }
        : prev
    );
  }, []);

  const handleStartCampaign = async () => {
    if (!selectedTeam?.id || !campaign) return;
    setIsStarting(true);
    try {
      const { campaign: updated, message } = await campaignAPI.startCampaign(
        selectedTeam.id,
        campaignId
      );
      setCampaign(updated);
      addToast({
        title: "Campaign started",
        description: message || "Your campaign is now live.",
        color: "success",
      });
      fetchAll();
    } catch (err: any) {
      addToast({
        title: "Failed to start campaign",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!campaign || !gates) {
    return (
      <div className="flex flex-col items-center gap-4 py-32 text-center">
        <Icon
          icon="solar:close-circle-bold-duotone"
          className="text-danger-500"
          width={40}
        />
        <p className="text-text-secondary">Failed to load campaign.</p>
        <Button variant="flat" onPress={onBack}>
          Back to Campaigns
        </Button>
      </div>
    );
  }

  // ── Active campaign dashboard ─────────────────────────────────────────────

  if (campaign.status === "started" || campaign.status === "paused") {
    return (
      <ActiveCampaignDashboard
        campaign={campaign}
        videos={videos}
        wallet={wallet}
        savedCard={savedCard}
        onBack={onBack}
        onVideoAdded={handleVideoAdded}
        onVideosAdded={handleVideosAdded}
        onVideoRemoved={handleVideoRemoved}
        onCampaignUpdated={handleCampaignUpdated}
      />
    );
  }

  // ── Completed campaign view ──────────────────────────────────────────────

  if (campaign.status === "completed") {
    const completedDate = campaign.completed_at
      ? new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date(campaign.completed_at))
      : null;

    return (
      <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Button
            variant="light"
            size="sm"
            className="text-text-secondary -ml-2"
            onPress={onBack}
            startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
          >
            Back to Campaigns
          </Button>

          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center">
              <Icon
                icon="solar:check-circle-bold-duotone"
                className="text-text-secondary"
                width={36}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{campaign.name}</h1>
              <Chip color="default" variant="flat" className="capitalize mt-2">
                Completed
              </Chip>
            </div>
            {completedDate && (
              <p className="text-sm text-text-secondary">
                Campaign completed on {completedDate}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Setup flow ────────────────────────────────────────────────────────────

  const allStepsComplete =
    gates.videos.complete && gates.payment.complete && gates.contract.complete;

  const canStart = allStepsComplete;

  const budget = campaign.budget ? parseFloat(campaign.budget) : 0;
  const cpm = campaign.quoted_cpm ? parseFloat(campaign.quoted_cpm) : 0;
  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back nav */}
        <Button
          variant="light"
          size="sm"
          className="text-text-secondary -ml-2"
          onPress={onBack}
          startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
        >
          Back to Campaigns
        </Button>

        {/* Campaign header */}
        <div className="space-y-1">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-text-primary truncate">
                {campaign.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-text-secondary">
                {budget > 0 && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:dollar-bold" width={14} />
                    Budget: <strong className="text-text-primary">${budget.toLocaleString()}</strong>
                  </span>
                )}
                {cpm > 0 && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:chart-bold-duotone" width={14} />
                    CPM: <strong className="text-text-primary">${cpm.toFixed(2)}</strong>
                  </span>
                )}
              </div>
            </div>
            <Chip
              color={
                campaign.status === "rejected"
                  ? "danger"
                  : campaign.status === "pending"
                    ? "warning"
                    : "default"
              }
              variant="flat"
              className="flex-shrink-0 capitalize"
            >
              {campaign.status}
            </Chip>
          </div>
        </div>

        {/* Steps progress bar */}
        <StepsProgressBar gates={gates} />

        {/* Step1: Videos */}
        <StepSection
          number={1}
          title="Upload Videos"
          description="Add the video creatives that will run in your campaign."
          icon="solar:video-library-bold-duotone"
          complete={gates.videos.complete}
        >
          <VideosGate
            campaignId={campaignId}
            videos={videos}
            gate={gates.videos}
            onVideoAdded={handleVideoAdded}
            onVideosAdded={handleVideosAdded}
            onVideoRemoved={handleVideoRemoved}
          />
        </StepSection>

        {/* Step2: Payment */}
        <StepSection
          number={2}
          title="Fund Campaign"
          description="Add funds to your campaign wallet to cover the ad spend."
          icon="solar:wallet-bold-duotone"
          complete={gates.payment.complete}
        >
          <PaymentGate
            campaignId={campaignId}
            campaign={campaign}
            gate={gates.payment}
            savedCard={savedCard}
            onCardSaved={handleCardSaved}
            onPaymentComplete={handlePaymentComplete}
          />
        </StepSection>

        {/* Step3: Contract */}
        <StepSection
          number={3}
          title="Sign Contract"
          description="Review and sign the campaign agreement to proceed."
          icon="solar:document-text-bold-duotone"
          complete={gates.contract.complete}
        >
          <ContractGate
            campaignId={campaignId}
            gate={gates.contract}
            contract={contract}
            onContractSigned={handleContractSigned}
          />
        </StepSection>

        {/* Start campaign button */}
        <div className="pt-2 pb-8">
          <Button
            color="primary"
            size="lg"
            className="w-full"
            onPress={handleStartCampaign}
            isLoading={isStarting}
            isDisabled={!canStart}
            startContent={
              !isStarting && (
                <Icon icon="solar:play-circle-bold-duotone" width={20} />
              )
            }
          >
            {allStepsComplete
              ? "Start Campaign"
              : `Complete ${3 - [gates.videos.complete, gates.payment.complete, gates.contract.complete].filter(Boolean).length} more step${
                  3 - [gates.videos.complete, gates.payment.complete, gates.contract.complete].filter(Boolean).length !== 1 ? "s" : ""
                } to start`}
          </Button>
        </div>
      </div>
    </div>
  );
}
