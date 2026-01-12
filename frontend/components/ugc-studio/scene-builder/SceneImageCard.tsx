"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardBody, Button, Textarea, Chip, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SCENE_TYPE_CONFIG, type UGCScene } from "../script/types";
import { SupportingImageUploader } from "./SupportingImageUploader";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import type { SupportingImage, SceneImageGeneration } from "./types";

interface SceneImageCardProps {
  scene: UGCScene;
  teamId: number;
  scriptId: string;
  characterId: number;
  productImageKeys: string[];
  generation?: SceneImageGeneration;
  selectedImageKey?: string;
  selectedImageUrl?: string; // Direct URL for rendering (from API or generation)
  selectedImageIndex?: number;
  userRefinement?: string;
  supportingImageKeys?: string[];
  onGenerationStart: (jobId: string) => void;
  onGenerationUpdate: (status: SceneImageGeneration) => void;
  onImageSelect: (imageKey: string, index: number) => void;
  onRefinementChange: (refinement: string) => void;
  onSupportingImagesChange: (keys: string[]) => void;
}

export function SceneImageCard({
  scene,
  teamId,
  scriptId,
  characterId,
  productImageKeys,
  generation,
  selectedImageKey,
  selectedImageUrl,
  selectedImageIndex,
  userRefinement,
  supportingImageKeys,
  onGenerationStart,
  onGenerationUpdate,
  onImageSelect,
  onRefinementChange,
  onSupportingImagesChange,
}: SceneImageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localRefinement, setLocalRefinement] = useState(userRefinement || "");
  const [supportingImages, setSupportingImages] = useState<SupportingImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sceneConfig = SCENE_TYPE_CONFIG[scene.sceneType];
  const hasSelectedImage = !!selectedImageKey;
  const isComplete = hasSelectedImage;

  // Poll for generation status
  useEffect(() => {
    if (generation?.jobId && generation.status !== "completed" && generation.status !== "failed") {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await sceneBuilderAPI.getGenerationStatus(generation.jobId);

          const updatedGeneration: SceneImageGeneration = {
            jobId: status.jobId,
            status: status.status,
            progress: status.progress,
            progressMessage: status.progressMessage,
            generatedImages: status.images?.map((img) => ({
              key: img.key,
              url: img.url,
              index: img.index,
            })),
            error: status.error,
          };

          onGenerationUpdate(updatedGeneration);

          if (status.status === "completed") {
            setIsGenerating(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            // Auto-select the single generated image
            if (status.images && status.images.length > 0) {
              const image = status.images[0];
              try {
                await sceneBuilderAPI.selectSceneImage({
                  scriptId,
                  sceneId: scene.id,
                  sceneNumber: scene.sceneNumber,
                  imageKey: image.key,
                  generationJobId: status.jobId,
                });
                onImageSelect(image.key, 0);
              } catch (error) {
                console.error("Failed to auto-select scene image:", error);
              }
            }
          } else if (status.status === "failed") {
            setIsGenerating(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } catch (error) {
          console.error("Failed to poll generation status:", error);
        }
      }, 2000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [generation?.jobId, generation?.status, scriptId, scene.id, scene.sceneNumber, onImageSelect]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await sceneBuilderAPI.generateSceneImages({
        teamId,
        scriptId,
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        userRefinement: localRefinement || undefined,
        supportingImageKeys: supportingImageKeys,
      });

      onGenerationStart(response.jobId);
    } catch (error) {
      console.error("Failed to start generation:", error);
      setIsGenerating(false);
    }
  };

  const handleSupportingImagesChange = (images: SupportingImage[]) => {
    setSupportingImages(images);
    onSupportingImagesChange(images.map((img) => img.key));
  };

  const handleRefinementBlur = () => {
    if (localRefinement !== userRefinement) {
      onRefinementChange(localRefinement);
    }
  };

  // Collapsed view
  if (!isExpanded) {
    return (
      <Card
        isPressable
        onPress={() => setIsExpanded(true)}
        className={`bg-surface-elevated border transition-all ${
          isComplete
            ? "border-accent-400/30 hover:border-accent-400/50"
            : "border-border-base hover:border-accent-400/30"
        }`}
      >
        <CardBody className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs font-medium text-text-muted shrink-0">
                Scene {scene.sceneNumber}
              </span>
              <Chip
                size="sm"
                className={`${sceneConfig.color} shrink-0`}
                startContent={<Icon icon={sceneConfig.icon} width={10} />}
              >
                {sceneConfig.label}
              </Chip>
              <Chip
                size="sm"
                variant="flat"
                className={
                  scene.shotType === "a-roll"
                    ? "bg-blue-500/20 text-blue-400"
                    : scene.shotType === "b-roll"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-purple-500/20 text-purple-400"
                }
              >
                {scene.shotType}
              </Chip>
              <span className="text-xs text-text-muted shrink-0">
                {scene.estimatedDurationSeconds}s
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isComplete && selectedImageKey && (selectedImageUrl || generation?.generatedImages) ? (
                <div className="w-10 h-12 rounded-md overflow-hidden bg-surface-base relative ring-2 ring-accent-400">
                  <img
                    src={
                      selectedImageUrl ||
                      generation?.generatedImages?.find((img) => img.key === selectedImageKey)?.url ||
                      generation?.generatedImages?.[selectedImageIndex || 0]?.url
                    }
                    alt="Selected"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-accent-400 flex items-center justify-center">
                    <Icon icon="solar:check-circle-bold" className="text-white" width={10} />
                  </div>
                </div>
              ) : generation?.status === "completed" && generation.generatedImages ? (
                // Images ready but not selected - show alert state
                <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-medium text-amber-400">Select image</span>
                </div>
              ) : generation?.status === "generating" ? (
                <div className="flex items-center gap-2 text-accent-400">
                  <Icon icon="solar:spinner" className="animate-spin" width={16} />
                  <span className="text-xs">{generation.progress}%</span>
                </div>
              ) : (
                <div className="w-10 h-12 rounded-md border-2 border-dashed border-border-base flex items-center justify-center">
                  <Icon icon="solar:gallery-add-bold-duotone" className="text-text-muted" width={16} />
                </div>
              )}
              <Icon icon="solar:alt-arrow-right-linear" className="text-text-muted" width={16} />
            </div>
          </div>

          <p className="text-sm text-text-secondary line-clamp-1 mt-2">
            "{scene.dialogue}"
          </p>
        </CardBody>
      </Card>
    );
  }

  // Expanded view
  return (
    <Card className="bg-surface-elevated border border-accent-400/30">
      <CardBody className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">
              Scene {scene.sceneNumber}
            </span>
            <Chip
              size="sm"
              className={sceneConfig.color}
              startContent={<Icon icon={sceneConfig.icon} width={12} />}
            >
              {sceneConfig.label}
            </Chip>
            <Chip
              size="sm"
              variant="flat"
              className={
                scene.shotType === "a-roll"
                  ? "bg-blue-500/20 text-blue-400"
                  : scene.shotType === "b-roll"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-purple-500/20 text-purple-400"
              }
            >
              {scene.shotType}
            </Chip>
            <span className="text-xs text-text-muted">
              {scene.estimatedDurationSeconds}s
            </span>
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setIsExpanded(false)}
          >
            <Icon icon="solar:alt-arrow-up-linear" width={16} />
          </Button>
        </div>

        {/* Dialogue */}
        <div className="bg-surface-base rounded-lg p-3">
          <p className="text-text-primary text-sm leading-relaxed">
            "{scene.dialogue}"
          </p>
        </div>

        {/* Action */}
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Icon icon="solar:running-bold" width={14} className="text-text-muted shrink-0" />
          <span>{scene.action}</span>
        </div>

        {/* Supporting images */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Icon icon="solar:gallery-bold-duotone" className="text-text-muted" width={14} />
            <span className="text-xs text-text-muted">Supporting Images (optional)</span>
          </div>
          <SupportingImageUploader
            teamId={teamId}
            maxImages={3}
            images={supportingImages}
            onImagesChange={handleSupportingImagesChange}
          />
        </div>

        {/* Scene direction */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Icon icon="solar:pen-bold-duotone" className="text-text-muted" width={14} />
            <span className="text-xs text-text-muted">Scene Direction (optional)</span>
          </div>
          <Textarea
            value={localRefinement}
            onChange={(e) => setLocalRefinement(e.target.value)}
            onBlur={handleRefinementBlur}
            placeholder="Add specific directions for this scene..."
            minRows={2}
            classNames={{
              input: "bg-surface-base text-text-primary text-sm",
              inputWrapper: "bg-surface-base border-border-base",
            }}
          />
        </div>

        {/* Generation status or gallery */}
        {generation?.status === "generating" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{generation.progressMessage}</span>
              <span className="text-accent-400 font-medium">{generation.progress}%</span>
            </div>
            <Progress
              value={generation.progress}
              size="sm"
              classNames={{
                track: "bg-surface-base",
                indicator: "bg-accent-400",
              }}
            />
          </div>
        )}

        {generation?.status === "failed" && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <Icon icon="solar:danger-triangle-bold" width={16} />
            <span>{generation.error || "Generation failed"}</span>
          </div>
        )}

        {/* Show generated/selected image */}
        {(selectedImageUrl || (generation?.status === "completed" && generation.generatedImages?.[0])) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Icon icon="solar:gallery-check-bold" width={14} />
              <span>Generated image</span>
            </div>
            <div className="flex gap-3">
              <div className="w-24 h-32 rounded-lg overflow-hidden bg-surface-base ring-2 ring-accent-400 relative">
                <img
                  src={selectedImageUrl || generation?.generatedImages?.[0]?.url}
                  alt="Generated"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent-400 flex items-center justify-center">
                  <Icon icon="solar:check-circle-bold" className="text-white" width={12} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border-base">
          <div className="flex items-center gap-2">
            {isComplete && (
              <span className="text-xs text-accent-400 flex items-center gap-1">
                <Icon icon="solar:check-circle-bold" width={14} />
                Image selected
              </span>
            )}
          </div>
          <Button
            className={
              (generation?.status === "completed" || selectedImageUrl)
                ? "border-border-base text-text-secondary"
                : "bg-accent-400 text-white"
            }
            variant={(generation?.status === "completed" || selectedImageUrl) ? "bordered" : "solid"}
            size="sm"
            onPress={handleGenerate}
            isLoading={isGenerating || generation?.status === "generating"}
            isDisabled={generation?.status === "generating"}
            startContent={
              (generation?.status === "completed" || selectedImageUrl) ? (
                <Icon icon="solar:refresh-bold" width={14} />
              ) : (
                <Icon icon="solar:magic-stick-3-bold" width={14} />
              )
            }
          >
            {(generation?.status === "completed" || selectedImageUrl) ? "Regenerate" : "Generate Image"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
