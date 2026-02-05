"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { actorsAPI } from "@/api/actors";
import { BasicInfoStep } from "./create-steps/BasicInfoStep";
import { AppearanceStep } from "./create-steps/AppearanceStep";
import { StyleStep } from "./create-steps/StyleStep";
import { ReferencesStep } from "./create-steps/ReferencesStep";
import { GenerateStep } from "./create-steps/GenerateStep";
import type {
  Character,
  CreateStep,
  AppearanceConfig,
  StyleConfig,
  CharacterConfig,
  GeneratedImage,
} from "./types";

interface CreateCharacterFlowProps {
  teamId: number;
  onCharacterCreated: (character: Character) => void;
}

const STEPS: { id: CreateStep; label: string; icon: string }[] = [
  { id: "basic-info", label: "Basic Info", icon: "solar:user-id-bold-duotone" },
  { id: "appearance", label: "Appearance", icon: "solar:face-scan-circle-bold-duotone" },
  { id: "style", label: "Style", icon: "solar:hanger-2-bold-duotone" },
  { id: "references", label: "References", icon: "solar:gallery-bold-duotone" },
  { id: "generate", label: "Generate", icon: "solar:magic-stick-3-bold-duotone" },
];

const DEFAULT_APPEARANCE: AppearanceConfig = {
  hairColor: "brunette",
  hairStyle: "medium",
  skinTone: "medium",
  eyeColor: "brown",
  bodyType: "average",
};

const DEFAULT_STYLE: StyleConfig = {
  outfit: "casual",
  setting: "",
};

