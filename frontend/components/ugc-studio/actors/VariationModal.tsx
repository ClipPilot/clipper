"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Modal,
  Button,
  TextArea,
  ProgressBar } from "@heroui/react";
import { Icon } from "@iconify/react";
import { actorsAPI } from "@/api/actors";
import type { Character, GeneratedImage } from "./types";

interface VariationModalProps {
  character: Character | null;
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  onVariationCreated: (character: Character) => void;
}

export function VariationModal({
  character,
  isOpen,
  onClose,
  teamId,
  onVariationCreated,
}: VariationModalProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImageKeys, setSelectedImageKeys] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<"prompt" | "select">("prompt");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const status = await actorsAPI.getGenerationStatus(jobId);
      setProgress(status.progress);
      setProgressMessage(status.progressMessage);

      if (status.status === "completed" && status.images) {
        stopPolling();
        setGeneratedImages(status.images);
        setSelectedImageKeys([]);
        setIsGenerating(false);
        setCurrentJobId(null);
        setStep("select");
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

  const handleGenerate = async () => {
    if (!character || !prompt.trim()) return;

    setIsGenerating(true);
    setProgress(0);
    setProgressMessage("Starting generation...");
    setGeneratedImages([]);

    try {
      const response = await actorsAPI.createVariation(character.id, teamId, {
        outfit: "casual",
        setting: "",
        anythingElse: prompt.trim(),
      });
      setCurrentJobId(response.jobId);

      pollingRef.current = setInterval(() => {
        pollJobStatus(response.jobId);
      }, 2000);
    } catch (error) {
      console.error("Failed to start variation generation:", error);
      setIsGenerating(false);
    }
  };

  const handleImageToggle = (key: string) => {
    setSelectedImageKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    if (!character || selectedImageKeys.length === 0) return;

    setIsSaving(true);
    try {
      const response = await actorsAPI.create({
        teamId,
        name: `${character.name} (Variation)`,
        gender: character.gender || undefined,
        ageRange: character.age_range || undefined,
        appearanceConfig: character.appearance_config || undefined,
        styleConfig: {
          outfit: "casual",
          setting: "",
          anythingElse: prompt.trim(),
        },
        selectedImageKeys,
        parentCharacterId: character.id,
      });

      onVariationCreated(response.character);
      handleClose();
    } catch (error) {
      console.error("Failed to save variation:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    stopPolling();
    setStep("prompt");
    setPrompt("");
    setGeneratedImages([]);
    setSelectedImageKeys([]);
    setIsGenerating(false);
    setProgress(0);
    onClose();
  };

  if (!character) return null;

  const primaryImageUrl = character.primaryImageUrl || character.imageUrls?.[character.primary_image_index || 0];

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose}><Modal.Container><Modal.Dialog className="sm:max-w-2xl">
        <Modal.Header className="flex items-center gap-3">
          <Icon icon="solar:magic-stick-3-bold-duotone" className="text-accent-400" width={24} />
          <span>Create Variation of {character.name}</span>
        </Modal.Header>

        <Modal.Body>
          {step === "prompt" ? (
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <div className="w-24 sm:w-32 shrink-0 mx-auto sm:mx-0">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden border border-border-base">
                    {primaryImageUrl ? (
                      <img src={primaryImageUrl} alt={character.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
                        <Icon icon="solar:user-circle-bold-duotone" className="text-text-muted" width={40} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-3 sm:space-y-4">
                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-400/20 to-purple-500/20 flex items-center justify-center animate-pulse">
                        <Icon icon="solar:magic-stick-3-bold-duotone" className="text-accent-400" width={28} />
                      </div>
                      <div className="text-center">
                        <p className="text-text-primary font-medium mb-1">Generating Variations</p>
                        <p className="text-text-secondary text-sm">{progressMessage}</p>
                      </div>
                      <div className="w-full max-w-xs">
                        <ProgressBar
 value={progress}
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
                      </div>
                      <p className="text-text-muted text-xs">{progress > 0 ? `${progress}%` : "Starting..."}</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-text-primary mb-2 block">
                          What changes do you want?
                        </label>
                        <TextArea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="e.g., wearing a red dress at a coffee shop, casual gym outfit in a modern apartment, professional blazer in an office setting..."
                          minRows={4}
                          className="bg-surface-elevated border-border-base"
                        />
                      </div>
                      <p className="text-xs text-text-muted">
                        Describe the outfit, setting, pose, or any other changes. The original appearance will be preserved.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="text-center">
                <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-1 sm:mb-2">Select Your Favorites</h3>
                <p className="text-text-secondary text-xs sm:text-sm">
                  Click on images to select • {selectedImageKeys.length} selected
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {generatedImages.map((image) => {
                  const isSelected = selectedImageKeys.includes(image.key);
                  return (
                    <div
                      key={image.key}
                      onClick={() => handleImageToggle(image.key)}
                      className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-accent-400 ring-2 ring-accent-400/30"
                          : "border-border-base hover:border-accent-400/50"
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={`Variation ${image.index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div
                        className={`absolute inset-0 bg-accent-400/20 transition-opacity ${
                          isSelected ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <div
                        className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isSelected ? "bg-accent-400" : "bg-surface-base/80 border border-border-base"
                        }`}
                      >
                        {isSelected ? (
                          <Icon icon="solar:check-circle-bold" className="text-white" width={18} />
                        ) : (
                          <span className="text-text-muted text-sm">{image.index + 1}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-surface-elevated rounded-xl p-3 sm:p-4 border border-border-base">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Icon icon="solar:tag-bold-duotone" className="text-accent-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xs sm:text-sm text-text-primary">Credit Cost</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base sm:text-lg font-semibold text-text-primary">{selectedImageKeys.length} credits</span>
                    <p className="text-[10px] sm:text-xs text-text-muted">1 credit per image</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          {step === "prompt" ? (
            <>
              <Button variant="tertiary" onPress={handleClose} className="text-text-secondary">
                Cancel
              </Button>
              <Button
 className="bg-accent-400 text-white font-semibold"
 onPress={handleGenerate}
 isPending={isGenerating}
 isDisabled={!prompt.trim()}
 >
                <Icon icon="solar:magic-stick-3-bold" width={18} />
                Generate Variations
              </Button>
            </>
          ) : (
            <>
              <Button variant="tertiary" onPress={() => setStep("prompt")} className="text-text-secondary">
                Back
              </Button>
              <Button
 className="bg-accent-400 text-white font-semibold"
 onPress={handleSave}
 isPending={isSaving}
 isDisabled={selectedImageKeys.length === 0}
 >
                <Icon icon="solar:check-circle-bold" width={18} />
                Save ({selectedImageKeys.length} credits)
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
}
