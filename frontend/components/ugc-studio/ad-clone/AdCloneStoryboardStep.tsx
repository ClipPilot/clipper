"use client";

import { useState, useEffect, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Card, CardBody, Button, Spinner, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  adCloneScriptsAtom,
  adCloneSelectedVariantAtom,
  adCloneSceneImagesAtom,
  adCloneCharacterIdAtom,
  adCloneProjectIdAtom,
  SceneImage,
} from "@/store/adClone";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import { adCloneAPI } from "@/api/adClone";
import { StoryboardThumbnail } from "../scene-builder/StoryboardThumbnail";
import { SceneImageCard } from "../scene-builder/SceneImageCard";
import { SCENE_TYPE_CONFIG } from "../script/types";
import type { UGCScene } from "../script/types";
import type { SceneImageGeneration } from "../scene-builder/types";

interface AdCloneStoryboardStepProps {
  teamId: number;
  onContinue?: () => void;
  onBack?: () => void;
}

// Map ad clone scene images to the format expected by SceneImageCard
interface SceneImageState {
  status: "idle" | "generating" | "regenerating" | "completed" | "failed";
  jobId?: string;
  imageKey?: string;
  imageUrl?: string;
  generatedImages?: { key: string; url: string; index: number }[];
  userRefinement?: string;
  supportingImageKeys?: string[];
  useEndFrame?: boolean;
  customStartImageKey?: string;
  customStartImageUrl?: string;
  customEndImageKey?: string;
  customEndImageUrl?: string;
  customBRollImages?: Record<number, { key: string; url: string }>;
}

