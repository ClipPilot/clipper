"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import { motion } from "framer-motion";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { sceneImagesAtom, resetUGCAtom } from "@/store/ugc";
import { resetAdCloneAtom } from "@/store/adClone";
import { currentStepAtom, videoStateAtom, isReady } from "@/store/videoState";
import { ugcScriptAPI } from "@/api/ugc";
import { ugcVideoAPI } from "@/api/ugc/video";
import { adCloneAPI } from "@/api/adClone";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import { useTeams } from "@/hooks/useTeams";
import { useChatAgent } from "./useChatAgent";
import { MessageList } from "./MessageList";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { ImageDropZone } from "./ImageDropZone";
import { ArtifactPanel } from "./ArtifactPanel";
import { ExistingScriptsDrawer } from "./ExistingScriptsDrawer";
import type { Character } from "@/components/ugc-studio/actors/types";

const MIN_CHAT_PCT = 25;
const MAX_CHAT_PCT = 75;

export function ChatInterface({ resumeScriptId }: { resumeScriptId?: string | null }) {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const teamId = selectedTeam?.id ?? null;

  const {
    messages,
    isThinking,
    isAnalyzing,
    adCloneStep,
    videoState,
    videoAttachment,
    setVideoAttachment,
    adCloneProjectId,
    scriptGenFailed,
    sendMessage,
    acceptStructure,
    retryStructure,
    generateScript,
    updateScene,
    confirmCharacter,
    confirmCharacters,
    regenerateAllImages,
    selectedCharacterRef,
    selectedCharactersRef,
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

      const restoredCharacters = response.charactersConfig
        ? response.charactersConfig.map((c) => ({
            character: { id: c.characterId } as Character,
            voiceId: c.voiceId ?? undefined,
          }))
        : [];

      const restoredRoles = response.charactersConfig
        ? response.charactersConfig.map((c) => (c as any).role || "")
        : [];

      setVideoState({
        scriptId: resumeScriptId,
        teamId: teamId,
        scenes: script?.scenes ?? [],
        character: null,
        characters: restoredCharacters,
        characterCount: response.characterCount ?? (response.hasCharacter ? 1 : 0),
        characterRoles: restoredRoles,
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

  const urlSyncReady = useRef(false);
  useEffect(() => {
    if (!urlSyncReady.current) {
      urlSyncReady.current = true;
      return;
    }
    if (videoState.scriptId && videoState.scriptId !== resumeScriptId) {
      router.replace(`/dashboard/ugc-studio/ai-video-creator/create?scriptId=${videoState.scriptId}`, { scroll: false });
    }
  }, [videoState.scriptId]);

  const isImagesGenerating = Object.values(sceneImages).some(
    (img) => img.status === "generating" || img.status === "regenerating",
  );
  const isChatDisabled = isThinking || isAnalyzing;

  const scenesReady =
    isReady(videoState) &&
    Object.keys(sceneImages).length > 0 &&
    !isImagesGenerating &&
    videoState.scenes.every((s) => sceneImages[s.id]?.status === "completed");

  const chatInputRef = useRef<ChatInputHandle>(null);
  const savedCharacterIdRef = useRef<number | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [showExistingScripts, setShowExistingScripts] = useState(false);
  const [mode, setMode] = useState<"scratch" | "clone">(resumeScriptId ? "scratch" : "scratch");
  const showModePicker = messages.length <= 1 && !videoState.scriptId && !isAnalyzing;

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
      const voiceConfig = videoState.characters.length > 1
        ? videoState.characters.map((c) => ({
            characterId: c.character.id,
            voiceId: c.voiceId || "",
          }))
        : undefined;

      const result = await ugcVideoAPI.generateVideo({
        teamId,
        scriptId: videoState.scriptId,
        voiceId: videoState.voice?.id,
        voiceConfig,
        isSilent: videoState.isSilent,
      });
      if (adCloneProjectId) {
        adCloneAPI.linkVideoJob(adCloneProjectId, result.jobId).catch(() => {});
      }
      router.push(`/dashboard/ugc-studio/ai-video-creator/${result.jobId}`);
    } catch (err) {
      console.error("Failed to start video generation:", err);
      setIsStartingGeneration(false);
    }
  }, [teamId, videoState.scriptId, videoState.voice, videoState.isSilent, adCloneProjectId, router]);

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
    if (videoState.characterCount > 1 && selectedCharacter) {
      const updated = [...videoState.characters, { character: selectedCharacter }];
      confirmCharacters(updated);
      setSelectedCharacter(null);
    } else {
      confirmCharacter();
      if (resumeScriptId && selectedCharacter && savedCharacterIdRef.current !== selectedCharacter.id) {
        setSceneImages({});
      }
    }
  }, [confirmCharacter, confirmCharacters, videoState.characterCount, videoState.characters, selectedCharacter, resumeScriptId, setSceneImages]);

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
          characters: [],
          characterCount: 1,
          characterRoles: [],
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
      <div className="flex items-center justify-between px-4 h-14 border-b border-border-base shrink-0">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="tertiary"
            size="sm"
            onPress={() => router.push("/dashboard/ugc-studio/ai-video-creator")}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <Icon icon="solar:arrow-left-linear" className="text-text-secondary" width={20} />
          </Button>
          <h1 className="text-lg font-semibold text-text-primary">Create Video</h1>
        </div>
        <Button
 variant="outline"
 size="sm"
 className="border-border-base text-text-secondary"
 onPress={() => setShowExistingScripts(true)}
 >
          <Icon icon="solar:document-text-bold" width={16} />
          Use Existing Script
        </Button>
      </div>

      <div ref={containerRef} className="flex-1 flex min-h-0">
        <motion.div
          layout
          className="flex flex-col min-h-0"
          animate={{ width: isPanelMode ? `${chatWidthPct}%` : "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <ImageDropZone onDrop={handleDropFiles} isDisabled={isChatDisabled}>
            <MessageList
              messages={messages}
              isThinking={isThinking && !adCloneStep}
              acceptedResult={videoState.structureBlueprint}
              onAccept={handleAccept}
              onRetry={retryStructure}
              adCloneStep={adCloneStep}
              scenesReady={!!scenesReady}
              onGenerateVideo={handleContinueToGenerate}
              isGenerateLoading={isStartingGeneration}
            />
          </ImageDropZone>
          {isImagesGenerating && (
            <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300 border border-yellow-500/30">
              <Icon icon="svg-spinners:pulse-3" className="text-yellow-400 text-lg shrink-0" />
              <span>Scene images are generating… editing is available once complete.</span>
            </div>
          )}
          {showModePicker && (
            <div className="px-4 pt-2 pb-0 shrink-0">
              <div className="max-w-2xl mx-auto flex gap-2">
                <div
                  onClick={() => { setMode("scratch"); setVideoAttachment(null); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    mode === "scratch"
                      ? "bg-accent-400/10 text-accent-400 border border-accent-400/30"
                      : "text-text-secondary border border-white/[0.06] hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon icon="solar:magic-stick-3-bold-duotone" width={14} />
                  Create from Scratch
                </div>
                <div
                  onClick={() => setMode("clone")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    mode === "clone"
                      ? "bg-amber-400/10 text-amber-400 border border-amber-400/30"
                      : "text-text-secondary border border-white/[0.06] hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon icon="solar:copy-bold-duotone" width={14} />
                  Clone an Ad
                </div>
              </div>
            </div>
          )}
          <ChatInput
            ref={chatInputRef}
            onSend={sendMessage}
            isDisabled={isChatDisabled}
            videoAttachment={videoAttachment}
            onVideoAttach={mode === "clone" ? setVideoAttachment : undefined}
            placeholder={mode === "clone" && !videoAttachment ? "Describe your product and attach a reference ad above..." : undefined}
          />
        </motion.div>

        {isPanelMode && (
          <div
            onMouseDown={handleDragStart}
            className="w-1 shrink-0 cursor-col-resize group relative z-10 flex items-center justify-center"
          >
            <div className="absolute inset-y-0 w-px bg-border-base group-hover:bg-accent-400/50 transition-colors" />
            <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
            <div className="relative z-10 w-3 h-8 rounded-full bg-surface-elevated border border-border-base group-hover:border-accent-400/50 flex items-center justify-center transition-colors">
              <Icon icon="solar:menu-dots-bold" width={8} className="text-text-muted rotate-90" />
            </div>
          </div>
        )}

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
              scriptGenFailed={scriptGenFailed}
            />
          </motion.div>
        )}
      </div>

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
