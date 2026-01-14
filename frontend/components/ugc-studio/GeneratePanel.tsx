"use client";

import { Button, Card, CardBody, RadioGroup, Radio } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SwapType } from "./types";

interface GeneratePanelProps {
  hasVideo: boolean;
  hasCharacter: boolean;
  segmentCount: number;
  totalDuration: number;
  swapType: SwapType;
  onSwapTypeChange: (type: SwapType) => void;
  onGenerate: () => void;
  onAutoDetectAndGenerate?: () => void;
  showEditor?: boolean;
  onToggleEditor?: () => void;
}

export function GeneratePanel({
  hasVideo,
  hasCharacter,
  segmentCount,
  totalDuration,
  swapType,
  onSwapTypeChange,
  onGenerate,
  onAutoDetectAndGenerate,
  showEditor = false,
  onToggleEditor,
}: GeneratePanelProps) {
  const isValid = hasVideo && hasCharacter && segmentCount > 0 && totalDuration <= 50.01;
  const canAutoGenerate = hasVideo && hasCharacter;

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${hasVideo ? "bg-green-500" : "bg-surface-elevated"}`} />
              <span className={`text-sm ${hasVideo ? "text-text-primary" : "text-text-tertiary"}`}>
                Video uploaded
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${hasCharacter ? "bg-green-500" : "bg-surface-elevated"}`} />
              <span className={`text-sm ${hasCharacter ? "text-text-primary" : "text-text-tertiary"}`}>
                Character uploaded
              </span>
            </div>
            {showEditor ? (
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    hasVideo && segmentCount > 0 && totalDuration <= 50.01 ? "bg-green-500" : "bg-surface-elevated"
                  }`}
                />
                <span
                  className={`text-sm ${
                    hasVideo && segmentCount > 0 && totalDuration <= 50.01 ? "text-text-primary" : "text-text-tertiary"
                  }`}
                >
                  {segmentCount} segment{segmentCount !== 1 ? "s" : ""} (≤50s)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${hasVideo && hasCharacter ? "bg-purple-500" : "bg-surface-elevated"}`} />
                <span className={`text-sm ${hasVideo && hasCharacter ? "text-purple-400" : "text-text-tertiary"}`}>
                  Auto-detect faces on generate
                </span>
              </div>
            )}
          </div>

          <div className="p-3 bg-surface-elevated rounded-lg space-y-3">
            <p className="text-xs font-medium text-text-secondary">Swap Mode</p>
            <RadioGroup
              value={swapType}
              onValueChange={(value) => onSwapTypeChange(value as SwapType)}
              size="sm"
              classNames={{
                wrapper: "gap-2",
              }}
            >
              <Radio value="face" classNames={{ label: "text-sm" }}>
                <span>Face Swap</span>
              </Radio>
              <Radio value="full" classNames={{ label: "text-sm" }}>
                <span>Full Body Swap</span>
              </Radio>
            </RadioGroup>
          </div>

          <div className="p-3 bg-surface-elevated rounded-lg space-y-2">
            <p className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <Icon icon="solar:lightbulb-bolt-bold" className="text-yellow-400" width={14} />
              Tips for best results
            </p>
            <ul className="text-xs text-text-tertiary space-y-1 pl-5 list-disc">
              <li>Use clips with clear faces looking at the camera</li>
              <li>Avoid videos with text overlays or captions</li>
              <li>Ensure good lighting on the face</li>
            </ul>
          </div>

          {segmentCount >= 2 && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <Icon icon="solar:layers-bold" className="text-blue-400" width={16} />
                <span className="text-sm font-medium text-blue-400">Full Video Mode</span>
              </div>
              <p className="text-xs text-text-secondary">
                Swap applies to selected segments only. Gaps and edges keep original footage.
              </p>
            </div>
          )}

          {!showEditor && onAutoDetectAndGenerate && (
            <Button
              className="w-full bg-purple-500 text-white font-semibold"
              size="lg"
              isDisabled={!canAutoGenerate}
              onPress={onAutoDetectAndGenerate}
              startContent={<Icon icon="solar:face-scan-circle-bold" width={20} />}
              endContent={<span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">5 Credits</span>}
            >
              Auto-detect & Generate
            </Button>
          )}

          {showEditor && onToggleEditor && (
            <Button
              className="w-full bg-purple-500/20 text-purple-400 font-medium"
              size="lg"
              variant="flat"
              onPress={onToggleEditor}
              startContent={<Icon icon="solar:face-scan-circle-bold" width={20} />}
            >
              Back to Auto-detect
            </Button>
          )}

          {showEditor && (
            <Button
              className="w-full bg-accent-400 text-white font-semibold"
              size="lg"
              isDisabled={!isValid}
              onPress={onGenerate}
              startContent={<Icon icon="solar:magic-stick-3-bold-duotone" width={20} />}
              endContent={<span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">5 Credits</span>}
            >
              Generate
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
