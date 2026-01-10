"use client";

import { Card, CardBody, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { MyVideoJobsSection } from "@/components/ugc-studio/video-jobs";


export default function AIVideoCreatorPage() {
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);

  const handleCreateNew = () => {
    router.push("/dashboard/ugc-studio/ai-video-creator/create");
  };

  // Check if user has access to UGC Studio
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
              AI Video Creator requires a Scale plan or higher.
              Upgrade to unlock this feature.
            </p>
            <Button
              className="bg-accent-400 text-white font-semibold"
              onPress={() => router.push("/dashboard/pricing")}
            >
              View Plans
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.push("/dashboard/ugc-studio")}
                className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
              >
                <Icon icon="solar:arrow-left-linear" className="text-text-secondary" width={20} />
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">AI Video Creator</h1>
            </div>
            <p className="text-text-secondary ml-10">
              Create professional UGC ads in minutes with AI-powered video generation
            </p>
          </div>
          <Button
            size="lg"
            className="bg-accent-400 text-white font-semibold px-6"
            startContent={<Icon icon="solar:add-circle-bold" width={20} />}
            onPress={handleCreateNew}
          >
            Create New Ad
          </Button>
        </div>

        {/* My Videos Section - Full Width */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Icon icon="solar:video-library-bold-duotone" className="text-accent-400" width={24} />
            <h2 className="text-xl font-semibold text-text-primary">My Videos</h2>
          </div>
          <MyVideoJobsSection teamId={selectedTeam.id} />
        </div>
      </div>
    </div>
  );
}