export function AdCloneStoryboardStep({
  teamId,
  onContinue,
  onBack,
}: AdCloneStoryboardStepProps) {
  const [scripts, setScripts] = useAtom(adCloneScriptsAtom);
  const selectedVariantIndex = useAtomValue(adCloneSelectedVariantAtom);
  const characterId = useAtomValue(adCloneCharacterIdAtom);
  const projectId = useAtomValue(adCloneProjectIdAtom);
  const [adCloneSceneImages, setAdCloneSceneImages] = useAtom(adCloneSceneImagesAtom);

  // Use projectId as the scriptId for scene builder API (both are UUIDs)
  // Early return if projectId is not set (shouldn't happen in normal flow)
  if (!projectId) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 text-center">
          <Icon icon="solar:danger-triangle-bold-duotone" className="text-amber-400 mx-auto mb-4" width={48} />
          <h3 className="text-lg font-semibold text-text-primary mb-2">Project Not Found</h3>
          <p className="text-text-secondary text-sm">Please start over from the beginning.</p>
        </CardBody>
      </Card>
    );
  }

  const scriptId = projectId;

  // Local state for richer scene image tracking (compatible with SceneImageCard)
  const [sceneImages, setSceneImages] = useState<Record<string, SceneImageState>>({});
  const [loading, setLoading] = useState(true);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isSavingBRoll, setIsSavingBRoll] = useState(false);

  const currentScript = scripts?.[selectedVariantIndex];
  const scenes: UGCScene[] = currentScript?.scenes || [];

  const completedScenes = scenes.filter(
    (scene) => sceneImages[scene.id]?.imageKey
  ).length;
  const totalScenes = scenes.length;
  const allComplete = completedScenes === totalScenes && totalScenes > 0;
  const progressPercent = totalScenes > 0 ? (completedScenes / totalScenes) * 100 : 0;

  // Track if we've already triggered auto-generation
  const hasTriggeredAutoGenerate = useRef(false);

  // Load saved scene images on mount
  useEffect(() => {
    const loadSavedImages = async () => {
      if (!scriptId) {
        setLoading(false);
        return;
      }

      try {
        const response = await sceneBuilderAPI.getSceneImages(scriptId);
        if (response.success && response.sceneImages) {
          setSceneImages((prev) => {
            const newState: Record<string, SceneImageState> = { ...prev };
            Object.entries(response.sceneImages).forEach(
              ([sceneId, sceneImage]: [string, any]) => {
                const currentState = prev[sceneId];
                // Don't overwrite generating states
                if (
                  currentState?.status === "generating" ||
                  currentState?.status === "regenerating"
                ) {
                  return;
                }
                newState[sceneId] = {
                  status: "completed",
                  imageKey: sceneImage.image_key,
                  imageUrl: sceneImage.imageUrl,
                  generatedImages: sceneImage.generatedImages,
                };
              }
            );
            return newState;
          });
        }
      } catch (error) {
        console.error("Failed to load saved scene images:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSavedImages();
  }, [scriptId]);

  // Auto-select first scene when loaded
  useEffect(() => {
    if (!loading && scenes.length > 0 && !selectedSceneId) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [loading, scenes, selectedSceneId]);

  // Auto-generate all scene images if none exist
  useEffect(() => {
    if (loading || hasTriggeredAutoGenerate.current || generatingAll) return;
    if (scenes.length === 0 || !characterId) return;

    const hasAnyImages = scenes.some(
      (scene) => sceneImages[scene.id]?.imageKey
    );
    if (hasAnyImages) return;

    const anyGenerating = scenes.some((scene) => {
      const state = sceneImages[scene.id];
      return state?.status === "generating" || state?.status === "regenerating";
    });
    if (anyGenerating) return;

    hasTriggeredAutoGenerate.current = true;
    console.log("[AdCloneStoryboard] Auto-generating all scene images");
    handleGenerateAll();
  }, [loading, scenes, sceneImages, generatingAll, characterId]);

  // Sync local state to atom for wizard navigation
  useEffect(() => {
    const atomImages: SceneImage[] = scenes.map((scene) => {
      const state = sceneImages[scene.id];
      return {
        sceneId: scene.id,
        imageUrl: state?.imageUrl || null,
        status: state?.status === "completed" && state.imageUrl
          ? "completed"
          : state?.status === "generating" || state?.status === "regenerating"
          ? "generating"
          : state?.status === "failed"
          ? "failed"
          : "pending",
        error: undefined,
      };
    });
    setAdCloneSceneImages(atomImages);
  }, [sceneImages, scenes, setAdCloneSceneImages]);

  // Global polling for generating scenes
  const globalPollRef = useRef<NodeJS.Timeout | null>(null);
  const sceneImagesRef = useRef(sceneImages);
  sceneImagesRef.current = sceneImages;

  useEffect(() => {
    if (globalPollRef.current) return;

    globalPollRef.current = setInterval(async () => {
      const currentSceneImages = sceneImagesRef.current;

      const generatingEntries = Object.entries(currentSceneImages).filter(
        ([_, state]) =>
          state?.jobId &&
          (state.status === "generating" || state.status === "regenerating")
      );

      if (generatingEntries.length === 0) return;

      for (const [sceneId, state] of generatingEntries) {
        if (!state?.jobId) continue;
        const scene = scenes.find((s) => s.id === sceneId);
        if (!scene) continue;

        try {
          const status = await sceneBuilderAPI.getGenerationStatus(state.jobId);

          if (status.status === "completed" && status.images && status.images.length > 0) {
            const img = status.images[0];
            // Auto-select the first image
            try {
              await sceneBuilderAPI.selectSceneImage({
                scriptId,
                sceneId: scene.id,
                sceneNumber: scene.sceneNumber,
                imageKey: img.key,
                generationJobId: status.jobId,
              });
            } catch (e) {
              console.error("Failed to auto-select scene image:", e);
            }

            setSceneImages((prev) => ({
              ...prev,
              [scene.id]: {
                ...prev[scene.id],
                status: "completed",
                imageKey: img.key,
                imageUrl: img.url,
                generatedImages: status.images?.map((i) => ({
                  key: i.key,
                  url: i.url,
                  index: i.index,
                })),
              },
            }));
          } else if (status.status === "failed") {
            setSceneImages((prev) => ({
              ...prev,
              [scene.id]: {
                ...prev[scene.id],
                status: "failed",
              },
            }));
          }
        } catch (error) {
          console.error(`Failed to poll scene ${scene.id}:`, error);
        }
      }
    }, 2000);

    return () => {
      if (globalPollRef.current) {
        clearInterval(globalPollRef.current);
        globalPollRef.current = null;
      }
    };
  }, [scenes, scriptId]);

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
    setSceneImages((prev) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        status: generation.status as SceneImageState["status"],
        jobId: generation.jobId,
        generatedImages: generation.generatedImages ?? prev[sceneId]?.generatedImages,
      },
    }));
  };

  const handleImageSelect = (sceneId: string, key: string, url: string) => {
    setSceneImages((prev) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        imageKey: key,
        imageUrl: url,
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

  const handleUseEndFrameChange = (sceneId: string, useEndFrame: boolean) => {
    setSceneImages((prev) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        useEndFrame,
      },
    }));
  };

  const handleCustomImageChange = (
    sceneId: string,
    type: "start" | "end",
    key: string | undefined,
    url: string | undefined
  ) => {
    setSceneImages((prev) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        ...(type === "start"
          ? { customStartImageKey: key, customStartImageUrl: url }
          : { customEndImageKey: key, customEndImageUrl: url }),
      },
    }));
  };

  const handleCustomBRollImageChange = (
    sceneId: string,
    shotIndex: number,
    key: string | undefined,
    url: string | undefined
  ) => {
    setSceneImages((prev) => {
      const currentCustomImages = prev[sceneId]?.customBRollImages || {};
      const newCustomImages = key && url
        ? { ...currentCustomImages, [shotIndex]: { key, url } }
        : Object.fromEntries(
            Object.entries(currentCustomImages).filter(
              ([idx]) => parseInt(idx) !== shotIndex
            )
          );

      return {
        ...prev,
        [sceneId]: {
          ...prev[sceneId],
          customBRollImages:
            Object.keys(newCustomImages).length > 0
              ? newCustomImages
              : undefined,
        },
      };
    });
  };

  const handleGenerationCancel = (sceneId: string) => {
    setSceneImages((prev) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        status: "failed",
        jobId: undefined,
      },
    }));
  };

  const handleSceneUpdate = async (updatedScene: UGCScene) => {
    if (!scripts || !currentScript) return;
    const updatedScenes = scenes.map((s) =>
      s.id === updatedScene.id ? updatedScene : s
    );
    const updatedScript = { ...currentScript, scenes: updatedScenes };
    setScripts((prev) =>
      (prev || []).map((script: any, idx: number) =>
        idx === selectedVariantIndex ? updatedScript : script
      )
    );
    try {
      await adCloneAPI.updateScript(scriptId, { script: updatedScript });
    } catch (error) {
      console.error("Failed to save scene edit:", error);
    }
  };

  const handleAddScene = async (afterIndex: number) => {
    const newScene: UGCScene = {
      id: crypto.randomUUID(),
      sceneNumber: afterIndex + 2,
      sceneType: "demo",
      action: "Speaking to camera",
      dialogue: "Add your dialogue here...",
      emotion: "friendly",
      estimatedDurationSeconds: 5,
      shotType: "a-roll",
      cameraAngle: "pov-selfie",
    };

    let updatedScenes: UGCScene[] = [];
    setScripts((prev) =>
      (prev || []).map((script: any, i: number) => {
        if (i !== selectedVariantIndex) return script;
        const newScenes = [...script.scenes];
        newScenes.splice(afterIndex + 1, 0, newScene);
        updatedScenes = newScenes.map((scene: UGCScene, idx: number) => ({
          ...scene,
          sceneNumber: idx + 1,
        }));
        return { ...script, scenes: updatedScenes };
      })
    );

    setSelectedSceneId(newScene.id);

    try {
      const updatedScript = { ...currentScript, scenes: updatedScenes };
      await adCloneAPI.updateScript(scriptId, { script: updatedScript });
    } catch (error) {
      console.error("Failed to persist new scene:", error);
    }
  };

  const handleRemoveScene = async (sceneId: string) => {
    if (scenes.length <= 3) return;

    let updatedScenes: UGCScene[] = [];
    setScripts((prev) =>
      (prev || []).map((script: any, i: number) => {
        if (i !== selectedVariantIndex) return script;
        updatedScenes = script.scenes
          .filter((s: UGCScene) => s.id !== sceneId)
          .map((scene: UGCScene, idx: number) => ({ ...scene, sceneNumber: idx + 1 }));
        return { ...script, scenes: updatedScenes };
      })
    );

    // Clean up scene images for the removed scene
    setSceneImages((prev) => {
      const { [sceneId]: _, ...rest } = prev;
      return rest;
    });

    // If removed scene was selected, select nearest
    if (selectedSceneId === sceneId) {
      const removedIndex = scenes.findIndex((s) => s.id === sceneId);
      const nextScene = scenes[removedIndex + 1] || scenes[removedIndex - 1];
      setSelectedSceneId(nextScene?.id || null);
    }

    try {
      const updatedScript = { ...currentScript, scenes: updatedScenes };
      await adCloneAPI.updateScript(scriptId, { script: updatedScript });
    } catch (error) {
      console.error("Failed to persist scene removal:", error);
    }
  };

  const handleGenerateAll = async () => {
    if (scenes.length === 0 || !characterId) return;

    setGeneratingAll(true);

    setSceneImages((prev) => {
      const cleared: Record<string, SceneImageState> = {};
      for (const scene of scenes) {
        cleared[scene.id] = {
          ...prev[scene.id],
          status: "regenerating",
          imageKey: undefined,
          imageUrl: undefined,
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
          sceneType: scene.sceneType,
          dialogue: scene.dialogue,
          action: scene.action,
          emotion: scene.emotion,
          shotType: scene.shotType,
          cameraAngle: scene.cameraAngle,
          bRollShots: scene.bRollShots ?? null,
          userRefinement: sceneImages[scene.id]?.userRefinement,
          supportingImageKeys: sceneImages[scene.id]?.supportingImageKeys,
          generateEndFrame: sceneImages[scene.id]?.useEndFrame,
          customStartImageKey: sceneImages[scene.id]?.customStartImageKey,
          customEndImageKey: sceneImages[scene.id]?.customEndImageKey,
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
          {onBack && (
            <Button
              variant="flat"
              className="mt-4"
              onPress={onBack}
              startContent={<Icon icon="solar:arrow-left-bold" width={16} />}
            >
              Go Back
            </Button>
          )}
        </CardBody>
      </Card>
    );
  }

  if (!characterId) {
    return (
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="py-16 flex flex-col items-center justify-center text-center">
          <Icon
            icon="solar:user-bold-duotone"
            className="text-amber-400 mb-4"
            width={48}
          />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Character Required
          </h3>
          <p className="text-text-secondary text-sm">
            Please select a character first to generate storyboard images
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Storyboard Preview
        </h2>
        <p className="text-text-secondary">
          Review and refine the visual direction for each scene
        </p>
      </div>

      {/* Progress Card */}
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
                    ? "All scenes have reference images!"
                    : "Generating reference images for each scene..."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="flat"
                size="sm"
                onPress={handleGenerateAll}
                isDisabled={generatingAll || !characterId}
                startContent={
                  generatingAll ? (
                    <Spinner size="sm" />
                  ) : (
                    <Icon icon="solar:refresh-bold" width={16} />
                  )
                }
              >
                Regenerate All
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

      {/* Horizontal Timeline */}
      <div className="bg-surface-elevated border border-border-base rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon
            icon="solar:video-frame-play-horizontal-bold-duotone"
            className="text-accent-400"
            width={18}
          />
          <span className="text-sm font-medium text-text-primary">Timeline</span>
          <span className="text-xs text-text-muted ml-auto">
            Click a scene to view details
          </span>
        </div>

        <div className="overflow-x-auto py-2 -mx-2 px-4">
          <div className="flex items-center gap-2 min-w-min">
            {scenes.map((scene, index) => {
              const sceneState = sceneImages[scene.id] || { status: "idle" as const };
              const isSelected = selectedSceneId === scene.id;
              const isGenerating =
                sceneState.status === "generating" ||
                sceneState.status === "regenerating";
              const hasImage = !!sceneState.imageKey;
              const sceneConfig = SCENE_TYPE_CONFIG[scene.sceneType] || {
                label: scene.sceneType,
                icon: "solar:question-circle-bold-duotone",
                color: "bg-gray-500/20 text-gray-400",
              };

              const displayImageUrl =
                sceneState.generatedImages?.[0]?.url || sceneState.imageUrl;

              return (
                <div key={scene.id} className="flex items-center gap-2">
                  <StoryboardThumbnail
                    scene={scene}
                    sceneConfig={sceneConfig}
                    imageUrl={displayImageUrl}
                    isSelected={isSelected}
                    isGenerating={isGenerating}
                    hasImage={hasImage}
                    progress={undefined}
                    onClick={() => setSelectedSceneId(scene.id)}
                    onRemove={scenes.length > 3 ? () => handleRemoveScene(scene.id) : undefined}
                  />
                  {/* Add scene button */}
                  <button
                    onClick={() => handleAddScene(index)}
                    className="w-5 h-5 rounded-full border border-dashed border-border-base text-text-muted
                      hover:bg-accent-400/20 hover:text-accent-400 hover:border-accent-400
                      transition-all shrink-0 flex items-center justify-center"
                    title="Add scene"
                  >
                    <Icon icon="solar:add-circle-linear" width={12} />
                  </button>
                  {/* Connector line between scenes */}
                  {index < scenes.length - 1 && (
                    <div className="w-4 h-0.5 bg-border-base shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Scene Detail Panel */}
      {selectedSceneId &&
        (() => {
          const scene = scenes.find((s) => s.id === selectedSceneId);
          if (!scene) return null;

          const sceneState = sceneImages[scene.id] || { status: "idle" as const };
          const generation: SceneImageGeneration | undefined =
            sceneState.jobId ||
            sceneState.status === "regenerating" ||
            sceneState.generatedImages?.length
              ? {
                  jobId: sceneState.jobId || "",
                  status: sceneState.status as
                    | "queued"
                    | "generating"
                    | "regenerating"
                    | "completed"
                    | "failed",
                  progress: 0,
                  progressMessage:
                    sceneState.status === "regenerating" ? "Regenerating..." : "",
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
              productImageKeys={[]} // Ad clone uses different product image handling
              generation={generation}
              imageKey={sceneState.imageKey}
              imageUrl={sceneState.imageUrl}
              userRefinement={sceneState.userRefinement}
              supportingImageKeys={sceneState.supportingImageKeys}
              useEndFrame={sceneState.useEndFrame}
              customStartImageKey={sceneState.customStartImageKey}
              customStartImageUrl={sceneState.customStartImageUrl}
              customEndImageKey={sceneState.customEndImageKey}
              customEndImageUrl={sceneState.customEndImageUrl}
              onGenerationStart={(jobId) =>
                handleGenerationStart(scene.id, jobId)
              }
              onGenerationUpdate={(gen) =>
                handleGenerationUpdate(scene.id, gen)
              }
              onGenerationCancel={() => handleGenerationCancel(scene.id)}
              onImageSelect={(key, url) =>
                handleImageSelect(scene.id, key, url)
              }
              onRefinementChange={(ref) =>
                handleRefinementChange(scene.id, ref)
              }
              onSupportingImagesChange={(keys) =>
                handleSupportingImagesChange(scene.id, keys)
              }
              onUseEndFrameChange={(useEndFrame) =>
                handleUseEndFrameChange(scene.id, useEndFrame)
              }
              onCustomImageChange={(type, key, url) =>
                handleCustomImageChange(scene.id, type, key, url)
              }
              customBRollImages={sceneState.customBRollImages}
              onSceneUpdate={handleSceneUpdate}
              onSavingStateChange={setIsSavingBRoll}
              onCustomBRollImageChange={(shotIndex, key, url) =>
                handleCustomBRollImageChange(scene.id, shotIndex, key, url)
              }
              isStoryboardMode={true}
              onRegenerateBRollPrompt={async (params) => {
                await adCloneAPI.regenerateBRollPrompt(scriptId, params);
              }}
              onRegenerateAllBRollShots={async (params) => {
                const result = await adCloneAPI.regenerateAllBRollShots(scriptId, params);
                return { bRollShots: result.bRollShots };
              }}
            />
          );
        })()}

      {/* Mobile Continue Button */}
      {allComplete && onContinue && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-dark/95 backdrop-blur-sm border-t border-border-base sm:hidden">
          <Button
            className="w-full bg-accent-400 text-white font-semibold"
            size="lg"
            onPress={onContinue}
            endContent={<Icon icon="solar:arrow-right-bold" width={18} />}
          >
            Continue to Character & Voice
          </Button>
        </div>
      )}
    </div>
  );
}
