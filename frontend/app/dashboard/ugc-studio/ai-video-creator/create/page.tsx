"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CharacterStep } from "@/components/ugc-studio/actors/CharacterStep";
import type { Character } from "@/components/ugc-studio/actors/types";

type WizardStep = "character" | "script" | "shot-plan" | "audio" | "generate";

const STEPS: { id: WizardStep; label: string; icon: string }[] = [
  { id: "character", label: "Character", icon: "solar:user-circle-bold-duotone" },
  { id: "script", label: "Script", icon: "solar:document-text-bold-duotone" },
  { id: "shot-plan", label: "Shot Plan", icon: "solar:clapperboard-bold-duotone" },
  { id: "audio", label: "Audio", icon: "solar:soundwave-bold-duotone" },
  { id: "generate", label: "Generate", icon: "solar:video-frame-play-bold-duotone" },
];

export default function CreateAdPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");

  const [currentStep, setCurrentStep] = useState<WizardStep>("character");
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case "character":
        return selectedCharacter !== null;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handleBack = () => {
    if (currentStepIndex === 0) {
      router.push("/dashboard/ugc-studio/ai-video-creator");
    } else {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  };

  const handleCharacterSelect = (character: Character | null) => {
    setSelectedCharacter(character);
  };

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="sticky top-0 z-50 bg-surface-dark/95 backdrop-blur-sm border-b border-border-base">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
              >
                <Icon icon="solar:arrow-left-linear" className="text-text-secondary" width={20} />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-text-primary">
                  {templateId ? "Create from Template" : "Create New Ad"}
                </h1>
                <p className="text-xs text-text-secondary">
                  Step {currentStepIndex + 1} of {STEPS.length}: {STEPS[currentStepIndex].label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="bordered"
                className="border-border-base text-text-secondary"
                onPress={() => router.push("/dashboard/ugc-studio/ai-video-creator")}
              >
                Cancel
              </Button>
              <Button
                className="bg-accent-400 text-white font-semibold"
                isDisabled={!canProceed()}
                onPress={handleNext}
                endContent={<Icon icon="solar:arrow-right-linear" width={16} />}
              >
                Continue
              </Button>
            </div>
          </div>
          <Progress
            value={progress}
            size="sm"
            classNames={{
              base: "h-1",
              track: "bg-surface-elevated",
              indicator: "bg-accent-400",
            }}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => index <= currentStepIndex && setCurrentStep(step.id)}
                disabled={index > currentStepIndex}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  step.id === currentStep
                    ? "bg-accent-400/20 text-accent-400"
                    : index < currentStepIndex
                      ? "text-text-secondary hover:bg-surface-elevated"
                      : "text-text-muted cursor-not-allowed"
                }`}
              >
                <Icon icon={step.icon} width={18} />
                <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <Icon
                  icon="solar:arrow-right-linear"
                  className={`mx-1 ${index < currentStepIndex ? "text-text-secondary" : "text-text-muted"}`}
                  width={14}
                />
              )}
            </div>
          ))}
        </div>

        {currentStep === "character" && (
          <CharacterStep
            selectedCharacter={selectedCharacter}
            onCharacterSelect={handleCharacterSelect}
            onContinue={handleNext}
          />
        )}

        {currentStep === "script" && (
          <div className="text-center py-20">
            <Icon icon="solar:document-text-bold-duotone" className="text-text-muted mx-auto mb-4" width={48} />
            <h2 className="text-xl font-semibold text-text-primary mb-2">Script Editor</h2>
            <p className="text-text-secondary">Coming soon - write your ad script here</p>
          </div>
        )}

        {currentStep === "shot-plan" && (
          <div className="text-center py-20">
            <Icon icon="solar:clapperboard-bold-duotone" className="text-text-muted mx-auto mb-4" width={48} />
            <h2 className="text-xl font-semibold text-text-primary mb-2">Shot Plan</h2>
            <p className="text-text-secondary">Coming soon - plan your A-roll and B-roll shots</p>
          </div>
        )}

        {currentStep === "audio" && (
          <div className="text-center py-20">
            <Icon icon="solar:soundwave-bold-duotone" className="text-text-muted mx-auto mb-4" width={48} />
            <h2 className="text-xl font-semibold text-text-primary mb-2">Generate Audio</h2>
            <p className="text-text-secondary">Coming soon - AI voice generation with ElevenLabs</p>
          </div>
        )}

        {currentStep === "generate" && (
          <div className="text-center py-20">
            <Icon icon="solar:video-frame-play-bold-duotone" className="text-text-muted mx-auto mb-4" width={48} />
            <h2 className="text-xl font-semibold text-text-primary mb-2">Generate Video</h2>
            <p className="text-text-secondary">Coming soon - assemble your final video</p>
          </div>
        )}
      </div>
    </div>
  );
}
