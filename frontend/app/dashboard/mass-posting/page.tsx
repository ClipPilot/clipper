"use client";

import { useState, useEffect } from "react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { useMassPosting } from "@/hooks/useMassPosting";
import { intakeAPI } from "@/api/intake";
import {
  LoadingView,
  ApprovedView,
  PendingView,
  RejectedView,
} from "@/components/mass-posting/StatusViews";
import { IntakeForm } from "@/components/mass-posting/IntakeForm";

export default function MassPostingPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const {
    isApproved,
    isPending,
    isRejected,
    applicationStatus,
    isLoading,
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

  if (isLoading) {
    return <LoadingView />;
  }

  if (isApproved) {
    return <ApprovedView />;
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
