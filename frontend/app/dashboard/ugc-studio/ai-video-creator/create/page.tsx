"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAtomValue } from "jotai";
import { Button, Progress, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CharacterStep } from "@/components/ugc-studio/actors/CharacterStep";
import { ScriptStep } from "@/components/ugc-studio/script";
import { AudioStep } from "@/components/ugc-studio/voice";
import { SceneBuilderStep } from "@/components/ugc-studio/scene-builder";
import { GenerateVideoStep } from "@/components/ugc-studio/generate";
import { selectedVoiceAtom, scriptIdAtom, scriptsAtom, selectedVariantIndexAtom, productImageKeysAtom, allScenesCompleteAtom } from "@/store/ugc";
import { useTeams } from "@/hooks/useTeams";
import type { Character } from "@/components/ugc-studio/actors/types";

type WizardStep = "character" | "script" | "shot-plan" | "audio" | "generate";

const STEPS: { id: WizardStep; label: string; icon: string }[] = [
  { id: "character", label: "Character", icon: "solar:user-circle-bold-duotone" },
  { id: "script", label: "Script", icon: "solar:document-text-bold-duotone" },
  { id: "audio", label: "Audio", icon: "solar:soundwave-bold-duotone" },
  { id: "shot-plan", label: "Shot Plan", icon: "solar:clapperboard-bold-duotone" },
  { id: "generate", label: "Generate", icon: "solar:video-frame-play-bold-duotone" },
];

export default function CreateAdPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const { selectedTeam, isLoading: teamsLoading } = useTeams();

  const [currentStep, setCurrentStep] = useState<WizardStep>("character");
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const scriptId = useAtomValue(scriptIdAtom);
  const scripts = useAtomValue(scriptsAtom);
  const selectedVariantIndex = useAtomValue(selectedVariantIndexAtom);
  const selectedVoice = useAtomValue(selectedVoiceAtom);
  const productImageKeys = useAtomValue(productImageKeysAtom);
  const allScenesComplete = useAtomValue(allScenesCompleteAtom);

  const currentScript = scripts[selectedVariantIndex] ?? null;

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;
  const teamId = selectedTeam?.id ?? null;

  const canProceed = () => {
    switch (currentStep) {
      case "character":
        return selectedCharacter !== null;
      case "script":
        return scriptId !== null && currentScript !== null;
      case "audio":
        return selectedVoice !== null;
      case "shot-plan":
        return allScenesComplete;
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

  if (teamsLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

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

        {currentStep === "script" && selectedCharacter && teamId && (
          <ScriptStep
            teamId={teamId}
            selectedCharacter={selectedCharacter}
            onContinue={handleNext}
          />
        )}

        {currentStep === "shot-plan" && scriptId && selectedCharacter && teamId && (
          <SceneBuilderStep
            teamId={teamId}
            scriptId={scriptId}
            characterId={selectedCharacter.id}
            productImageKeys={productImageKeys}
            onContinue={handleNext}
          />
        )}

        {currentStep === "audio" && <AudioStep onContinue={handleNext} />}

        {currentStep === "generate" && scriptId && teamId && (
          <GenerateVideoStep
            teamId={teamId}
            scriptId={scriptId}
          />
        )}
      </div>
    </div>
  );
}
