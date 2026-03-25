"use client";

import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import { useMassPosting } from "@/hooks/useMassPosting";
import { LoadingView, ApprovedView } from "@/components/mass-posting/StatusViews";
import { PlanUpgradeWall } from "@/components/mass-posting/PlanUpgradeWall";
import { canAccessMassPosting } from "@/lib/plans";

export default function MassPostingPage() {
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const { isApproved, isLoading } = useMassPosting();

  if (!canAccessMassPosting(selectedTeam?.plan)) {
    return (
      <PlanUpgradeWall
        title="Posts Published"
        description="Track your queued and published posts across all platforms. Available on Studio plan and above."
        icon="solar:checklist-minimalistic-bold-duotone"
      />
    );
  }

  if (isLoading) {
    return <LoadingView />;
  }

  if (isApproved) {
    return <ApprovedView />;
  }

  return (
    <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10">
          <Icon
            icon="solar:clipboard-check-bold-duotone"
            className="text-amber-500"
            width={40}
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-text-accent">
            Complete Setup First
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            You need to complete the distribution setup before viewing
            published posts. Head to Publish Posts to get started.
          </p>
        </div>
        <Button
 size="lg"
 className="w-full bg-accent-400 text-white font-semibold"
 onPress={() => router.push("/dashboard/publish-posts")}
 >
          <Icon icon="solar:arrow-right-bold" width={18} />
          Go to Publish Posts
        </Button>
      </div>
    </div>
  );
}
