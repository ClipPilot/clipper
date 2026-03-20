"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useTeams } from "@/hooks/useTeams";
import { useAdCloneChatAgent } from "./useAdCloneChatAgent";
import { MessageList } from "./MessageList";
import { AdCloneChatInput, type AdCloneChatInputHandle } from "./AdCloneChatInput";
import { ImageDropZone } from "./ImageDropZone";
import { ArtifactPanel } from "./ArtifactPanel";
import type { Character } from "@/components/ugc-studio/actors/types";

export function AdCloneChatInterface() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const teamId = selectedTeam?.id ?? null;

  const {
    messages,
    isThinking,
    isAnalyzing,
    acceptedResult,
    currentArtifact,
    generatedScript,
    isGeneratingScript,
    scriptId,
    videoAttachment,
    setVideoAttachment,
    sendMessage,
    acceptStructure,
    advanceArtifact,
    retryStructure,
    generateScript,
    selectedCharacterRef,
    teamIdRef,
  } = useAdCloneChatAgent();

  const chatInputRef = useRef<AdCloneChatInputHandle>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  selectedCharacterRef.current = selectedCharacter;
  teamIdRef.current = teamId;

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
              currentArtifact={currentArtifact}
              selectedCharacter={selectedCharacter}
              onCharacterSelect={setSelectedCharacter}
              onContinue={advanceArtifact}
              teamId={teamId ?? undefined}
              generatedScript={generatedScript}
              isGeneratingScript={isGeneratingScript}
              isExistingScript={false}
              onGenerateScript={generateScript}
              mode="storyboard"
              scriptId={scriptId}
              theme="orange"
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
