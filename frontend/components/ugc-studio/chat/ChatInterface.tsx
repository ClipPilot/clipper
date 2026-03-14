"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSetAtom } from "jotai";
import { motion } from "framer-motion";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { scriptIdAtom, scriptsAtom, selectedVariantIndexAtom } from "@/store/ugc";
import { ugcScriptAPI } from "@/api/ugc";
import { useTeams } from "@/hooks/useTeams";
import { useChatAgent } from "./useChatAgent";
import { MessageList } from "./MessageList";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { ImageDropZone } from "./ImageDropZone";
import { ArtifactPanel } from "./ArtifactPanel";
import { ExistingScriptsDrawer } from "./ExistingScriptsDrawer";
import type { Character } from "@/components/ugc-studio/actors/types";

export function ChatInterface() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const teamId = selectedTeam?.id ?? null;

  const {
    messages,
    isThinking,
    acceptedResult,
    currentArtifact,
    generatedScript,
    isGeneratingScript,
    isExistingScript,
    sendMessage,
    acceptStructure,
    advanceArtifact,
    retryStructure,
    generateScript,
    loadExistingScript,
    selectedCharacterRef,
    teamIdRef,
  } = useChatAgent();

  const chatInputRef = useRef<ChatInputHandle>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [showExistingScripts, setShowExistingScripts] = useState(false);

  selectedCharacterRef.current = selectedCharacter;
  teamIdRef.current = teamId;

  const setScriptId = useSetAtom(scriptIdAtom);
  const setScripts = useSetAtom(scriptsAtom);
  const setSelectedVariantIndex = useSetAtom(selectedVariantIndexAtom);

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

  const handleSelectExistingScript = useCallback(
    async (existingScriptId: string) => {
      try {
        const response = await ugcScriptAPI.getFullScript(existingScriptId);
        if (response.success) {
          setScripts(response.scripts);
          setSelectedVariantIndex(response.selectedVariantIndex);
          setScriptId(existingScriptId);
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
    [setScripts, setSelectedVariantIndex, setScriptId, loadExistingScript],
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 border-b border-border-base shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/ugc-studio/ai-video-creator")}
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <Icon icon="solar:arrow-left-linear" className="text-text-secondary" width={20} />
          </button>
          <h1 className="text-lg font-semibold text-text-primary">Create Video</h1>
        </div>
        <Button
          variant="bordered"
          size="sm"
          className="border-border-base text-text-secondary"
          startContent={<Icon icon="solar:document-text-bold" width={16} />}
          onPress={() => setShowExistingScripts(true)}
        >
          Use Existing Script
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        <motion.div
          layout
          className="flex flex-col min-h-0"
          animate={{ width: isPanelMode ? "40%" : "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <ImageDropZone onDrop={handleDropFiles} isDisabled={isThinking}>
            <MessageList
              messages={messages}
              isThinking={isThinking}
              acceptedResult={acceptedResult}
              onAccept={handleAccept}
              onRetry={retryStructure}
            />
          </ImageDropZone>
          <ChatInput
            ref={chatInputRef}
            onSend={sendMessage}
            isDisabled={isThinking}
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
              currentArtifact={currentArtifact}
              selectedCharacter={selectedCharacter}
              onCharacterSelect={setSelectedCharacter}
              onContinue={advanceArtifact}
              teamId={teamId ?? undefined}
              generatedScript={generatedScript}
              isGeneratingScript={isGeneratingScript}
              isExistingScript={isExistingScript}
              onGenerateScript={generateScript}
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
