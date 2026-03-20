"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@heroui/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { AdCloneChatInterface } from "@/components/ugc-studio/chat/AdCloneChatInterface";

function AdCloneCreateContent() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  if (!selectedTeam) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  return <AdCloneChatInterface resumeProjectId={projectId} />;
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
