"use client";

import { useAtomValue } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { videoStateAtom } from "@/store/videoState";
import {
  SCENE_TYPE_CONFIG,
  type SceneType,
} from "@/components/ugc-studio/script/types";

interface SceneMentionDropdownProps {
  query: string;
  onSelect: (mention: string) => void;
}

export function SceneMentionDropdown({
  query,
  onSelect,
}: SceneMentionDropdownProps) {
  const videoState = useAtomValue(videoStateAtom);
  const scenes = videoState.scenes;

  if (scenes.length === 0) return null;

  const lowerQuery = query.toLowerCase();

  const items: { label: string; mention: string; icon: string; color: string }[] = [];

  for (const scene of scenes) {
    const config = SCENE_TYPE_CONFIG[scene.sceneType as SceneType];
    const sceneLabel = `Scene ${scene.sceneNumber} - ${config?.label ?? scene.sceneType}`;
    const sceneMention = `@Scene ${scene.sceneNumber} `;

    if (!lowerQuery || sceneLabel.toLowerCase().includes(lowerQuery) || `scene ${scene.sceneNumber}`.includes(lowerQuery)) {
      items.push({
        label: sceneLabel,
        mention: sceneMention,
        icon: config?.icon ?? "solar:widget-bold-duotone",
        color: config?.color ?? "bg-default-500/10 text-default-400",
      });
    }

    if (scene.bRollShots) {
      for (let i = 0; i < scene.bRollShots.length; i++) {
        const shot = scene.bRollShots[i];
        const shotLabel = `Scene ${scene.sceneNumber} Shot ${i + 1}`;
        const shotMention = `@Scene ${scene.sceneNumber} Shot ${i + 1} `;

        if (!lowerQuery || shotLabel.toLowerCase().includes(lowerQuery) || shot.action.toLowerCase().includes(lowerQuery)) {
          items.push({
            label: `${shotLabel} - ${shot.action.slice(0, 40)}${shot.action.length > 40 ? "..." : ""}`,
            mention: shotMention,
            icon: "solar:camera-bold-duotone",
            color: "bg-amber-500/10 text-amber-400",
          });
        }
      }
    }
  }

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.1 }}
      className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-surface-elevated border border-border-base rounded-xl shadow-xl overflow-hidden z-20 max-h-48 overflow-y-auto"
    >
      {items.slice(0, 10).map((item) => (
        <button
          key={item.mention}
          onClick={() => onSelect(item.mention)}
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/[0.04] transition-colors text-left"
        >
          <div
            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${item.color}`}
          >
            <Icon icon={item.icon} width={11} />
          </div>
          <span className="text-xs text-text-primary truncate">{item.label}</span>
        </button>
      ))}
    </motion.div>
  );
}
