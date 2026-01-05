"use client";

import { Button, Card, CardBody, Progress, RadioGroup, Radio } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SwapType } from "./types";

interface GeneratePanelProps {
  isProcessing: boolean;
  processingStatus: string;
  submittedJobId: string | null;
  error: string | null;
  hasVideo: boolean;
  hasCharacter: boolean;
  segmentCount: number;
  totalDuration: number;
  swapType: SwapType;
  onSwapTypeChange: (type: SwapType) => void;
  onGenerate: () => void;
  onClearSubmitted: () => void;
  onClearError: () => void;
}

export function GeneratePanel({
  isProcessing,
  processingStatus,
  submittedJobId,
  error,
  hasVideo,
  hasCharacter,
  segmentCount,
  totalDuration,
  swapType,
  onSwapTypeChange,
  onGenerate,
  onClearSubmitted,
  onClearError,
}: GeneratePanelProps) {
  const isValid = hasVideo && hasCharacter && segmentCount > 0 && totalDuration <= 50.01;

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-4">
        {isProcessing ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
                <Icon
                  icon="solar:cloud-upload-bold-duotone"
                  className="text-accent-400 animate-pulse"
                  width={22}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {processingStatus || "Processing..."}
                </p>
                <p className="text-xs text-text-tertiary">This may take a moment</p>
              </div>
            </div>
            <Progress isIndeterminate color="primary" size="sm" className="w-full" />
          </div>
        ) : submittedJobId ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Icon icon="solar:check-circle-bold-duotone" className="text-green-500" width={22} />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Job Submitted!</p>
                <p className="text-xs text-text-tertiary">Check progress below</p>
              </div>
            </div>
            <Button
              className="w-full bg-accent-400 text-white font-semibold"
              size="lg"
              onPress={onClearSubmitted}
              startContent={<Icon icon="solar:add-circle-bold" width={20} />}
            >
              Generate Clips
            </Button>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg">
              <Icon icon="solar:danger-circle-bold" className="text-red-500" width={20} />
              <p className="text-sm text-red-500">{error}</p>
            </div>
            <Button
              className="w-full bg-accent-400 text-white font-semibold"
              size="lg"
              onPress={onClearError}
              startContent={<Icon icon="solar:refresh-bold" width={20} />}
            >
              Try Again
            </Button>
          </div>
        ) : (
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
                  <div className="flex items-center gap-2">
                    <span>Face Swap</span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">Recommended</span>
                  </div>
                </Radio>
                <Radio value="fullBody" classNames={{ label: "text-sm" }}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span>Full Body Swap</span>
                      <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">Experimental</span>
                    </div>
                    <span className="text-[10px] text-text-tertiary mt-0.5">
                      May not work well with complex movements
                    </span>
                  </div>
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
                  Face swap applies to selected segments only. Gaps and edges keep original footage.
                </p>
              </div>
            )}

            <Button
              className="w-full bg-accent-400 text-white font-semibold"
              size="lg"
              isDisabled={!isValid}
              onPress={onGenerate}
              startContent={<Icon icon="solar:magic-stick-3-bold-duotone" width={20} />}
              endContent={<span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">5 Credits</span>}
            >
              Generate Face Swap
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
