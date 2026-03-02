"use client";

import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessMassPosting } from "@/lib/plans";
import { useMassPosting } from "@/hooks/useMassPosting";
import { LoadingView } from "@/components/mass-posting/StatusViews";
import { PlanUpgradeWall } from "@/components/mass-posting/PlanUpgradeWall";
import { IntakeForm } from "@/components/mass-posting/IntakeForm";

export default function CreateCampaignPage() {
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const { isApproved, isLoading: statusLoading } = useMassPosting();

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

  if (!isApproved) {
    router.replace("/dashboard/publish-posts");
    return <LoadingView />;
  }

  return (
    <IntakeForm
      teamId={selectedTeam?.id ?? null}
      isAppeal={false}
      mode="create"
      onSubmitted={(campaignId) => {
        if (campaignId) {
          router.push(`/dashboard/publish-posts/${campaignId}`);
        } else {
          router.push("/dashboard/publish-posts");
        }
      }}
    />
  );
}
