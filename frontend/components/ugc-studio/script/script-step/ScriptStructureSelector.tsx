"use client";

import { Button, Select, ListBox, Tooltip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SCRIPT_STRUCTURES, SCENE_TYPES, SceneType, ShotType } from "../types";
import type { CustomPatternStep } from "./types";

interface ScriptStructureSelectorProps {
  selectedStructureId: string;
  customPattern: CustomPatternStep[];
  onStructureChange: (structureId: string) => void;
  onCustomPatternChange: (pattern: CustomPatternStep[]) => void;
  autoStructureReasoning?: string;
  autoStructureName?: string;
  isGeneratingAutoStructure?: boolean;
  isAutoSilent?: boolean;
}

export function ScriptStructureSelector({
  selectedStructureId,
  customPattern,
  onStructureChange,
  onCustomPatternChange,
  autoStructureReasoning,
  autoStructureName,
  isGeneratingAutoStructure,
  isAutoSilent,
}: ScriptStructureSelectorProps) {
  const showCustomBuilder = selectedStructureId === "custom" || (selectedStructureId === "auto" && customPattern.length > 0 && !isGeneratingAutoStructure);

  const addScene = () => {
    if (customPattern.length >= 8) return;
    onCustomPatternChange([...customPattern, { type: "demo", shot: isAutoSilent ? "visual" : "b-roll" }]);
  };

  const removeScene = (index: number) => {
    if (customPattern.length <= 1) return;
    onCustomPatternChange(customPattern.filter((_, i) => i !== index));
  };

  const updateSceneType = (index: number, type: SceneType) => {
    const newPattern = [...customPattern];
    newPattern[index].type = type;
    onCustomPatternChange(newPattern);
  };

  const updateShotType = (index: number, shot: ShotType | "visual") => {
    const newPattern = [...customPattern];
    newPattern[index].shot = shot;
    onCustomPatternChange(newPattern);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
        <Icon icon="solar:video-frame-bold-duotone" width={20} className="text-accent-400" />
        Script Structure
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {SCRIPT_STRUCTURES.map((structure) => (
          <div
            key={structure.id}
            onClick={() => onStructureChange(structure.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
              selectedStructureId === structure.id
                ? "border-accent-400 bg-accent-400/10"
                : "border-border-base bg-surface-elevated hover:border-accent-400/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon
                icon={structure.icon}
                width={20}
                className={selectedStructureId === structure.id ? "text-accent-400" : "text-text-muted"}
              />
              <span className="font-medium text-text-primary text-sm">{structure.name}</span>
            </div>
            <p className="text-xs text-text-secondary mb-2">{structure.description}</p>
            <div className="flex flex-wrap gap-1">
              {structure.bestFor.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-surface-base text-text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedStructureId === "auto" && isGeneratingAutoStructure && (
        <div className="bg-surface-base rounded-lg p-4 border border-border-base flex items-center justify-center gap-3">
          <Spinner size="sm" color="current" />
          <p className="text-sm text-text-secondary">Analyzing your direction and picking the best structure...</p>
        </div>
      )}

      {selectedStructureId === "auto" && !isGeneratingAutoStructure && customPattern.length === 0 && (
        <div className="bg-surface-base rounded-lg p-4 border border-border-base text-center space-y-2">
          <Icon icon="solar:magic-stick-3-bold-duotone" width={24} className="text-accent-400 mx-auto" />
          <p className="text-sm text-text-secondary">
            Fill in your script direction below, then click <span className="text-accent-400 font-medium">Generate Structure</span> to let AI pick the optimal structure.
          </p>
        </div>
      )}

      {selectedStructureId === "auto" && autoStructureReasoning && !isGeneratingAutoStructure && customPattern.length > 0 && (
        <div className="bg-accent-400/5 rounded-lg p-3 border border-accent-400/20">
          <div className="flex items-center gap-2 mb-1">
            <Icon icon="solar:magic-stick-3-bold-duotone" width={16} className="text-accent-400" />
            <span className="text-sm font-medium text-accent-400">{autoStructureName || "AI-Generated Structure"}</span>
            {isAutoSilent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium flex items-center gap-1">
                <Icon icon="solar:volume-cross-bold" width={12} />
                Silent Mode
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary">{autoStructureReasoning}</p>
        </div>
      )}

      {showCustomBuilder ? (
        <div className="bg-surface-base rounded-lg p-4 border border-border-base space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-primary">Build your structure:</p>
              <Tooltip
 content={
 <div className="max-w-xs p-2 text-xs space-y-2">
 <p className="font-medium">Shot Types:</p>
 <p><span className="text-green-400 font-medium">A-roll</span> — Primary footage of the speaker talking directly to camera. Use for hooks, testimonials, and CTAs.</p>
 <p><span className="text-blue-400 font-medium">B-roll</span> — Supplementary footage like product shots, demos, or cutaways. Use for demos and visual variety.</p>
 <p><span className="text-purple-400 font-medium">Mixed</span> — Combines both A-roll and B-roll in a single scene for dynamic transitions.</p>
 <p><span className="text-amber-400 font-medium">Visual</span> — Silent scene with no voiceover. Tells the story through visuals only — products, environments, actions.</p>
 </div>
 }
 placement="right"
 >
                <div className="cursor-help">
                  <Icon icon="solar:info-circle-linear" className="text-text-muted" width={16} />
                </div>
              </Tooltip>
            </div>
            <Button
 size="sm"
 variant="tertiary"
 className="text-accent-400"
 onPress={addScene}
 isDisabled={customPattern.length >= 8}
 >
              <Icon icon="solar:add-circle-linear" width={16} />
              Add Scene
            </Button>
          </div>
          <div className="space-y-2">
            {customPattern.map((step, i) => (
              <div key={i} className="flex items-center gap-2 bg-surface-elevated p-2 rounded-lg">
                <span className="text-xs text-text-muted w-5">{i + 1}.</span>
                <Select
 aria-label="Scene type"
 value={step.type}
 onChange={(val) => {
 if (val) updateSceneType(i, val as SceneType);
 }}
 className="flex-1"
 >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {SCENE_TYPES.map((type) => (
                        <ListBox.Item key={type} id={type} textValue={type} className="capitalize">
                          {type}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Select
 aria-label="Shot type"
 value={step.shot}
 isDisabled={isAutoSilent}
 onChange={(val) => {
 if (val) updateShotType(i, val as ShotType | "visual");
 }}
 className="w-28"
 >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="a-roll" textValue="A-roll" className="text-green-400">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:user-speak-bold" width={14} />
                          <span>A-roll</span>
                        </div>
                      </ListBox.Item>
                      <ListBox.Item id="b-roll" textValue="B-roll" className="text-blue-400">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:videocamera-record-bold" width={14} />
                          <span>B-roll</span>
                        </div>
                      </ListBox.Item>
                      <ListBox.Item id="mixed" textValue="Mixed" className="text-purple-400">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:layers-bold" width={14} />
                          <span>Mixed</span>
                        </div>
                      </ListBox.Item>
                      <ListBox.Item id="visual" textValue="Visual" className="text-amber-400">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:gallery-minimalistic-bold" width={14} />
                          <span>Visual</span>
                        </div>
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 onPress={() => removeScene(i)}
 isDisabled={customPattern.length <= 1}
 className="text-text-muted hover:text-red-400 min-w-7 w-7 h-7"
 >
                  <Icon icon="solar:trash-bin-minimalistic-linear" width={16} />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-muted">Min 1 scene, max 8. Start with hook, end with CTA.</p>
        </div>
      ) : selectedStructureId !== "auto" ? (
        <div className="bg-surface-base rounded-lg p-3 border border-border-base">
          <p className="text-xs text-text-muted mb-2">Structure breakdown:</p>
          <div className="flex flex-wrap gap-2">
            {SCRIPT_STRUCTURES.find((s) => s.id === selectedStructureId)?.pattern.map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 text-xs bg-surface-elevated px-2 py-1 rounded"
              >
                <span className="text-text-muted">{i + 1}.</span>
                <span className="text-text-primary capitalize">{step.type}</span>
                <span className={`text-[10px] px-1 rounded ${
                  step.shot === "a-roll" ? "bg-green-500/20 text-green-400" :
                  step.shot === "b-roll" ? "bg-blue-500/20 text-blue-400" :
                  "bg-purple-500/20 text-purple-400"
                }`}>
                  {step.shot}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
