"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { MyVideoJobsSection } from "@/components/ugc-studio/video-jobs";
import { ugcScriptAPI } from "@/api/ugc";
import type { ScriptSummary } from "@/components/ugc-studio/script/types";


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

        {/* Drafts Section */}
        <DraftScriptsSection teamId={selectedTeam.id} />

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

function DraftScriptsSection({ teamId }: { teamId: number }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ScriptSummary[]>([]);

  useEffect(() => {
    ugcScriptAPI.listScripts(teamId, { limit: 10 }).then((res) => {
      if (res.success) setDrafts(res.scripts);
    }).catch(() => {});
  }, [teamId]);

  if (drafts.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Icon icon="solar:document-text-bold-duotone" className="text-amber-400" width={20} />
        <h2 className="text-lg font-semibold text-text-primary">Drafts</h2>
        <Chip size="sm" variant="flat" className="text-[11px]">{drafts.length}</Chip>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {drafts.map((script) => (
          <button
            key={script.id}
            onClick={() => router.push(`/dashboard/ugc-studio/ai-video-creator/create?scriptId=${script.id}`)}
            className="text-left p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-accent-400/20 transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-primary line-clamp-1 group-hover:text-accent-400 transition-colors">
                {script.title || "Untitled Script"}
              </h3>
              <Chip size="sm" variant="flat" className="text-[9px] bg-amber-500/10 text-amber-400 shrink-0 ml-2">
                Draft
              </Chip>
            </div>
            <p className="text-[11px] text-text-muted line-clamp-2 mb-2">{script.hook || script.scriptDirection || "No description"}</p>
            <div className="flex items-center gap-3 text-[10px] text-text-muted">
              <span>{script.sceneCount} scenes</span>
              <span>{Math.round(script.totalDuration)}s</span>
              <span>{new Date(script.createdAt).toLocaleDateString()}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
