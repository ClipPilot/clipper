"use client";

import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import { CharacterStep } from "@/components/ugc-studio/actors/CharacterStep";
import { AudioStep } from "@/components/ugc-studio/voice";
import { ScriptPreview } from "./ScriptPreview";
import { ExistingScriptPreview } from "./ExistingScriptPreview";
import { ScriptLoadingState } from "./ScriptLoadingState";
import { scriptsAtom, selectedVariantIndexAtom } from "@/store/ugc";
import type { ArtifactType, ScriptAgentResult } from "./types";
import type { Character } from "@/components/ugc-studio/actors/types";

interface ArtifactPanelProps {
  currentArtifact: ArtifactType;
  selectedCharacter: Character | null;
  onCharacterSelect: (character: Character | null) => void;
  onContinue: () => void;
  teamId?: number;
  generatedScript: UGCScript | null;
  isGeneratingScript: boolean;
  isExistingScript?: boolean;
  onGenerateScript: () => void;
  onSceneUpdate: (sceneId: string, patch: Partial<UGCScene>) => void;
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
  onSceneUpdate,
}: ArtifactPanelProps) {
  const scripts = useAtomValue(scriptsAtom);
  const selectedVariantIndex = useAtomValue(selectedVariantIndexAtom);

  useEffect(() => {
    if (currentArtifact === "script" && !isExistingScript && !generatedScript && !isGeneratingScript) {
      onGenerateScript();
    }
  }, [currentArtifact, isExistingScript, generatedScript, isGeneratingScript, onGenerateScript]);

  const existingScript = scripts[selectedVariantIndex];

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-full flex flex-col border-l border-border-base bg-surface-dark overflow-hidden"
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
            className="flex-1 p-5 overflow-y-auto min-h-0"
          >
            {isExistingScript && existingScript ? (
              <ExistingScriptPreview script={existingScript} />
            ) : isGeneratingScript ? (
              <ScriptLoadingState />
            ) : generatedScript ? (
              <ScriptPreview script={generatedScript} onSceneUpdate={onSceneUpdate} />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
