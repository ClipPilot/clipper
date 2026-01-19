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
  freshStartAtom,
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
  const freshStart = useAtomValue(freshStartAtom);
  const [loading, setLoading] = useState(true);
  const [generatingAll, setGeneratingAll] = useState(false);

  const currentScript = scripts[selectedVariantIndex];
  const scenes = currentScript?.scenes || [];

  const completedScenes = scenes.filter(
    (scene) => sceneImages[scene.id]?.imageKey
  ).length;
  const totalScenes = scenes.length;
  const allComplete = completedScenes === totalScenes && totalScenes > 0;
  const progressPercent =
    totalScenes > 0 ? (completedScenes / totalScenes) * 100 : 0;

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

  const prevCharacterIdRef = useRef<number | null>(null);
  const hasTriggeredAutoGenerate = useRef(false);

  useEffect(() => {
    if (freshStart) {
      console.log("[SceneBuilder] Fresh start - skipping saved images");
      setLoading(false);
      return;
    }

    const loadSavedImages = async () => {
      if (
        prevCharacterIdRef.current !== null &&
        prevCharacterIdRef.current !== characterId
      ) {
        console.log("[SceneBuilder] Character changed, clearing images");
        setSceneImages({});
        setLoading(false);
        prevCharacterIdRef.current = characterId;
        return;
      }
      prevCharacterIdRef.current = characterId;

      try {
        const response = await sceneBuilderAPI.getSceneImages(scriptId);
        if (response.success && response.sceneImages) {
          setSceneImages((prev) => {
            const newState: Record<string, SceneImageState> = { ...prev };
            Object.entries(response.sceneImages).forEach(
              ([sceneId, sceneImage]: [string, any]) => {
                const currentState = prev[sceneId];
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
  }, [scriptId, characterId, freshStart, setSceneImages]);

  useEffect(() => {
    if (loading || hasTriggeredAutoGenerate.current || generatingAll) return;
    if (scenes.length === 0) return;

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
    console.log("[SceneBuilder] Auto-generating all scene images");
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
    key: string,
    url: string
  ) => {
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

  const handleUseEndFrameChange = (sceneId: string, useEndFrame: boolean) => {
    setSceneImages((prev) => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        useEndFrame,
      },
    }));
  };

  const handleGenerateAll = async () => {
    if (scenes.length === 0) return;

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
          // Pass full scene data to avoid stale DB reads
          sceneType: scene.sceneType,
          dialogue: scene.dialogue,
          action: scene.action,
          emotion: scene.emotion,
          shotType: scene.shotType,
          cameraAngle: scene.cameraAngle,
          // Optional refinements
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
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Build Your Scenes
        </h2>
        <p className="text-text-secondary">
          Generate reference images for each scene
        </p>
      </div>

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
                    ? "All scenes have images ready!"
                    : "Generate a reference image for each scene."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
                  progressMessage:
                    sceneState.status === "regenerating"
                      ? "Regenerating..."
                      : "",
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
            />
          );
        })}
      </div>

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
