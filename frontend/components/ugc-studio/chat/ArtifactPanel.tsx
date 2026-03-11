"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CharacterStep } from "@/components/ugc-studio/actors/CharacterStep";
import { AudioStep } from "@/components/ugc-studio/voice";
import type { ArtifactType } from "./types";
import type { Character } from "@/components/ugc-studio/actors/types";

interface ArtifactPanelProps {
  currentArtifact: ArtifactType;
  selectedCharacter: Character | null;
  onCharacterSelect: (character: Character | null) => void;
  onContinue: () => void;
  teamId?: number;
}

export function ArtifactPanel({
  currentArtifact,
  selectedCharacter,
  onCharacterSelect,
  onContinue,
  teamId,
}: ArtifactPanelProps) {
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

        {currentArtifact === "under-construction" && (
          <motion.div
            key="under-construction"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-warning-500/10 flex items-center justify-center">
              <Icon icon="solar:buildings-bold-duotone" className="text-warning-500" width={40} />
            </div>
            <h3 className="text-xl font-bold text-text-primary">Under Construction</h3>
            <p className="text-text-secondary text-sm max-w-sm">
              Storyboard and video generation steps are coming soon.
              The remaining wizard flow will be integrated here.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
