"use client";

import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { ScalePlanRequired } from "@/components/ugc-studio";
import { AdCloneUploadStep } from "@/components/ugc-studio/ad-clone/AdCloneUploadStep";

export default function AdClonePage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const router = useRouter();

  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return <ScalePlanRequired currentPlan={selectedTeam?.plan || "free"} />;
  }

  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            isIconOnly
            onPress={() => router.push("/dashboard/ugc-studio")}
            className="text-text-secondary hover:text-text-primary"
          >
            <Icon icon="solar:arrow-left-linear" width={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Ad Clone</h1>
            <p className="text-text-secondary text-sm">
              Clone winning ads with your own product
            </p>
          </div>
        </div>

        <AdCloneUploadStep teamId={selectedTeam.id} />
      </div>
    </div>
  );
}
