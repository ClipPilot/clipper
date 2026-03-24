"use client";

import { motion } from "framer-motion";
import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  SCENE_TYPE_CONFIG,
  type SceneType,
} from "@/components/ugc-studio/script/types";

const EMOTION_TAG_COLORS: Record<string, string> = {
  whispering: "text-purple-400",
  excited: "text-orange-400",
  curious: "text-cyan-400",
  sincere: "text-rose-400",
  playful: "text-yellow-400",
  dramatic: "text-red-400",
  satisfied: "text-green-400",
  amazed: "text-blue-400",
  laughing: "text-amber-400",
};

function highlightEmotionTags(dialogue: string) {
  if (!dialogue) return null;
  const parts = dialogue.split(/(\[[a-z]+\])/gi);
  return parts.map((part, i) => {
    const match = part.match(/^\[([a-z]+)\]$/i);
    if (match) {
      const tag = match[1].toLowerCase();
      const color = EMOTION_TAG_COLORS[tag] || "text-accent-400";
      return (
        <span key={i} className={`${color} font-semibold`}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface ExistingScriptPreviewProps {
  script: any;
}

function getSceneFields(scene: any) {
  const isAgentFormat = "storyBeat" in scene;

  const shotType: string = isAgentFormat ? scene.sceneType : scene.shotType;
  const storyBeat: string = isAgentFormat ? scene.storyBeat : scene.sceneType;
  const duration: number = isAgentFormat ? scene.duration : scene.estimatedDurationSeconds;
  const slug: string = scene.slug || "";
  const shots: any[] = isAgentFormat ? (scene.shots ?? []) : (scene.bRollShots ?? []);

  return { shotType, storyBeat, duration, slug, shots, isAgentFormat };
}

function SceneCard({ scene, index, total }: { scene: any; index: number; total: number }) {
  const { shotType, storyBeat, duration, slug, shots } = getSceneFields(scene);
  const config = SCENE_TYPE_CONFIG[storyBeat as SceneType];
  const isLast = index === total - 1;
  const isARoll = shotType === "a-roll";
  const hasBRollShots = shots.length > 0;

  return (
    <div key={scene.id || index}>
      <div
        className={`rounded-xl p-3 space-y-2.5 border ${
          config
            ? `${config.color.split(" ")[0].replace("/20", "/[0.06]")} border-white/[0.08]`
            : "bg-white/[0.02] border-white/[0.06]"
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${config?.color ?? "bg-default-500/10 text-default-400"}`}
          >
            <Icon icon={config?.icon ?? "solar:widget-bold-duotone"} width={14} />
          </div>
          <span className="text-[13px] font-semibold text-text-primary">
            {scene.sceneNumber}. {slug || config?.label || storyBeat}
          </span>
          <Chip
            size="sm"
            variant="flat"
            className={`text-[10px] h-5 ${
              isARoll
                ? "bg-blue-500/15 text-blue-400"
                : "bg-emerald-500/15 text-emerald-400"
            }`}
          >
            {shotType}
          </Chip>
          <span className="text-[11px] text-text-muted ml-auto font-medium">
            {duration}s
          </span>
        </div>

        {scene.dialogue && scene.dialogue.trim() && (
          <div className="text-[12px] text-text-secondary leading-relaxed bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.04]">
            <Icon icon="solar:chat-round-dots-bold" width={12} className="inline mr-1.5 text-text-muted opacity-60" />
            {highlightEmotionTags(scene.dialogue)}
          </div>
        )}

        {scene.action && (
          <p className="text-[11px] text-text-muted italic flex items-start gap-1.5">
            <Icon icon="solar:clapperboard-text-bold" width={12} className="shrink-0 mt-0.5 opacity-60" />
            {scene.action}
          </p>
        )}

        {scene.ambientSound && (
          <div className="flex items-start gap-1.5 text-[10px] text-text-muted/60">
            <Icon icon="solar:soundwave-bold" width={10} className="shrink-0 mt-0.5" />
            <span>{scene.ambientSound}</span>
          </div>
        )}

        {hasBRollShots && (
          <div className="border-t border-white/[0.06] pt-2.5 mt-1">
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider mb-2">
              <Icon icon="solar:camera-bold" width={11} />
              <span>{shots.length} Shot{shots.length > 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-1.5">
              {shots.map((shot: any, shotIdx: number) => {
                const shotTypeLabel = shot.shotType ?? "PRODUCT";
                const shotColor =
                  shotTypeLabel === "CHARACTER"
                    ? "text-blue-400 bg-blue-500/10"
                    : shotTypeLabel === "PRODUCT"
                      ? "text-amber-400 bg-amber-500/10"
                      : "text-purple-400 bg-purple-500/10";
                const shotIcon =
                  shotTypeLabel === "CHARACTER"
                    ? "solar:user-bold-duotone"
                    : shotTypeLabel === "PRODUCT"
                      ? "solar:box-minimalistic-bold-duotone"
                      : "solar:hand-stars-bold-duotone";
                const shotLabel = shot.label || shot.action || "";
                const shotDuration = shot.durationSeconds ?? 0;

                return (
                  <div
                    key={shotIdx}
                    className="flex items-center gap-2 text-[11px] bg-white/[0.02] rounded-lg px-2.5 py-1.5 border border-white/[0.04]"
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${shotColor}`}>
                      <Icon icon={shotIcon} width={11} />
                    </div>
                    <span className="flex-1 text-text-secondary">{shotLabel}</span>
                    {shotDuration > 0 && (
                      <span className="text-text-muted text-[10px] shrink-0">{shotDuration}s</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!isLast && (
        <div className="flex items-center ml-4">
          <div className="w-px h-3 bg-white/[0.08]" />
        </div>
      )}
    </div>
  );
}

export function ExistingScriptPreview({ script }: ExistingScriptPreviewProps) {
  const scenes = script.scenes || [];
  const totalDuration = script.totalDuration || script.totalEstimatedDuration ||
    scenes.reduce((sum: number, s: any) => sum + (s.duration || s.estimatedDurationSeconds || 0), 0);

  const aRollCount = scenes.filter((s: any) => {
    const st = s.storyBeat ? s.sceneType : s.shotType;
    return st === "a-roll";
  }).length;
  const bRollCount = scenes.length - aRollCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 h-full overflow-y-auto pb-8"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-accent-400 font-medium uppercase tracking-wider">
          <Icon icon="solar:document-text-bold" width={14} />
          Existing Script
        </div>
        <h2 className="text-lg font-bold text-text-primary">{script.title}</h2>
        {script.targetAudience && (
          <p className="text-xs text-text-muted">{script.targetAudience}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Chip size="sm" variant="flat" color="primary" className="text-[11px]">
            {Math.round(totalDuration)}s
          </Chip>
          <Chip size="sm" variant="flat" color="default" className="text-[11px]">
            {scenes.length} scenes
          </Chip>
          {aRollCount > 0 && (
            <Chip size="sm" variant="flat" className="text-[11px] bg-blue-500/10 text-blue-400">
              {aRollCount} a-roll
            </Chip>
          )}
          {bRollCount > 0 && (
            <Chip size="sm" variant="flat" className="text-[11px] bg-emerald-500/10 text-emerald-400">
              {bRollCount} b-roll
            </Chip>
          )}
          {script.viralScore > 0 && (
            <Chip size="sm" variant="flat" color="success" className="text-[11px]">
              {script.viralScore}/10
            </Chip>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {scenes.map((scene: any, index: number) => (
          <SceneCard
            key={scene.id || index}
            scene={scene}
            index={index}
            total={scenes.length}
          />
        ))}
      </div>
    </motion.div>
  );
}
