"use client";

import { useAtomValue } from "jotai";
import { Card, CardBody, Progress, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  adCloneProgressAtom,
  adCloneProgressMessageAtom,
} from "@/store/adClone";

export function AdCloneAnalyzingStep() {
  const progress = useAtomValue(adCloneProgressAtom);
  const progressMessage = useAtomValue(adCloneProgressMessageAtom);

  const stages = [
    { label: "Uploading video", icon: "solar:upload-bold-duotone", threshold: 15 },
    { label: "Processing video", icon: "solar:cpu-bolt-bold-duotone", threshold: 30 },
    { label: "Analyzing scenes", icon: "solar:magnifer-bold-duotone", threshold: 60 },
    { label: "Extracting structure", icon: "solar:document-text-bold-duotone", threshold: 90 },
    { label: "Finalizing", icon: "solar:check-circle-bold-duotone", threshold: 100 },
  ];

  const currentStage = stages.findIndex((s) => progress < s.threshold);
  const activeStageIndex = currentStage === -1 ? stages.length - 1 : currentStage;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Spinner size="lg" color="warning" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-base border-2 border-orange-500 flex items-center justify-center">
                <Icon icon="solar:cpu-bolt-bold-duotone" className="text-orange-500" width={18} />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-text-primary">
                Analyzing Your Reference Ad
              </h2>
              <p className="text-text-secondary">
                Our AI is deconstructing your video scene by scene...
              </p>
            </div>

            <div className="w-full space-y-2">
              <Progress
                value={progress}
                color="warning"
                size="md"
                className="max-w-md mx-auto"
              />
              <p className="text-sm text-text-tertiary">
                {progressMessage || `${progress}% complete`}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Analysis Progress</h3>
          <div className="space-y-3">
            {stages.map((stage, index) => {
              const isComplete = progress >= stage.threshold;
              const isActive = index === activeStageIndex;

              return (
                <div key={stage.label} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isComplete
                        ? "bg-green-500/20 text-green-400"
                        : isActive
                          ? "bg-orange-500/20 text-orange-500"
                          : "bg-surface-elevated text-text-tertiary"
                    }`}
                  >
                    {isComplete ? (
                      <Icon icon="solar:check-circle-bold" width={18} />
                    ) : isActive ? (
                      <Spinner size="sm" color="warning" />
                    ) : (
                      <Icon icon={stage.icon} width={16} />
                    )}
                  </div>
                  <span
                    className={`text-sm ${
                      isComplete
                        ? "text-green-400"
                        : isActive
                          ? "text-text-primary font-medium"
                          : "text-text-tertiary"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <div className="text-center">
        <p className="text-xs text-text-tertiary">
          This typically takes 1-2 minutes depending on video length
        </p>
      </div>
    </div>
  );
}
