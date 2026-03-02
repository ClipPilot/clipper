"use client";

import { useState, useEffect } from "react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessMassPosting } from "@/lib/plans";
import { useMassPosting } from "@/hooks/useMassPosting";
import { intakeAPI } from "@/api/intake";
import {
  LoadingView,
  PendingView,
  RejectedView,
} from "@/components/mass-posting/StatusViews";
import { IntakeForm } from "@/components/mass-posting/IntakeForm";
import { PlanUpgradeWall } from "@/components/mass-posting/PlanUpgradeWall";
import { CampaignList } from "@/components/campaigns/CampaignList";

export default function PublishPostsPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const {
    isApproved,
    isPending,
    isRejected,
    applicationStatus,
    isLoading: statusLoading,
    refetch,
  } = useMassPosting();

  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isAppeal, setIsAppeal] = useState(false);

  useEffect(() => {
    if (isRejected && selectedTeam?.id) {
      intakeAPI
        .getLatestApplication(selectedTeam.id)
        .then(({ application }) => {
          setRejectionReason(application?.rejection_reason ?? null);
        })
        .catch(() => {});
    }
  }, [isRejected, selectedTeam?.id]);

  if (!canAccessMassPosting(selectedTeam?.plan)) {
    return (
      <PlanUpgradeWall
        title="Publish Posts"
        description="Send your clips directly to social platforms with one click. Available on Studio plan and above."
        icon="solar:posts-carousel-vertical-bold-duotone"
      />
    );
  }

  if (statusLoading) {
    return <LoadingView />;
  }

  if (isPending && !showForm) {
    return <PendingView status={applicationStatus} />;
  }

  if (isRejected && !showForm) {
    return (
      <RejectedView
        reason={rejectionReason}
        onAppeal={() => {
          setIsAppeal(true);
          setShowForm(true);
        }}
      />
    );
  }

  if (!isApproved) {
    return (
      <IntakeForm
        teamId={selectedTeam?.id ?? null}
        isAppeal={isAppeal}
        onSubmitted={() => {
          setShowForm(false);
          setIsAppeal(false);
          refetch();
        }}
      />
    );
  }

  return <CampaignList />;
}
