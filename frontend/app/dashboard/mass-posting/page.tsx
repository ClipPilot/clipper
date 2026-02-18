"use client";

import { useState, useEffect } from "react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
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
import { canAccessMassPosting } from "@/lib/plans";

export default function MassPostingPage() {
  const router = useRouter();
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

  if (!canAccessMassPosting(selectedTeam?.plan)) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 max-w-sm">
          <div className="relative">
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-accent-400/10">
              <Icon icon="solar:posts-carousel-vertical-bold-duotone" className="text-accent-400" width={40} />
            </div>
            <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full bg-surface-dark border-2 border-surface-dark">
              <Icon icon="solar:lock-keyhole-bold" className="text-text-tertiary" width={14} />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-text-primary">Mass Posting</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Automate posting across multiple platforms and manage all your content distribution in one place.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 w-full">
            <Button
              size="lg"
              className="w-full bg-accent-400 text-white font-semibold"
              onPress={() => router.push("/dashboard/pricing")}
              startContent={<Icon icon="solar:rocket-bold" width={18} />}
            >
              Upgrade to Creator
            </Button>
            <p className="text-xs text-text-tertiary">
              Available on all paid plans
            </p>
          </div>
        </div>
      </div>
    );
  }

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
