"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import { motion } from "framer-motion";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { sceneImagesAtom, resetUGCAtom } from "@/store/ugc";
import { resetAdCloneAtom } from "@/store/adClone";
import { currentStepAtom, videoStateAtom } from "@/store/videoState";
import { ugcScriptAPI } from "@/api/ugc";
import { ugcVideoAPI } from "@/api/ugc/video";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import { useTeams } from "@/hooks/useTeams";
import { useChatAgent } from "./useChatAgent";
import { MessageList } from "./MessageList";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { ImageDropZone } from "./ImageDropZone";
import { ArtifactPanel } from "./ArtifactPanel";
import { ExistingScriptsDrawer } from "./ExistingScriptsDrawer";
import type { Character } from "@/components/ugc-studio/actors/types";

/** Minimum width percentage for each panel */
const MIN_CHAT_PCT = 25;
const MAX_CHAT_PCT = 75;

export function ChatInterface({ resumeScriptId }: { resumeScriptId?: string | null }) {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const teamId = selectedTeam?.id ?? null;

  const {
    messages,
    isThinking,
    videoState,
    sendMessage,
    acceptStructure,
    retryStructure,
    generateScript,
    updateScene,
    confirmCharacter,
    regenerateAllImages,
    selectedCharacterRef,
    teamIdRef,
  } = useChatAgent();

  const step = useAtomValue(currentStepAtom);
  const setVideoState = useSetAtom(videoStateAtom);
  const sceneImages = useAtomValue(sceneImagesAtom);
  const setSceneImages = useSetAtom(sceneImagesAtom);
  const resetUGC = useSetAtom(resetUGCAtom);
  const resetAdClone = useSetAtom(resetAdCloneAtom);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    resetUGC();
    resetAdClone();

    if (!resumeScriptId) return;

    ugcScriptAPI.getFullScript(resumeScriptId).then(async (response) => {
      if (!response.success) return;
      const script = response.scripts[response.selectedVariantIndex];
      savedCharacterIdRef.current = response.characterId ?? null;

      setVideoState({
        scriptId: resumeScriptId,
        teamId: teamId,
        scenes: script?.scenes ?? [],
        character: null,
        voice: null,
        videoType: response.videoType,
        isSilent: response.isSilent,
        hasCharacter: response.hasCharacter,
        targetAudience: script?.targetAudience ?? "",
        productImageKeys: [],
        userDirection: "",
        structureBlueprint: null,
        customPattern: null,
        freshStart: true,
        isGeneratingScript: false,
        threadId: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });

      try {
        const imgRes = await sceneBuilderAPI.getSceneImages(resumeScriptId);
        if (imgRes.success) {
          const restored: Record<string, import("@/store/ugc").SceneImageState> = {};
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
    }).catch(() => {
      resetUGC();
    });
  }, []);

  useEffect(() => {
    if (videoState.scriptId && videoState.scriptId !== resumeScriptId) {
      router.replace(`/dashboard/ugc-studio/ai-video-creator/create?scriptId=${videoState.scriptId}`, { scroll: false });
    }
  }, [videoState.scriptId]);

  const isImagesGenerating = Object.values(sceneImages).some(
    (img) => img.status === "generating" || img.status === "regenerating",
  );
  const isChatDisabled = isThinking;

  const chatInputRef = useRef<ChatInputHandle>(null);
  const savedCharacterIdRef = useRef<number | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(
    null,
  );
  const [showExistingScripts, setShowExistingScripts] = useState(false);

  const [chatWidthPct, setChatWidthPct] = useState(40);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  selectedCharacterRef.current = selectedCharacter;
  teamIdRef.current = teamId;

  const [isStartingGeneration, setIsStartingGeneration] = useState(false);

  const handleContinueToGenerate = useCallback(async () => {
    if (!teamId || !videoState.scriptId) return;
    setIsStartingGeneration(true);
    try {
      const result = await ugcVideoAPI.generateVideo({
        teamId,
        scriptId: videoState.scriptId,
        voiceId: videoState.voice?.id,
        isSilent: videoState.isSilent,
      });
      router.push(`/dashboard/ugc-studio/ai-video-creator/${result.jobId}`);
    } catch (err) {
      console.error("Failed to start video generation:", err);
      setIsStartingGeneration(false);
    }
  }, [teamId, videoState.scriptId, videoState.voice, videoState.isSilent, router]);

  const isPanelMode = step !== null;

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

  const handleCharacterConfirm = useCallback(() => {
    confirmCharacter();

    if (resumeScriptId && selectedCharacter && savedCharacterIdRef.current !== selectedCharacter.id) {
      setSceneImages({});
    }
  }, [confirmCharacter, resumeScriptId, selectedCharacter, setSceneImages]);

  const handleDropFiles = useCallback((files: File[]) => {
    chatInputRef.current?.addFiles(files);
  }, []);

  const handleSelectExistingScript = useCallback(
    async (existingScriptId: string) => {
      try {
        const response = await ugcScriptAPI.getFullScript(existingScriptId);
        if (!response.success) return;
        const script = response.scripts[response.selectedVariantIndex];
        setVideoState({
          scriptId: existingScriptId,
          teamId: teamId,
          scenes: script?.scenes ?? [],
          character: null,
          voice: null,
          videoType: response.videoType,
          isSilent: response.isSilent,
          hasCharacter: response.hasCharacter,
          targetAudience: script?.targetAudience ?? "",
          productImageKeys: [],
          userDirection: "",
          structureBlueprint: null,
          customPattern: null,
          freshStart: true,
          isGeneratingScript: false,
          threadId: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
        savedCharacterIdRef.current = response.characterId ?? null;
        setShowExistingScripts(false);

        sceneBuilderAPI.getSceneImages(existingScriptId).then((imgRes) => {
          if (!imgRes.success) return;
          const restored: Record<string, import("@/store/ugc").SceneImageState> = {};
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
        }).catch(() => {});
      } catch (err) {
        console.error("Failed to load existing script:", err);
      }
    },
    [setVideoState, setSceneImages, teamId],
  );

  /* -- Drag-to-resize handlers ---------------------------------------- */
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setChatWidthPct(Math.min(MAX_CHAT_PCT, Math.max(MIN_CHAT_PCT, pct)));
    };

    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border-base shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              router.push("/dashboard/ugc-studio/ai-video-creator")
            }
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <Icon
              icon="solar:arrow-left-linear"
              className="text-text-secondary"
              width={20}
            />
          </button>
          <h1 className="text-lg font-semibold text-text-primary">
            Create Video
          </h1>
        </div>
        <Button
          variant="bordered"
          size="sm"
          className="border-border-base text-text-secondary"
          startContent={
            <Icon icon="solar:document-text-bold" width={16} />
          }
          onPress={() => setShowExistingScripts(true)}
        >
          Use Existing Script
        </Button>
      </div>

      {/* Main content area */}
      <div ref={containerRef} className="flex-1 flex min-h-0">
        {/* Chat panel */}
        <motion.div
          layout
          className="flex flex-col min-h-0"
          animate={{ width: isPanelMode ? `${chatWidthPct}%` : "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <ImageDropZone onDrop={handleDropFiles} isDisabled={isChatDisabled}>
            <MessageList
              messages={messages}
              isThinking={isThinking}
              acceptedResult={videoState.structureBlueprint}
              onAccept={handleAccept}
              onRetry={retryStructure}
            />
          </ImageDropZone>
          <ChatInput
            ref={chatInputRef}
            onSend={sendMessage}
            isDisabled={isChatDisabled}
            placeholder={isImagesGenerating ? "Scene images are generating... editing is available once complete." : undefined}
          />
        </motion.div>

        {/* Resize handle */}
        {isPanelMode && (
          <div
            onMouseDown={handleDragStart}
            className="w-1 shrink-0 cursor-col-resize group relative z-10 flex items-center justify-center"
          >
            {/* Visible track */}
            <div className="absolute inset-y-0 w-px bg-border-base group-hover:bg-accent-400/50 transition-colors" />
            {/* Wider hit area */}
            <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
            {/* Grab indicator */}
            <div className="relative z-10 w-3 h-8 rounded-full bg-surface-elevated border border-border-base group-hover:border-accent-400/50 flex items-center justify-center transition-colors">
              <Icon
                icon="solar:menu-dots-bold"
                width={8}
                className="text-text-muted rotate-90"
              />
            </div>
          </div>
        )}

        {/* Artifact panel */}
        {isPanelMode && step && (
          <motion.div
            layout
            className="min-h-0 h-full overflow-hidden"
            initial={{ width: 0 }}
            animate={{ width: `${100 - chatWidthPct}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <ArtifactPanel
              selectedCharacter={selectedCharacter}
              onCharacterSelect={setSelectedCharacter}
              onCharacterConfirm={handleCharacterConfirm}
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

      {/* Existing scripts drawer */}
      {teamId && (
        <ExistingScriptsDrawer
          isOpen={showExistingScripts}
          onClose={() => setShowExistingScripts(false)}
          teamId={teamId}
          onSelectScript={handleSelectExistingScript}
        />
      )}
    </div>
  );
}
