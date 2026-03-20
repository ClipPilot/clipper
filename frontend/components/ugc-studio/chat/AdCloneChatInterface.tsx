"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useSetAtom } from "jotai";
import { useTeams } from "@/hooks/useTeams";
import { resetAdCloneAtom } from "@/store/adClone";
import { resetUGCAtom } from "@/store/ugc";
import { videoStateAtom } from "@/store/videoState";
import { useAtomValue } from "jotai";
import { adCloneAPI } from "@/api/adClone";
import { ugcVideoAPI } from "@/api/ugc/video";
import { useAdCloneChatAgent } from "./useAdCloneChatAgent";
import { MessageList } from "./MessageList";
import { AdCloneChatInput, type AdCloneChatInputHandle } from "./AdCloneChatInput";
import { ImageDropZone } from "./ImageDropZone";
import { ArtifactPanel } from "./ArtifactPanel";
import type { Character } from "@/components/ugc-studio/actors/types";

export function AdCloneChatInterface({ resumeProjectId }: { resumeProjectId?: string | null }) {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const teamId = selectedTeam?.id ?? null;

  const {
    messages,
    isThinking,
    isAnalyzing,
    acceptedResult,
    currentArtifact,
    scriptId,
    projectId,
    videoAttachment,
    setVideoAttachment,
    sendMessage,
    acceptStructure,
    confirmCharacter,
    retryStructure,
    generateScript,
    updateScene,
    regenerateAllImages,
    selectedCharacterRef,
    teamIdRef,
  } = useAdCloneChatAgent();

  const resetAdClone = useSetAtom(resetAdCloneAtom);
  const resetUGC = useSetAtom(resetUGCAtom);
  const videoState = useAtomValue(videoStateAtom);

  useEffect(() => {
    resetUGC();
    if (resumeProjectId) {
      adCloneAPI.getProject(resumeProjectId).then((response) => {
        if (!response.success) return;
        // The hook's loadProject would hydrate state from the project data
        // For now, the project data provides enough to resume
      }).catch((err) => {
        console.error("Failed to resume project:", err);
        resetAdClone();
      });
    } else {
      resetAdClone();
    }
  }, [resumeProjectId]);

  useEffect(() => {
    if (projectId && projectId !== resumeProjectId) {
      router.replace(`/dashboard/ugc-studio/ad-clone/create?projectId=${projectId}`, { scroll: false });
    }
  }, [projectId]);

  const chatInputRef = useRef<AdCloneChatInputHandle>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  selectedCharacterRef.current = selectedCharacter;
  teamIdRef.current = teamId;

  const [isStartingGeneration, setIsStartingGeneration] = useState(false);

  const handleContinueToGenerate = useCallback(async () => {
    if (!teamId || !scriptId) return;
    setIsStartingGeneration(true);
    try {
      const result = await ugcVideoAPI.generateVideo({
        teamId,
        scriptId,
        voiceId: videoState.voice?.id,
        isSilent: videoState.isSilent,
      });
      router.push(`/dashboard/ugc-studio/ai-video-creator/${result.jobId}`);
    } catch (err) {
      console.error("Failed to start video generation:", err);
      setIsStartingGeneration(false);
    }
  }, [teamId, scriptId, videoState.voice, videoState.isSilent, router]);

  const isPanelMode = currentArtifact !== null;

  const allImageKeys = messages
    .filter((m) => m.role === "user" && m.attachments)
    .flatMap((m) => m.attachments!.map((a) => a.key));

  const handleAccept = useCallback(
    (messageIndex: number) => {
      const message = messages[messageIndex];
      if (!message?.structureResult) return;
      acceptStructure(message.structureResult, allImageKeys);
    },
    [messages, allImageKeys, acceptStructure],
  );

  const handleDropFiles = useCallback(
    (files: File[]) => {
      chatInputRef.current?.addFiles(files);
    },
    [],
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 border-b border-border-base shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/ugc-studio/ad-clone")}
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <Icon icon="solar:arrow-left-linear" className="text-text-secondary" width={20} />
          </button>
          <h1 className="text-lg font-semibold text-text-primary">Clone Ad</h1>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <motion.div
          layout
          className="flex flex-col min-h-0"
          animate={{ width: isPanelMode ? "40%" : "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <ImageDropZone onDrop={handleDropFiles} isDisabled={isThinking || isAnalyzing}>
            <MessageList
              messages={messages}
              isThinking={isThinking || isAnalyzing}
              acceptedResult={acceptedResult}
              onAccept={handleAccept}
              onRetry={retryStructure}
              theme="orange"
            />
          </ImageDropZone>
          <AdCloneChatInput
            ref={chatInputRef}
            onSend={sendMessage}
            isDisabled={isThinking || isAnalyzing}
            videoAttachment={videoAttachment}
            onVideoAttach={setVideoAttachment}
          />
        </motion.div>

        {isPanelMode && currentArtifact && (
          <motion.div
            layout
            className="min-h-0"
            initial={{ width: 0 }}
            animate={{ width: "60%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <ArtifactPanel
              selectedCharacter={selectedCharacter}
              onCharacterSelect={setSelectedCharacter}
              onCharacterConfirm={confirmCharacter}
              teamId={teamId ?? undefined}
              onGenerateScript={generateScript}
              onSceneUpdate={updateScene}
              onGenerateImages={regenerateAllImages}
              onContinue={handleContinueToGenerate}
              isContinueLoading={isStartingGeneration}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
