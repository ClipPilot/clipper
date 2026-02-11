"use client";

import { Suspense, useEffect, useState } from "react";
import { Card, CardBody, Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { resetAdCloneAtom } from "@/store/adClone";
import { canAccessUGCStudio } from "@/lib/plans";
import { AdCloneWizard } from "@/components/ugc-studio/ad-clone/AdCloneWizard";
import { useAdClone } from "@/hooks/useAdClone";

function AdCloneCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const resetAdClone = useSetAtom(resetAdCloneAtom);
  const { loadProject, setCharacterId, setStep } = useAdClone(selectedTeam?.id);

  const [isLoading, setIsLoading] = useState(true);

  const projectIdToResume = searchParams.get("projectId");
  const newCharacterId = searchParams.get("newCharacterId");

  useEffect(() => {
    setIsLoading(true);
    resetAdClone();

    const init = async () => {
      if (projectIdToResume) {
        try {
          await loadProject(projectIdToResume);
        } catch (err) {
          console.error("Failed to load project:", err);
          resetAdClone();
        }
      }

      if (newCharacterId) {
        setCharacterId(parseInt(newCharacterId, 10));
        setStep("character");
      }

      setIsLoading(false);
    };

    init();
  }, [projectIdToResume, newCharacterId, loadProject, resetAdClone, setCharacterId, setStep]);

  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center p-4">
        <Card className="bg-surface-base border border-border-base max-w-md">
          <CardBody className="p-8 text-center">
            <Icon
              icon="solar:lock-bold-duotone"
              className="text-amber-400 mx-auto mb-4"
              width={48}
            />
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Scale Plan Required
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              Ad Clone requires a Scale plan or higher. Upgrade to unlock this
              feature.
            </p>
            <Button
              className="bg-orange-500 text-white font-semibold"
              onPress={() => router.push("/dashboard/pricing")}
            >
              View Plans
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push("/dashboard/ugc-studio/ad-clone")}
              className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
            >
              <Icon
                icon="solar:arrow-left-linear"
                className="text-text-secondary"
                width={20}
              />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
              Clone New Ad
            </h1>
          </div>
          <p className="text-text-secondary ml-10">
            Upload a reference ad and create your own version with AI
          </p>
        </div>

        <AdCloneWizard teamId={selectedTeam.id} />
      </div>
    </div>
  );
}

export default function AdCloneCreatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-dark flex items-center justify-center">
          <Spinner size="lg" color="warning" />
        </div>
      }
    >
      <AdCloneCreateContent />
    </Suspense>
  );
}
