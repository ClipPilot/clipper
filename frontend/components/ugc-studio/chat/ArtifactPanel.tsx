"use client";

import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import { CharacterStep } from "@/components/ugc-studio/actors/CharacterStep";
import { AudioStep } from "@/components/ugc-studio/voice";
import { ScriptPreview } from "./ScriptPreview";
import { ExistingScriptPreview } from "./ExistingScriptPreview";
import { ScriptLoadingState } from "./ScriptLoadingState";
import { StoryboardPreview } from "./StoryboardPreview";
import { scriptsAtom, selectedVariantIndexAtom } from "@/store/ugc";
import type { ArtifactType, ScriptAgentResult } from "./types";
import type { Character } from "@/components/ugc-studio/actors/types";
import type { ChatColorTheme } from "./MessageCard";

interface ArtifactPanelProps {
  currentArtifact: ArtifactType;
  selectedCharacter: Character | null;
  onCharacterSelect: (character: Character | null) => void;
  onContinue: () => void;
  teamId?: number;
  generatedScript: ScriptAgentResult | null;
  isGeneratingScript: boolean;
  isExistingScript?: boolean;
  onGenerateScript: () => void;
  mode?: "script" | "storyboard";
  scriptId?: string | null;
  theme?: ChatColorTheme;
}

export function ArtifactPanel({
  currentArtifact,
  selectedCharacter,
  onCharacterSelect,
  onContinue,
  teamId,
  generatedScript,
  isGeneratingScript,
  isExistingScript,
  onGenerateScript,
  mode = "script",
  scriptId,
  theme = "default",
}: ArtifactPanelProps) {
  const scripts = useAtomValue(scriptsAtom);
  const selectedVariantIndex = useAtomValue(selectedVariantIndexAtom);
  const hasCalledGenerate = useRef(false);

  const shouldTriggerGenerate = mode === "storyboard"
    ? currentArtifact === "script" && !scriptId && !hasCalledGenerate.current
    : currentArtifact === "script" && !isExistingScript && !generatedScript && !isGeneratingScript && !hasCalledGenerate.current;

  if (shouldTriggerGenerate) {
    hasCalledGenerate.current = true;
    onGenerateScript();
  }

  const existingScript = scripts[selectedVariantIndex];

  const renderScriptContent = () => {
    if (isExistingScript && existingScript) {
      return <ExistingScriptPreview script={existingScript} />;
    }

    if (isGeneratingScript) {
      return <ScriptLoadingState />;
    }

    if (!generatedScript) return null;

    if (mode === "storyboard") {
      return (
        <StoryboardPreview
          script={generatedScript}
          scriptId={scriptId ?? null}
          teamId={teamId}
          characterId={selectedCharacter?.id}
          theme={theme}
        />
      );
    }

    return <ScriptPreview script={generatedScript} />;
  };

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-full flex flex-col border-l border-border-base bg-surface-dark overflow-y-auto"
    >
      <AnimatePresence mode="wait">
        {currentArtifact === "character" && (
          <motion.div
            key="character"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 p-4 overflow-y-auto"
          >
            <CharacterStep
              selectedCharacter={selectedCharacter}
              onCharacterSelect={onCharacterSelect}
              onContinue={onContinue}
            />
          </motion.div>
        )}

        {currentArtifact === "voice" && (
          <motion.div
            key="voice"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 p-4 overflow-y-auto"
          >
            <AudioStep onContinue={onContinue} teamId={teamId} />
          </motion.div>
        )}

        {currentArtifact === "script" && (
          <motion.div
            key="script"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 p-4 overflow-y-auto"
          >
            {renderScriptContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
