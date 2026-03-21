"use client";

import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import { CharacterStep } from "@/components/ugc-studio/actors/CharacterStep";
import { AudioStep } from "@/components/ugc-studio/voice";
import { ScriptPreview } from "./ScriptPreview";
import { ExistingScriptPreview } from "./ExistingScriptPreview";
import { ScriptLoadingState } from "./ScriptLoadingState";
import { scriptsAtom, selectedVariantIndexAtom, sceneImagesAtom } from "@/store/ugc";
import { currentStepAtom, videoStateAtom } from "@/store/videoState";
import type { UGCScene } from "@/components/ugc-studio/script/types";
import type { Character } from "@/components/ugc-studio/actors/types";

interface ArtifactPanelProps {
  selectedCharacter: Character | null;
  onCharacterSelect: (character: Character | null) => void;
  onCharacterConfirm: () => void;
  teamId?: number;
  onGenerateScript: () => void;
  onSceneUpdate: (sceneId: string, patch: Partial<UGCScene>) => void;
  onGenerateImages?: () => void;
  onContinue?: () => void;
  isContinueLoading?: boolean;
}

export function ArtifactPanel({
  selectedCharacter,
  onCharacterSelect,
  onCharacterConfirm,
  teamId,
  onGenerateScript,
  onSceneUpdate,
  onGenerateImages,
  onContinue,
  isContinueLoading,
}: ArtifactPanelProps) {
  const step = useAtomValue(currentStepAtom);
  const videoState = useAtomValue(videoStateAtom);
  const scripts = useAtomValue(scriptsAtom);
  const selectedVariantIndex = useAtomValue(selectedVariantIndexAtom);

  const isExistingScript = !!videoState.scriptId && !videoState.structureBlueprint && videoState.scenes.length === 0;
  const hasGeneratedScript = videoState.scenes.length > 0;

  const sceneImages = useAtomValue(sceneImagesAtom);
  const hasTriggeredImageGen = useRef(false);

  const shouldGenerate =
    step === "script" &&
    !isExistingScript &&
    !videoState.isGeneratingScript &&
    ((!hasGeneratedScript && videoState.structureBlueprint) ||
      (hasGeneratedScript && !videoState.scriptId));

  useEffect(() => {
    if (shouldGenerate) onGenerateScript();
  }, [shouldGenerate, onGenerateScript]);

  const noImages = hasGeneratedScript && Object.keys(sceneImages).length === 0;
  const anyGenerating = Object.values(sceneImages).some(
    (s) => s.status === "generating" || s.status === "regenerating",
  );

  useEffect(() => {
    if (
      step === "script" &&
      noImages &&
      !anyGenerating &&
      !hasTriggeredImageGen.current &&
      onGenerateImages
    ) {
      hasTriggeredImageGen.current = true;
      onGenerateImages();
    }
  }, [step, noImages, anyGenerating, onGenerateImages]);

  const existingScript = scripts[selectedVariantIndex];

  const generatedScript =
    hasGeneratedScript
      ? {
          title: videoState.targetAudience
            ? `Script for ${videoState.targetAudience}`
            : "Generated Script",
          hook: videoState.scenes[0]?.dialogue || "",
          targetAudience: videoState.targetAudience,
          totalEstimatedDuration: videoState.scenes.reduce(
            (sum, s) => sum + s.estimatedDurationSeconds,
            0,
          ),
          scenes: videoState.scenes,
          viralScore: 0,
          viralReasoning: "",
          productMentions: [],
        }
      : null;

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-full flex flex-col border-l border-border-base bg-surface-dark overflow-hidden"
    >
      <AnimatePresence mode="wait">
        {step === "character" && (
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
              onContinue={onCharacterConfirm}
            />
          </motion.div>
        )}

        {step === "voice" && (
          <motion.div
            key="voice"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 p-4 overflow-y-auto"
          >
            <AudioStep teamId={teamId} />
          </motion.div>
        )}

        {step === "script" && (
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
            ) : videoState.isGeneratingScript ? (
              <ScriptLoadingState />
            ) : generatedScript ? (
              <ScriptPreview
                script={generatedScript}
                onSceneUpdate={onSceneUpdate}
                onGenerateImages={onGenerateImages}
                onContinue={onContinue}
                isContinueLoading={isContinueLoading}
              />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
