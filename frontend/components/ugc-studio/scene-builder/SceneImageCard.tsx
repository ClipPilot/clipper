"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardBody,
  Button,
  Textarea,
  Chip,
  Progress,
  Modal,
  ModalContent,
  ModalBody,
} from "@heroui/react";
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
  imageKey?: string;
  imageUrl?: string;
  userRefinement?: string;
  supportingImageKeys?: string[];
  onGenerationStart: (jobId: string) => void;
  onGenerationUpdate: (status: SceneImageGeneration) => void;
  onImageSelect: (key: string, url: string) => void;
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
  imageKey,
  imageUrl,
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
  const [supportingImages, setSupportingImages] = useState<SupportingImage[]>(
    []
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sceneConfig = SCENE_TYPE_CONFIG[scene.sceneType];
  const hasImage = !!imageKey;

  useEffect(() => {
    if (
      generation?.jobId &&
      generation.status !== "completed" &&
      generation.status !== "failed"
    ) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await sceneBuilderAPI.getGenerationStatus(
            generation.jobId
          );

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
            if (status.images && status.images.length > 0) {
              try {
                const img = status.images[0];
                await sceneBuilderAPI.selectSceneImage({
                  scriptId,
                  sceneId: scene.id,
                  sceneNumber: scene.sceneNumber,
                  imageKey: img.key,
                  generationJobId: status.jobId,
                });
                onImageSelect(img.key, img.url);
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
  }, [
    generation?.jobId,
    generation?.status,
    scriptId,
    scene.id,
    scene.sceneNumber,
    onImageSelect,
  ]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await sceneBuilderAPI.generateSceneImages({
        teamId,
        scriptId,
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        characterId,
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

  const isCurrentlyGenerating =
    isGenerating || generation?.status === "generating";

  const renderImagePreview = (label: string, url?: string, key?: string) => {
    const displayUrl = url || generation?.generatedImages?.[0]?.url;
    const hasDisplayImage = !!key && !!displayUrl;

    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-text-muted font-medium">{label}</span>
        {hasDisplayImage ? (
          <div
            className="w-10 h-12 rounded-md overflow-hidden bg-surface-base relative ring-2 ring-accent-400 cursor-zoom-in hover:ring-accent-300 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              if (displayUrl) setZoomImageUrl(displayUrl);
            }}
          >
            <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
            <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-accent-400 flex items-center justify-center">
              <Icon
                icon="solar:check-circle-bold"
                className="text-white"
                width={8}
              />
            </div>
          </div>
        ) : (
          <div className="w-10 h-12 rounded-md border-2 border-dashed border-border-base flex items-center justify-center">
            <Icon
              icon="solar:gallery-add-bold-duotone"
              className="text-text-muted"
              width={14}
            />
          </div>
        )}
      </div>
    );
  };

  if (!isExpanded) {
    return (
      <Card
        isPressable
        onPress={() => setIsExpanded(true)}
        className={`bg-surface-elevated border transition-all ${
          isCurrentlyGenerating
            ? "border-blue-500 animate-pulse"
            : hasImage
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
              {generation?.status === "generating" ? (
                <div className="flex items-center gap-2 text-accent-400">
                  <Icon
                    icon="solar:spinner"
                    className="animate-spin"
                    width={16}
                  />
                  <span className="text-xs">{generation.progress}%</span>
                </div>
              ) : (
                renderImagePreview("Image", imageUrl, imageKey)
              )}
              <Icon
                icon="solar:alt-arrow-right-linear"
                className="text-text-muted"
                width={16}
              />
            </div>
          </div>

          <p className="text-sm text-text-secondary line-clamp-1 mt-2">
            "{scene.dialogue}"
          </p>
        </CardBody>

        <Modal
          isOpen={!!zoomImageUrl}
          onClose={() => setZoomImageUrl(null)}
          size="4xl"
          classNames={{
            backdrop: "bg-black/80",
            base: "bg-transparent shadow-none",
            body: "p-0",
          }}
        >
          <ModalContent>
            <ModalBody>
              <div className="relative flex items-center justify-center">
                <Button
                  isIconOnly
                  className="absolute top-2 right-2 z-10 bg-black/50 text-white"
                  variant="flat"
                  onPress={() => setZoomImageUrl(null)}
                >
                  <Icon icon="solar:close-circle-bold" width={24} />
                </Button>
                {zoomImageUrl && (
                  <img
                    src={zoomImageUrl}
                    alt="Zoomed view"
                    className="max-h-[85vh] max-w-full object-contain rounded-lg"
                  />
                )}
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>
      </Card>
    );
  }

  return (
    <Card
      className={`bg-surface-elevated border ${
        isCurrentlyGenerating
          ? "border-blue-500 animate-pulse"
          : "border-accent-400/30"
      }`}
    >
      <CardBody className="p-4 space-y-4">
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

        <div className="bg-surface-base rounded-lg p-3">
          <p className="text-text-primary text-sm leading-relaxed">
            "{scene.dialogue}"
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Icon
            icon="solar:running-bold"
            width={14}
            className="text-text-muted shrink-0"
          />
          <span>{scene.action}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:gallery-bold-duotone"
              className="text-text-muted"
              width={14}
            />
            <span className="text-xs text-text-muted">
              Supporting Images (optional)
            </span>
          </div>
          <SupportingImageUploader
            teamId={teamId}
            maxImages={3}
            images={supportingImages}
            onImagesChange={handleSupportingImagesChange}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:pen-bold-duotone"
              className="text-text-muted"
              width={14}
            />
            <span className="text-xs text-text-muted">Prompt (optional)</span>
          </div>
          <Textarea
            value={localRefinement}
            onChange={(e) => setLocalRefinement(e.target.value)}
            onBlur={handleRefinementBlur}
            placeholder="Add specific directions for this image..."
            minRows={2}
            classNames={{
              input: "bg-surface-base text-text-primary text-sm",
              inputWrapper: "bg-surface-base border-border-base",
            }}
          />
        </div>

        {generation?.status === "generating" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {generation.progressMessage}
              </span>
              <span className="text-accent-400 font-medium">
                {generation.progress}%
              </span>
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

        {(imageKey || (generation?.status === "completed" && generation.generatedImages?.length > 0)) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Icon icon="solar:gallery-check-bold" width={14} />
              <span>Generated image (click to zoom)</span>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-text-secondary">
                  Scene Image
                </span>
                <div
                  className={`w-32 h-40 rounded-lg overflow-hidden bg-surface-base ring-2 relative transition-all ${
                    isGenerating
                      ? "ring-blue-500 animate-pulse"
                      : "ring-accent-400 cursor-zoom-in hover:ring-accent-300"
                  }`}
                  onClick={() =>
                    !isGenerating &&
                    setZoomImageUrl(
                      imageUrl || generation?.generatedImages?.[0]?.url || null
                    )
                  }
                >
                  <img
                    src={imageUrl || generation?.generatedImages?.[0]?.url}
                    alt="Scene image"
                    className={`w-full h-full object-cover ${isGenerating ? "opacity-50" : ""}`}
                  />
                  {isGenerating ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Icon
                        icon="solar:refresh-bold"
                        className="text-white animate-spin"
                        width={24}
                      />
                    </div>
                  ) : (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent-400 flex items-center justify-center">
                      <Icon
                        icon="solar:check-circle-bold"
                        className="text-white"
                        width={12}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border-base">
          <div className="flex items-center gap-2">
            {hasImage && (
              <span className="text-xs text-accent-400 flex items-center gap-1">
                <Icon icon="solar:check-circle-bold" width={14} />
                Image ready
              </span>
            )}
          </div>
          <Button
            className={hasImage ? "border-border-base text-text-secondary" : "bg-accent-400 text-white"}
            variant={hasImage ? "bordered" : "solid"}
            size="sm"
            onPress={handleGenerate}
            isLoading={isGenerating || generation?.status === "generating"}
            isDisabled={generation?.status === "generating"}
            startContent={
              hasImage ? (
                <Icon icon="solar:refresh-bold" width={14} />
              ) : (
                <Icon icon="solar:magic-stick-3-bold" width={14} />
              )
            }
          >
            {hasImage ? "Regenerate" : "Generate Image"}
          </Button>
        </div>
      </CardBody>

      <Modal
        isOpen={!!zoomImageUrl}
        onClose={() => setZoomImageUrl(null)}
        size="4xl"
        classNames={{
          backdrop: "bg-black/80",
          base: "bg-transparent shadow-none",
          body: "p-0",
        }}
      >
        <ModalContent>
          <ModalBody>
            <div className="relative flex items-center justify-center">
              <Button
                isIconOnly
                className="absolute top-2 right-2 z-10 bg-black/50 text-white"
                variant="flat"
                onPress={() => setZoomImageUrl(null)}
              >
                <Icon icon="solar:close-circle-bold" width={24} />
              </Button>
              {zoomImageUrl && (
                <img
                  src={zoomImageUrl}
                  alt="Zoomed view"
                  className="max-h-[85vh] max-w-full object-contain rounded-lg"
                  />
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Card>
  );
}