export function CreateCharacterFlow({ teamId, onCharacterCreated }: CreateCharacterFlowProps) {
  const [currentStep, setCurrentStep] = useState<CreateStep>("basic-info");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("female");
  const [ageRange, setAgeRange] = useState("25-35");
  const [appearance, setAppearance] = useState<AppearanceConfig>(DEFAULT_APPEARANCE);
  const [style, setStyle] = useState<StyleConfig>(DEFAULT_STYLE);
  const [referenceImages, setReferenceImages] = useState<{ key: string; previewUrl: string }[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImageKeys, setSelectedImageKeys] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState("");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case "basic-info":
        return name.trim().length > 0 && gender && ageRange;
      case "appearance":
        return true;
      case "style":
        return true;
      case "references":
        return true;
      case "generate":
        return selectedImageKeys.length > 0;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === "generate") {
      await handleSaveCharacter();
      return;
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const status = await actorsAPI.getGenerationStatus(jobId);
      setGenerationProgress(status.progress);
      setGenerationMessage(status.progressMessage);

      if (status.status === "completed" && status.images) {
        stopPolling();
        setGeneratedImages(status.images);
        setGenerationPrompt(status.prompt || "");
        setSelectedImageKeys([]);
        setIsGenerating(false);
        setCurrentJobId(null);
      } else if (status.status === "failed") {
        stopPolling();
        setIsGenerating(false);
        setCurrentJobId(null);
        console.error("Generation failed:", status.error);
      }
    } catch (error) {
      console.error("Failed to poll job status:", error);
    }
  }, [stopPolling]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleGenerate = async (tweaks?: { setting?: string; anythingElse?: string }) => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationMessage("Starting generation...");
    setGeneratedImages([]);

    try {
      const referenceKeys = referenceImages.map((img) => img.key);

      const effectiveStyle = tweaks
        ? {
            ...style,
            setting: tweaks.setting || style.setting,
            anythingElse: tweaks.anythingElse || style.anythingElse,
          }
        : style;

      const config: CharacterConfig = {
        gender,
        ageRange,
        appearance,
        style: effectiveStyle,
        referenceImages: referenceKeys.length > 0 ? referenceKeys : undefined,
      };

      const response = await actorsAPI.generatePreview(teamId, config);
      setCurrentJobId(response.jobId);

      pollingRef.current = setInterval(() => {
        pollJobStatus(response.jobId);
      }, 2000);

    } catch (error: any) {
      console.error("Failed to start generation:", error);
      setIsGenerating(false);
      const msg = error?.message || error?.response?.data?.error || "";
      if (msg.includes("Insufficient credits") || msg.includes("INSUFFICIENT_CREDITS")) {
        setSaveError("Not enough credits to generate. Please upgrade or purchase more credits.");
      }
    }
  };

  const handleSaveCharacter = async () => {
    if (selectedImageKeys.length === 0) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      const referenceKeys = referenceImages.map((img) => img.key);
      const response = await actorsAPI.create({
        teamId,
        name,
        gender,
        ageRange,
        appearanceConfig: appearance,
        styleConfig: style,
        selectedImageKeys,
        generationPrompt,
        referenceImages: referenceKeys.length > 0 ? referenceKeys : undefined,
      });

      onCharacterCreated(response.character);
    } catch (error) {
      console.error("Failed to save character:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save character";
      if (errorMessage.includes("Insufficient credits")) {
        setSaveError("Not enough credits. Please purchase more credits or select fewer images.");
      } else {
        setSaveError(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageToggle = (key: string) => {
    setSelectedImageKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        {STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;
          const isClickable = index <= currentStepIndex;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => isClickable && setCurrentStep(step.id)}
                disabled={!isClickable}
                className={`flex flex-col items-center gap-2 transition-all ${
                  isClickable ? "cursor-pointer" : "cursor-not-allowed"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-accent-400 text-white shadow-lg shadow-accent-400/30 scale-110"
                      : isCompleted
                        ? "bg-accent-400/20 text-accent-400"
                        : "bg-surface-elevated text-text-muted"
                  }`}
                >
                  {isCompleted ? (
                    <Icon icon="solar:check-circle-bold" width={24} />
                  ) : (
                    <Icon icon={step.icon} width={22} />
                  )}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    isActive ? "text-accent-400" : isCompleted ? "text-text-secondary" : "text-text-muted"
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                    isCompleted ? "bg-accent-400" : "bg-surface-elevated"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <Progress
        value={progress}
        size="sm"
        classNames={{
          base: "hidden",
          track: "bg-surface-elevated",
          indicator: "bg-accent-400",
        }}
      />

      <div className="bg-surface-elevated/30 rounded-3xl border border-border-base p-6 sm:p-8 min-h-[450px]">
        {currentStep === "basic-info" && (
          <BasicInfoStep
            name={name}
            gender={gender}
            ageRange={ageRange}
            onNameChange={setName}
            onGenderChange={setGender}
            onAgeRangeChange={setAgeRange}
          />
        )}

        {currentStep === "appearance" && (
          <AppearanceStep appearance={appearance} onAppearanceChange={setAppearance} />
        )}

        {currentStep === "style" && (
          <StyleStep style={style} onStyleChange={setStyle} />
        )}

        {currentStep === "references" && (
          <ReferencesStep
            teamId={teamId}
            referenceImages={referenceImages}
            onReferenceImagesChange={setReferenceImages}
          />
        )}

        {currentStep === "generate" && (
          <GenerateStep
            generatedImages={generatedImages}
            selectedImageKeys={selectedImageKeys}
            isGenerating={isGenerating}
            progress={generationProgress}
            progressMessage={generationMessage}
            onGenerate={handleGenerate}
            onImageToggle={handleImageToggle}
          />
        )}
      </div>

      {saveError && (
        <div className="bg-danger-100 border border-danger-300 text-danger-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <Icon icon="solar:danger-triangle-bold" className="text-danger-500" width={20} />
          <span className="text-sm">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-auto">
            <Icon icon="solar:close-circle-bold" className="text-danger-400 hover:text-danger-600" width={18} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="light"
          className="text-text-secondary hover:text-text-primary"
          onPress={handleBack}
          isDisabled={currentStepIndex === 0}
          startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
        >
          Back
        </Button>

        <div className="flex items-center gap-4">
          {currentStep === "generate" && generatedImages.length > 0 && (
            <div className="text-sm text-text-secondary bg-surface-elevated px-4 py-2 rounded-xl">
              <span className="font-semibold text-accent-400">{selectedImageKeys.length}</span> selected
              <span className="text-text-muted ml-1">• {selectedImageKeys.length} credits</span>
            </div>
          )}
          <Button
            size="lg"
            className="bg-accent-400 text-white font-semibold px-8 shadow-lg shadow-accent-400/20"
            onPress={handleNext}
            isDisabled={!canProceed()}
            isLoading={isSaving}
            endContent={
              currentStep === "generate" ? (
                <Icon icon="solar:check-circle-bold" width={18} />
              ) : (
                <Icon icon="solar:arrow-right-linear" width={18} />
              )
            }
          >
            {currentStep === "generate" ? "Save Actor" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
