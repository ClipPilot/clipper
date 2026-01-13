"use client";

import { useState, useEffect, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Card, CardBody, Button, Spinner, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  scriptsAtom,
  selectedVariantIndexAtom,
  sceneImagesAtom,
  SceneImageState,
} from "@/store/ugc";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import { ugcScriptAPI } from "@/api/ugc";
import { SceneImageCard } from "./SceneImageCard";
import type { SceneImageGeneration } from "./types";

interface SceneBuilderStepProps {
  teamId: number;
  scriptId: string;
  characterId: number;
  productImageKeys: string[];
  onContinue?: () => void;
}

export function SceneBuilderStep({
  teamId,
  scriptId,
  characterId,
  productImageKeys,
  onContinue,
}: SceneBuilderStepProps) {
  const scripts = useAtomValue(scriptsAtom);
  const selectedVariantIndex = useAtomValue(selectedVariantIndexAtom);
  const [sceneImages, setSceneImages] = useAtom(sceneImagesAtom);
  const [loading, setLoading] = useState(true);
  const [generatingAll, setGeneratingAll] = useState(false);

  const currentScript = scripts[selectedVariantIndex];
  const scenes = currentScript?.scenes || [];

  const completedScenes = scenes.filter(
    (scene) => sceneImages[scene.id]?.selectedImageKey
  ).length;
  const totalScenes = scenes.length;
  const allComplete = completedScenes === totalScenes && totalScenes > 0;
  const progressPercent =
    totalScenes > 0 ? (completedScenes / totalScenes) * 100 : 0;

  // Sync selected variant index to backend on mount
  // This ensures the backend knows which variant we're working with
  useEffect(() => {
    const syncVariantIndex = async () => {
      try {
        await ugcScriptAPI.updateScript(scriptId, { selectedVariantIndex });
      } catch (error) {
        console.error("Failed to sync variant index:", error);
      }
    };

    syncVariantIndex();
  }, [scriptId, selectedVariantIndex]);

  // Track previous characterId to detect character changes during session
  const prevCharacterIdRef = useRef<number | null>(null);
  const hasTriggeredAutoGenerate = useRef(false);

  // Load saved scene images on mount (unless character differs from script's original)
  useEffect(() => {
    const loadSavedImages = async () => {
      // Check if we should skip loading (e.g., user selected existing script for fresh start)
      const skipFlag = sessionStorage.getItem("skipLoadSceneImages");
      if (skipFlag === scriptId) {
        sessionStorage.removeItem("skipLoadSceneImages");
        console.log("[SceneBuilder] Skipping saved scene images for fresh start");
        setLoading(false);
        return;
      }

      // If character changed during session, clear existing images
      if (prevCharacterIdRef.current !== null && prevCharacterIdRef.current !== characterId) {
        console.log("[SceneBuilder] Character changed during session, clearing scene images");
        setSceneImages({});
        setLoading(false);
        prevCharacterIdRef.current = characterId;
        return;
      }
      prevCharacterIdRef.current = characterId;

      try {
        // First check if the script's original character matches the current selection
        const scriptResponse = await ugcScriptAPI.getFullScript(scriptId);
        if (scriptResponse.success && scriptResponse.characterId && scriptResponse.characterId !== characterId) {
          console.log("[SceneBuilder] Script character differs from selected character, skipping saved images");
          setSceneImages({});
          setLoading(false);
          return;
        }

        // Load saved images only if character matches
        const response = await sceneBuilderAPI.getSceneImages(scriptId);
        if (response.success && response.sceneImages) {
          const newState: Record<string, SceneImageState> = {};
          Object.entries(response.sceneImages).forEach(
            ([sceneId, sceneImage]: [string, any]) => {
              newState[sceneId] = {
                status: "completed",
                selectedImageKey: sceneImage.image_key,
                selectedImageUrl: sceneImage.imageUrl,
              };
            }
          );
          setSceneImages(newState);
        }
      } catch (error) {
        console.error("Failed to load saved scene images:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSavedImages();
  }, [scriptId, characterId, setSceneImages]);

  // Auto-generate all scenes on first load if none have images yet
  useEffect(() => {
    if (loading || hasTriggeredAutoGenerate.current || generatingAll) return;
    if (scenes.length === 0) return;

    // Check if any scenes already have images
    const hasAnyImages = scenes.some(scene => sceneImages[scene.id]?.selectedImageKey);
    if (hasAnyImages) return;

    // Also check if any are currently generating
    const anyGenerating = scenes.some(scene => {
      const state = sceneImages[scene.id];
      return state?.status === "generating" || state?.status === "regenerating";
    });
    if (anyGenerating) return;

    // Trigger auto-generation
    hasTriggeredAutoGenerate.current = true;
    console.log("[SceneBuilder] Auto-generating all scene images on mount");
    handleGenerateAll();
  }, [loading, scenes, sceneImages, generatingAll]);

  const handleGenerationStart = (sceneId: string, jobId: string) => {
    setSceneImages((prev) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        status: "generating",
        jobId,
      },
    }));
  };

  const handleGenerationUpdate = (
    sceneId: string,
    generation: SceneImageGeneration
  ) => {
    setSceneImages((prev: any) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        status: generation.status,
        jobId: generation.jobId,
        generatedImages: generation.generatedImages,
      },
    }));
  };

  const handleImageSelect = (
    sceneId: string,
    imageKey: string,
    index: number
  ) => {
    setSceneImages((prev) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        selectedImageKey: imageKey,
        selectedImageIndex: index,
      },
    }));
  };

  const handleRefinementChange = (sceneId: string, refinement: string) => {
    setSceneImages((prev) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        userRefinement: refinement,
      },
    }));
  };

  const handleSupportingImagesChange = (sceneId: string, keys: string[]) => {
    setSceneImages((prev) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        supportingImageKeys: keys,
      },
    }));
  };

  const handleGenerateAll = async () => {
    if (scenes.length === 0) return;

    setGeneratingAll(true);

    // Clear existing images and set regenerating state for all scenes
    setSceneImages((prev) => {
      const cleared: Record<string, SceneImageState> = {};
      for (const scene of scenes) {
        cleared[scene.id] = {
          ...prev[scene.id],
          status: "regenerating",
          selectedImageKey: undefined,
          selectedImageUrl: undefined,
          selectedImageIndex: undefined,
          generatedImages: undefined,
        };
      }
      return cleared;
    });

    try {
      const response = await sceneBuilderAPI.generateAllSceneImages({
        teamId,
        scriptId,
        characterId,
        scenes: scenes.map((scene) => ({
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          userRefinement: sceneImages[scene.id]?.userRefinement,
          supportingImageKeys: sceneImages[scene.id]?.supportingImageKeys,
        })),
      });

      response.jobIds.forEach((jobId, idx) => {
        const scene = scenes[idx];
        if (scene) {
          handleGenerationStart(scene.id, jobId);
        }
      });
    } catch (error) {
      console.error("Failed to generate all scene images:", error);
    } finally {
      setGeneratingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!currentScript || scenes.length === 0) {
    return (
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="py-16 flex flex-col items-center justify-center text-center">
          <Icon
            icon="solar:danger-triangle-bold-duotone"
            className="text-amber-400 mb-4"
            width={48}
          />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            No Script Found
          </h3>
          <p className="text-text-secondary text-sm">
            Please go back and generate a script first
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Build Your Scenes
        </h2>
        <p className="text-text-secondary">
          Generate AI images for each scene in your script
        </p>
      </div>

      {/* Progress summary */}
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  allComplete ? "bg-accent-400/20" : "bg-surface-base"
                }`}
              >
                <Icon
                  icon={
                    allComplete
                      ? "solar:check-circle-bold-duotone"
                      : "solar:gallery-bold-duotone"
                  }
                  className={
                    allComplete ? "text-accent-400" : "text-text-muted"
                  }
                  width={24}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {completedScenes} of {totalScenes} scenes complete
                </p>
                <p className="text-xs text-text-muted">
                  {allComplete
                    ? "All scenes have images selected!"
                    : "Generate and select images for each scene. We will build the video after that."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="bordered"
                className="border-border-base text-text-secondary"
                size="sm"
                onPress={handleGenerateAll}
                isLoading={generatingAll}
                isDisabled={generatingAll}
                startContent={
                  <Icon icon="solar:magic-stick-3-bold" width={16} />
                }
              >
                Generate All
              </Button>
              {onContinue && (
                <Button
                  className="bg-accent-400 text-white font-semibold"
                  size="sm"
                  isDisabled={!allComplete}
                  onPress={onContinue}
                  endContent={<Icon icon="solar:arrow-right-bold" width={16} />}
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
          <Progress
            value={progressPercent}
            size="sm"
            classNames={{
              track: "bg-surface-base",
              indicator: allComplete ? "bg-accent-400" : "bg-accent-400/70",
            }}
          />
        </CardBody>
      </Card>

      {/* Scene cards */}
      <div className="space-y-3">
        {scenes.map((scene) => {
          const sceneState = sceneImages[scene.id] || {
            status: "idle" as const,
          };
          const generation: SceneImageGeneration | undefined =
            sceneState.jobId || sceneState.status === "regenerating"
              ? {
                  jobId: sceneState.jobId || "",
                  status: sceneState.status as
                    | "queued"
                    | "generating"
                    | "regenerating"
                    | "completed"
                    | "failed",
                  progress: 0,
                  progressMessage: sceneState.status === "regenerating" ? "Regenerating..." : "",
                  generatedImages: sceneState.generatedImages,
                }
              : undefined;

          return (
            <SceneImageCard
              key={scene.id}
              scene={scene}
              teamId={teamId}
              scriptId={scriptId}
              characterId={characterId}
              productImageKeys={productImageKeys}
              generation={generation}
              selectedImageKey={sceneState.selectedImageKey}
              selectedImageUrl={sceneState.selectedImageUrl}
              selectedImageIndex={sceneState.selectedImageIndex}
              userRefinement={sceneState.userRefinement}
              supportingImageKeys={sceneState.supportingImageKeys}
              onGenerationStart={(jobId) =>
                handleGenerationStart(scene.id, jobId)
              }
              onGenerationUpdate={(gen) =>
                handleGenerationUpdate(scene.id, gen)
              }
              onImageSelect={(key, idx) =>
                handleImageSelect(scene.id, key, idx)
              }
              onRefinementChange={(ref) =>
                handleRefinementChange(scene.id, ref)
              }
              onSupportingImagesChange={(keys) =>
                handleSupportingImagesChange(scene.id, keys)
              }
            />
          );
        })}
      </div>

      {/* Bottom continue button for mobile */}
      {allComplete && onContinue && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-dark/95 backdrop-blur-sm border-t border-border-base sm:hidden">
          <Button
            className="w-full bg-accent-400 text-white font-semibold"
            size="lg"
            onPress={onContinue}
            endContent={<Icon icon="solar:arrow-right-bold" width={18} />}
          >
            Continue to Generate Video
          </Button>
        </div>
      )}
    </div>
  );
}
