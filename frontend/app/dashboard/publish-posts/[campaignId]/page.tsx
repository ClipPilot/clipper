"use client";

import { useParams, useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessMassPosting } from "@/lib/plans";
import { useMassPosting } from "@/hooks/useMassPosting";
import { LoadingView } from "@/components/mass-posting/StatusViews";
import { PlanUpgradeWall } from "@/components/mass-posting/PlanUpgradeWall";
import { CampaignDashboard } from "@/components/campaigns/CampaignDashboard";

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const { isApproved, isLoading: statusLoading } = useMassPosting();

  const campaignId = Number(params.campaignId);

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

  if (isNaN(campaignId)) {
    router.replace("/dashboard/publish-posts");
    return null;
  }

  return (
    <CampaignDashboard
      campaignId={campaignId}
      onBack={() => router.push("/dashboard/publish-posts")}
    />
  );
}
