"use client";

import { useAtomValue } from "jotai";
import { Card, CardBody, Chip, Accordion, AccordionItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import { adCloneAnalysisAtom, AnalyzedScene } from "@/store/adClone";

const SHOT_TYPE_COLORS: Record<string, string> = {
  "a-roll": "bg-blue-500/20 text-blue-400",
  "b-roll": "bg-purple-500/20 text-purple-400",
  mixed: "bg-orange-500/20 text-orange-400",
};

const SCENE_TYPE_ICONS: Record<string, string> = {
  hook: "solar:magnet-bold-duotone",
  problem: "solar:danger-triangle-bold-duotone",
  solution: "solar:lightbulb-bolt-bold-duotone",
  demo: "solar:play-circle-bold-duotone",
  testimonial: "solar:chat-round-like-bold-duotone",
  cta: "solar:hand-shake-bold-duotone",
};

function SceneCard({ scene }: { scene: AnalyzedScene }) {
  return (
    <div className="p-4 bg-surface-elevated rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <span className="text-sm font-bold text-orange-500">{scene.sceneNumber}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Icon
                icon={SCENE_TYPE_ICONS[scene.sceneType] || "solar:video-frame-bold-duotone"}
                className="text-text-secondary"
                width={16}
              />
              <span className="text-sm font-medium text-text-primary capitalize">
                {scene.sceneType}
              </span>
            </div>
            <p className="text-xs text-text-tertiary">
              {scene.startTime.toFixed(1)}s - {scene.endTime.toFixed(1)}s ({scene.durationSeconds.toFixed(1)}s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip
            size="sm"
            className={SHOT_TYPE_COLORS[scene.shotType] || "bg-surface-base text-text-tertiary"}
          >
            {scene.shotType}
          </Chip>
          <Chip size="sm" className="bg-surface-base text-text-secondary">
            {scene.cameraAngle}
          </Chip>
        </div>
      </div>

      {scene.transcribedDialogue && (
        <div className="p-3 bg-surface-base rounded-lg">
          <p className="text-xs text-text-tertiary mb-1">Dialogue</p>
          <p className="text-sm text-text-primary italic">"{scene.transcribedDialogue}"</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-text-tertiary mb-1">Action</p>
          <p className="text-text-secondary">{scene.actionDescription}</p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-1">Setting</p>
          <p className="text-text-secondary">{scene.settingDescription}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Chip size="sm" variant="flat" className="bg-emerald-500/20 text-emerald-400">
          {scene.emotionalTone}
        </Chip>
        {scene.cameraMovement && (
          <Chip size="sm" variant="flat" className="bg-cyan-500/20 text-cyan-400">
            {scene.cameraMovement}
          </Chip>
        )}
      </div>

      {scene.visualElements.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scene.visualElements.map((el, i) => (
            <Chip key={i} size="sm" variant="flat" className="bg-surface-base text-text-tertiary">
              {el}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdCloneAnalysisStep() {
  const analysis = useAtomValue(adCloneAnalysisAtom);

  if (!analysis) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 text-center">
          <Icon icon="solar:danger-triangle-bold-duotone" className="text-yellow-400 mx-auto mb-4" width={48} />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Analysis Available</h3>
          <p className="text-text-secondary">Please go back and complete the video analysis first.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Icon icon="solar:check-circle-bold-duotone" className="text-green-400" width={22} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Analysis Complete</h3>
              <p className="text-xs text-text-tertiary">
                {analysis.scenes.length} scenes extracted • {analysis.totalDuration.toFixed(1)}s total
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-surface-elevated rounded-lg">
              <p className="text-xs text-text-tertiary">Style</p>
              <p className="text-sm font-medium text-text-primary">{analysis.overallStyle}</p>
            </div>
            <div className="p-3 bg-surface-elevated rounded-lg">
              <p className="text-xs text-text-tertiary">Aspect Ratio</p>
              <p className="text-sm font-medium text-text-primary">{analysis.aspectRatio}</p>
            </div>
            <div className="p-3 bg-surface-elevated rounded-lg">
              <p className="text-xs text-text-tertiary">Pacing</p>
              <p className="text-sm font-medium text-text-primary capitalize">{analysis.pacing}</p>
            </div>
            <div className="p-3 bg-surface-elevated rounded-lg">
              <p className="text-xs text-text-tertiary">Target</p>
              <p className="text-sm font-medium text-text-primary">{analysis.targetDemographic}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon icon="solar:magnet-bold-duotone" className="text-orange-400" width={18} />
              <h4 className="text-sm font-semibold text-text-primary">Hook Strategy</h4>
            </div>
            <p className="text-sm text-text-secondary">{analysis.hookStrategy}</p>
          </CardBody>
        </Card>
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon icon="solar:hand-shake-bold-duotone" className="text-cyan-400" width={18} />
              <h4 className="text-sm font-semibold text-text-primary">CTA Approach</h4>
            </div>
            <p className="text-sm text-text-secondary">{analysis.ctaApproach}</p>
          </CardBody>
        </Card>
      </div>

      {/* Key Strengths */}
      {analysis.keyStrengths.length > 0 && (
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon icon="solar:star-bold-duotone" className="text-yellow-400" width={18} />
              <h4 className="text-sm font-semibold text-text-primary">Key Strengths</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.keyStrengths.map((strength, i) => (
                <Chip key={i} size="sm" variant="flat" className="bg-yellow-500/10 text-yellow-400">
                  {strength}
                </Chip>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Scene Breakdown */}
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Icon icon="solar:layers-bold-duotone" className="text-purple-400" width={22} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Scene Breakdown</h3>
              <p className="text-xs text-text-tertiary">
                Your cloned ad will follow this exact structure
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {analysis.scenes.map((scene) => (
              <SceneCard key={scene.sceneNumber} scene={scene} />
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Narrative Summary */}
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:document-text-bold-duotone" className="text-blue-400" width={18} />
            <h4 className="text-sm font-semibold text-text-primary">Narrative Arc</h4>
          </div>
          <p className="text-sm text-text-secondary">{analysis.overallNarrative}</p>
        </CardBody>
      </Card>
    </div>
  );
}
