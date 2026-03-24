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

import { sceneBuilderAPI } from "@/api/sceneBuilder";
import { sceneImagesAtom, type SceneImageState } from "@/store/ugc";
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
    restoreProject,
    selectedCharacterRef,
    teamIdRef,
  } = useAdCloneChatAgent();

  const resetAdClone = useSetAtom(resetAdCloneAtom);
  const resetUGC = useSetAtom(resetUGCAtom);
  const setVideoState = useSetAtom(videoStateAtom);
  const videoState = useAtomValue(videoStateAtom);
  const setSceneImages = useSetAtom(sceneImagesAtom);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    resetUGC();
    resetAdClone();

    if (!resumeProjectId) return;

    adCloneAPI.getProject(resumeProjectId).then(async (response) => {
      if (!response.success) return;
      const { project, scripts } = response;
      const script = scripts?.[project.selectedVariantIndex ?? 0];

      if (script?.scenes) {
        const ugcScriptId = (script as any)._scriptId || resumeProjectId;
        restoreProject(resumeProjectId, ugcScriptId);

        setVideoState({
          scriptId: ugcScriptId,
          teamId: teamId,
          scenes: script.scenes,
          character: null,
          voice: null,
          videoType: "ugc",
          isSilent: !script.scenes.some((s: any) => s.dialogue?.trim()),
          hasCharacter: true,
          targetAudience: script.targetAudience ?? "",
          productImageKeys: [],
          userDirection: "",
          structureBlueprint: null,
          customPattern: null,
          freshStart: true,
          isGeneratingScript: false,
          threadId: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });

        try {
          const imgRes = await sceneBuilderAPI.getSceneImages(ugcScriptId);
          if (imgRes.success) {
            const restored: Record<string, SceneImageState> = {};
            for (const [sceneId, img] of Object.entries(imgRes.sceneImages)) {
              const imgAny = img as any;
              restored[sceneId] = {
                status: "completed",
                imageKey: img.image_key,
                imageUrl: img.imageUrl,
                generatedImages: imgAny.generatedImages,
              };
            }
            setSceneImages(restored);
          }
        } catch {}
      } else {
        restoreProject(resumeProjectId);
      }
    }).catch(() => {
      resetAdClone();
    });
  }, []);

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
    if (!teamId || !projectId) return;
    setIsStartingGeneration(true);
    try {
      await adCloneAPI.generateVideo(projectId, {
        teamId,
        voiceId: videoState.voice!.id,
        characterId: videoState.character!.id,
      });
      router.push(`/dashboard/ugc-studio/ad-clone/${projectId}`);
    } catch (err) {
      console.error("Failed to start video generation:", err);
      setIsStartingGeneration(false);
    }
  }, [teamId, projectId, videoState.voice, videoState.character, router]);

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
            hasScript={!!scriptId}
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
