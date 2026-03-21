"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import { motion } from "framer-motion";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { scriptsAtom, selectedVariantIndexAtom, sceneImagesAtom, resetUGCAtom } from "@/store/ugc";
import { resetAdCloneAtom } from "@/store/adClone";
import { currentStepAtom, videoStateAtom } from "@/store/videoState";
import { ugcScriptAPI } from "@/api/ugc";
import { ugcVideoAPI } from "@/api/ugc/video";
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
    loadExistingScript,
    confirmCharacter,
    regenerateAllImages,
    selectedCharacterRef,
    teamIdRef,
  } = useChatAgent();

  const step = useAtomValue(currentStepAtom);
  const setVideoState = useSetAtom(videoStateAtom);
  const sceneImages = useAtomValue(sceneImagesAtom);
  const resetUGC = useSetAtom(resetUGCAtom);
  const resetAdClone = useSetAtom(resetAdCloneAtom);
  const setScripts = useSetAtom(scriptsAtom);
  const setSelectedVariantIndex = useSetAtom(selectedVariantIndexAtom);

  useEffect(() => {
    resetAdClone();
    if (resumeScriptId) {
      ugcScriptAPI.getFullScript(resumeScriptId).then((response) => {
        if (!response.success) return;
        setScripts(response.scripts);
        setSelectedVariantIndex(response.selectedVariantIndex);
        const script = response.scripts[response.selectedVariantIndex];
        setVideoState((prev) => ({
          ...prev,
          scriptId: resumeScriptId,
          scenes: script?.scenes ?? [],
          isSilent: response.isSilent,
          hasCharacter: response.hasCharacter,
          videoType: response.videoType,
          targetAudience: script?.targetAudience ?? "",
        }));
        loadExistingScript({
          isSilent: response.isSilent,
          hasCharacter: response.hasCharacter,
          videoType: response.videoType,
        });
      }).catch((err) => {
        console.error("Failed to resume script:", err);
        resetUGC();
      });
    } else {
      resetUGC();
    }
  }, [resumeScriptId]);

  useEffect(() => {
    if (videoState.scriptId && videoState.scriptId !== resumeScriptId) {
      router.replace(`/dashboard/ugc-studio/ai-video-creator/create?scriptId=${videoState.scriptId}`, { scroll: false });
    }
  }, [videoState.scriptId]);

  // Check if any scene images are currently generating
  const isImagesGenerating = Object.values(sceneImages).some(
    (img) => img.status === "generating" || img.status === "regenerating",
  );
  const isChatDisabled = isThinking || isImagesGenerating;

  const chatInputRef = useRef<ChatInputHandle>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(
    null,
  );
  const [showExistingScripts, setShowExistingScripts] = useState(false);

  // Resizable split state (percentage for chat panel)
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
  }, [confirmCharacter]);

  const handleDropFiles = useCallback((files: File[]) => {
    chatInputRef.current?.addFiles(files);
  }, []);

  const handleSelectExistingScript = useCallback(
    async (existingScriptId: string) => {
      try {
        const response = await ugcScriptAPI.getFullScript(existingScriptId);
        if (response.success) {
          setScripts(response.scripts);
          setSelectedVariantIndex(response.selectedVariantIndex);
          setVideoState((prev) => ({
            ...prev,
            scriptId: existingScriptId,
          }));
          loadExistingScript({
            isSilent: response.isSilent,
            hasCharacter: response.hasCharacter,
            videoType: response.videoType,
          });
          setShowExistingScripts(false);
        }
      } catch (err) {
        console.error("Failed to load existing script:", err);
      }
    },
    [
      setScripts,
      setSelectedVariantIndex,
      setVideoState,
      loadExistingScript,
    ],
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
          {isImagesGenerating && (
            <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-700 border border-warning-200">
              <Icon icon="svg-spinners:pulse-3" className="text-warning-500 text-lg shrink-0" />
              <span>Scene images are generating… editing is available once complete.</span>
            </div>
          )}
          <ChatInput
            ref={chatInputRef}
            onSend={sendMessage}
            isDisabled={isChatDisabled}
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
