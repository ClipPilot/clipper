"use client";

import { useCallback, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Progress, Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  adCloneStepAtom,
  adCloneCanProceedAtom,
  adCloneProgressAtom,
  adCloneProgressMessageAtom,
  adCloneErrorAtom,
  adCloneStatusAtom,
  AdCloneStep,
} from "@/store/adClone";
import { useAdClone } from "@/hooks/useAdClone";
import { AdCloneUploadStep } from "./AdCloneUploadStep";
import { AdCloneAnalyzingStep } from "./AdCloneAnalyzingStep";
import { AdCloneAnalysisStep } from "./AdCloneAnalysisStep";
import { AdCloneCharacterStep } from "./AdCloneCharacterStep";
import { AdCloneScriptStep } from "./AdCloneScriptStep";
import { AdCloneGenerateStep } from "./AdCloneGenerateStep";

interface AdCloneWizardProps {
  teamId: number;
}

const STEPS: { key: AdCloneStep; label: string; icon: string }[] = [
  { key: "upload", label: "Upload", icon: "solar:upload-bold-duotone" },
  { key: "analyzing", label: "Analyzing", icon: "solar:cpu-bolt-bold-duotone" },
  { key: "analysis", label: "Review", icon: "solar:magnifer-bold-duotone" },
  { key: "character", label: "Character", icon: "solar:user-rounded-bold-duotone" },
  { key: "script", label: "Script", icon: "solar:document-text-bold-duotone" },
  { key: "generate", label: "Generate", icon: "solar:clapperboard-play-bold-duotone" },
  { key: "preview", label: "Preview", icon: "solar:play-circle-bold-duotone" },
];

export function AdCloneWizard({ teamId }: AdCloneWizardProps) {
  const [step, setStep] = useAtom(adCloneStepAtom);
  const canProceed = useAtomValue(adCloneCanProceedAtom);
  const progress = useAtomValue(adCloneProgressAtom);
  const progressMessage = useAtomValue(adCloneProgressMessageAtom);
  const error = useAtomValue(adCloneErrorAtom);
  const status = useAtomValue(adCloneStatusAtom);

  const {
    createProject,
    startAnalysis,
    generateScript,
    generateVideo,
    reset,
  } = useAdClone(teamId);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const handleContinue = useCallback(async () => {
    try {
      switch (step) {
        case "upload":
          const newProjectId = await createProject();
          if (newProjectId) {
            await startAnalysis(newProjectId);
          }
          break;
        case "analysis":
          setStep("character");
          break;
        case "character":
          await generateScript();
          break;
        case "script":
          setStep("generate");
          break;
        case "generate":
          await generateVideo();
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("Step action failed:", err);
    }
  }, [step, createProject, startAnalysis, generateScript, generateVideo, setStep]);

  const handleBack = useCallback(() => {
    switch (step) {
      case "analysis":
        setStep("upload");
        break;
      case "character":
        setStep("analysis");
        break;
      case "script":
        setStep("character");
        break;
      case "generate":
        setStep("script");
        break;
      default:
        break;
    }
  }, [step, setStep]);

  const canGoBack = ["analysis", "character", "script", "generate"].includes(step);

  const renderStepContent = () => {
    switch (step) {
      case "upload":
        return <AdCloneUploadStep teamId={teamId} onContinue={handleContinue} />;
      case "analyzing":
        return <AdCloneAnalyzingStep />;
      case "analysis":
        return <AdCloneAnalysisStep />;
      case "character":
        return <AdCloneCharacterStep teamId={teamId} />;
      case "script":
        return <AdCloneScriptStep />;
      case "generate":
      case "preview":
        return <AdCloneGenerateStep teamId={teamId} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-4">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {STEPS.map((s, index) => {
              const isActive = s.key === step;
              const isCompleted = index < currentStepIndex;
              const isDisabled = index > currentStepIndex;

              return (
                <div
                  key={s.key}
                  className={`flex items-center gap-2 flex-shrink-0 ${
                    isDisabled ? "opacity-40" : ""
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-orange-500 text-white"
                        : isCompleted
                          ? "bg-green-500/20 text-green-400"
                          : "bg-surface-elevated text-text-tertiary"
                    }`}
                  >
                    {isCompleted ? (
                      <Icon icon="solar:check-circle-bold" width={20} />
                    ) : (
                      <Icon icon={s.icon} width={18} />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium hidden sm:block ${
                      isActive
                        ? "text-text-primary"
                        : isCompleted
                          ? "text-green-400"
                          : "text-text-tertiary"
                    }`}
                  >
                    {s.label}
                  </span>
                  {index < STEPS.length - 1 && (
                    <Icon
                      icon="solar:arrow-right-linear"
                      className="text-text-tertiary mx-1"
                      width={16}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Error Banner */}
      {error && (
        <Card className="bg-red-500/10 border border-red-500/30">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <Icon icon="solar:danger-triangle-bold" className="text-red-400" width={24} />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">Error</p>
                <p className="text-sm text-red-300">{error}</p>
              </div>
              <Button
                size="sm"
                variant="flat"
                className="bg-red-500/20 text-red-400"
                onPress={() => reset()}
              >
                Start Over
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step Content */}
      {renderStepContent()}

      {/* Navigation */}
      {!["upload", "analyzing", "generate", "preview"].includes(step) && (
        <div className="flex items-center justify-between">
          {canGoBack ? (
            <Button
              variant="flat"
              className="bg-surface-base text-text-secondary"
              onPress={handleBack}
              startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            >
              Back
            </Button>
          ) : (
            <div />
          )}
          <Button
            size="lg"
            isDisabled={
              (step === "upload" && !canProceed) ||
              (step === "script" && status === "generating_script")
            }
            onPress={handleContinue}
            className="px-8 bg-orange-500 text-white"
            endContent={<Icon icon="solar:arrow-right-linear" width={18} />}
          >
            {step === "script" ? "Generate Video" : "Continue"}
          </Button>
        </div>
      )}
    </div>
  );
}
