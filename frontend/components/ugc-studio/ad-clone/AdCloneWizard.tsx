"use client";

import { useCallback, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  adCloneStepAtom,
  adCloneCanProceedAtom,
  adCloneErrorAtom,
  adCloneStatusAtom,
  adCloneCharacterIdAtom,
  adCloneVoiceIdAtom,
  adCloneSelectedScriptAtom,
  AdCloneStep,
} from "@/store/adClone";
import { useAdClone } from "@/hooks/useAdClone";
import { AdCloneUploadStep } from "./AdCloneUploadStep";
import { AdCloneScriptStep } from "./AdCloneScriptStep";
import { AdCloneStoryboardStep } from "./AdCloneStoryboardStep";
import { AdCloneCharacterVoiceStep } from "./AdCloneCharacterVoiceStep";
import { AdCloneGenerateStep } from "./AdCloneGenerateStep";

interface AdCloneWizardProps {
  teamId: number;
}

const STEPS: { key: AdCloneStep; label: string; icon: string }[] = [
  { key: "upload", label: "Upload", icon: "solar:upload-bold-duotone" },
  { key: "script", label: "Script", icon: "solar:document-text-bold-duotone" },
  { key: "character", label: "Character & Voice", icon: "solar:user-speak-bold-duotone" },
  { key: "storyboard", label: "Storyboard", icon: "solar:gallery-bold-duotone" },
  { key: "generate", label: "Generate", icon: "solar:clapperboard-play-bold-duotone" },
];

export function AdCloneWizard({ teamId }: AdCloneWizardProps) {
  const [step, setStep] = useAtom(adCloneStepAtom);
  const canProceed = useAtomValue(adCloneCanProceedAtom);
  const error = useAtomValue(adCloneErrorAtom);
  const status = useAtomValue(adCloneStatusAtom);
  const characterId = useAtomValue(adCloneCharacterIdAtom);
  const voiceId = useAtomValue(adCloneVoiceIdAtom);
  const selectedScript = useAtomValue(adCloneSelectedScriptAtom);

  const {
    createProject,
    startAnalyzeAndScript,
    generateVideo,
    updateScript,
    reset,
  } = useAdClone(teamId);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const handleContinue = useCallback(async () => {
    try {
      switch (step) {
        case "upload":
          const newProjectId = await createProject();
          if (newProjectId) {
            await startAnalyzeAndScript(newProjectId);
          }
          break;
        case "script":
          if (selectedScript) {
            await updateScript(selectedScript);
          }
          setStep("character");
          break;
        case "character":
          setStep("storyboard");
          break;
        case "storyboard":
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
  }, [step, createProject, startAnalyzeAndScript, generateVideo, updateScript, selectedScript, setStep]);

  const handleBack = useCallback(() => {
    switch (step) {
      case "script":
        setStep("upload");
        break;
      case "character":
        setStep("script");
        break;
      case "storyboard":
        setStep("character");
        break;
      case "generate":
        setStep("storyboard");
        break;
      default:
        break;
    }
  }, [step, setStep]);

  const canGoBack = ["script", "storyboard", "character", "generate"].includes(step);

  useEffect(() => {
    if (step === "character") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

  const renderStepContent = () => {
    switch (step) {
      case "upload":
        return <AdCloneUploadStep teamId={teamId} onContinue={handleContinue} />;
      case "script":
        return <AdCloneScriptStep teamId={teamId} />;
      case "storyboard":
        return <AdCloneStoryboardStep teamId={teamId} />;
      case "character":
        return <AdCloneCharacterVoiceStep teamId={teamId} />;
      case "generate":
        return <AdCloneGenerateStep teamId={teamId} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
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

      {renderStepContent()}

      {!["upload", "generate"].includes(step) && status !== "analyzing" && status !== "generating_script" && (
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
            isDisabled={step === "character" && (!characterId || !voiceId)}
            onPress={handleContinue}
            className="px-8 bg-orange-500 text-white"
            endContent={<Icon icon="solar:arrow-right-linear" width={18} />}
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
