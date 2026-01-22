"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardBody,
  Button,
  Chip,
  Progress,
  Modal,
  ModalContent,
  ModalBody,
  Input,
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
  useEndFrame?: boolean;
  customStartImageKey?: string;
  customStartImageUrl?: string;
  customEndImageKey?: string;
  customEndImageUrl?: string;
  customBRollImages?: Record<number, { key: string; url: string }>;
  onGenerationStart: (jobId: string) => void;
  onGenerationUpdate: (status: SceneImageGeneration) => void;
  onGenerationCancel: () => void;
  onImageSelect: (key: string, url: string) => void;
  onRefinementChange: (refinement: string) => void;
  onSupportingImagesChange: (keys: string[]) => void;
  onUseEndFrameChange: (useEndFrame: boolean) => void;
  onCustomImageChange: (type: "start" | "end", key: string | undefined, url: string | undefined) => void;
  onCustomBRollImageChange?: (shotIndex: number, key: string | undefined, url: string | undefined) => void;
  /** When true, always shows expanded view (used in storyboard mode) */
  isStoryboardMode?: boolean;
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
  useEndFrame,
  customStartImageKey,
  customStartImageUrl,
  customEndImageKey,
  customEndImageUrl,
  customBRollImages,
  onGenerationStart,
  onGenerationUpdate,
  onGenerationCancel,
  onImageSelect,
  onRefinementChange,
  onSupportingImagesChange,
  onUseEndFrameChange,
  onCustomImageChange,
  onCustomBRollImageChange,
  isStoryboardMode = false,
}: SceneImageCardProps) {
  // In storyboard mode, always show expanded view
  const [isExpanded, setIsExpanded] = useState(isStoryboardMode);
  const [localRefinement, setLocalRefinement] = useState(userRefinement || "");
  const [supportingImages, setSupportingImages] = useState<SupportingImage[]>(
    []
  );
  const [supportingImagesInitialized, setSupportingImagesInitialized] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [selectedBRollIndex, setSelectedBRollIndex] = useState<number | null>(null);
  // Track which specific shot is regenerating (null = all shots or none)
  const [regeneratingShotIndex, setRegeneratingShotIndex] = useState<number | null>(null);

  const sceneConfig = SCENE_TYPE_CONFIG[scene.sceneType];
  const hasImage = !!imageKey;

  // Reset local generating state when generation completes (global polling handles the actual polling)
  useEffect(() => {
    if (generation?.status === "completed" || generation?.status === "failed") {
      setIsGenerating(false);
      setRegeneratingShotIndex(null);
    }
  }, [generation?.status]);

  const handleGenerate = async (singleShotIndex?: number) => {
    setIsGenerating(true);
    // Track which specific shot is being regenerated (null means all)
    setRegeneratingShotIndex(singleShotIndex ?? null);

    // Build existing images array, merging custom images with generated images
    let existingImages: string[] | undefined;

    console.log(`[SceneImageCard] handleGenerate called with singleShotIndex=${singleShotIndex}`);
    console.log(`[SceneImageCard] generation object:`, generation);
    console.log(`[SceneImageCard] generation?.generatedImages:`, generation?.generatedImages);
    console.log(`[SceneImageCard] customBRollImages:`, customBRollImages);
    console.log(`[SceneImageCard] supportingImageKeys (from props):`, supportingImageKeys);
    console.log(`[SceneImageCard] supportingImages (local state):`, supportingImages);
    console.log(`[SceneImageCard] localRefinement:`, localRefinement);

    if (singleShotIndex !== undefined && scene.bRollShots) {
      existingImages = scene.bRollShots.map((_, idx) => {
        // Use custom image if available, otherwise use generated image
        const customImage = customBRollImages?.[idx];
        const generatedImage = generation?.generatedImages?.[idx];
        const key = customImage?.key || generatedImage?.key || "";
        console.log(`[SceneImageCard] Shot ${idx}: customKey=${customImage?.key}, generatedKey=${generatedImage?.key}, using=${key}`);
        return key;
      }).filter(Boolean);

      // Only pass if we have some existing images to preserve
      if (existingImages.length === 0) {
        console.warn(`[SceneImageCard] WARNING: No existing images found! Will regenerate ALL shots.`);
        existingImages = undefined;
      } else {
        console.log(`[SceneImageCard] Single shot regen: idx=${singleShotIndex}, preserving ${existingImages.length} existing images`);
      }
    }

    // Use local supportingImages state if available (more up-to-date), fall back to props
    const currentSupportingKeys = supportingImages.length > 0
      ? supportingImages.map(img => img.key)
      : supportingImageKeys;

    console.log(`[SceneImageCard] Using supportingImageKeys:`, currentSupportingKeys);

    const requestData = {
      teamId,
      scriptId,
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      characterId,
      userRefinement: localRefinement || undefined,
      supportingImageKeys: currentSupportingKeys,
      generateEndFrame: false,
      singleBRollShotIndex: singleShotIndex,
      existingBRollImages: existingImages,
    };

    try {
      const response = await sceneBuilderAPI.generateSceneImages(requestData);
      onGenerationStart(response.jobId);
    } catch (error) {
      console.error("Failed to start generation:", error);
      setIsGenerating(false);
      setRegeneratingShotIndex(null);
    }
  };

  const handleCustomImageUpload = async (type: "start" | "end", file: File) => {
    try {
      const { key, url } = await sceneBuilderAPI.uploadSupportingImage(teamId, file);
      onCustomImageChange(type, key, url);
    } catch (error) {
      console.error(`Failed to upload custom ${type} image:`, error);
    }
  };

  const handleCustomImageRemove = (type: "start" | "end") => {
    onCustomImageChange(type, undefined, undefined);
  };

  const bRollFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingShotIndex, setUploadingShotIndex] = useState<number | null>(null);

  const handleBRollImageUpload = async (shotIndex: number, file: File) => {
    if (!onCustomBRollImageChange) return;
    setUploadingShotIndex(shotIndex);
    try {
      const { key, url } = await sceneBuilderAPI.uploadSupportingImage(teamId, file);
      onCustomBRollImageChange(shotIndex, key, url);
    } catch (error) {
      console.error(`Failed to upload custom B-roll image for shot ${shotIndex}:`, error);
    } finally {
      setUploadingShotIndex(null);
    }
  };

  const handleBRollFileSelect = (e: React.ChangeEvent<HTMLInputElement>, shotIndex: number) => {
    const file = e.target.files?.[0];
    if (file) {
      handleBRollImageUpload(shotIndex, file);
    }
    e.target.value = "";
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

  const handleCancel = async () => {
    if (!generation?.jobId) return;
    try {
      await sceneBuilderAPI.cancelJob(generation.jobId);
      setIsGenerating(false);
      setRegeneratingShotIndex(null);
      onGenerationCancel();
    } catch (error) {
      console.error("Failed to cancel job:", error);
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

  // In storyboard mode, skip collapsed view entirely
  if (!isExpanded && !isStoryboardMode) {
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
              {scene.bRollShots && scene.bRollShots.length > 0 && (
                <Chip
                  size="sm"
                  variant="flat"
                  className="bg-amber-500/30 text-amber-300"
                  startContent={<Icon icon="solar:video-library-bold" width={10} />}
                >
                  {scene.bRollShots.length} shots
                </Chip>
              )}
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
            {scene.bRollShots && scene.bRollShots.length > 0 && (
              <Chip
                size="sm"
                variant="flat"
                className="bg-amber-500/30 text-amber-300"
                startContent={<Icon icon="solar:video-library-bold" width={10} />}
              >
                {scene.bRollShots.length} shots
              </Chip>
            )}
            <span className="text-xs text-text-muted">
              {scene.estimatedDurationSeconds}s
            </span>
          </div>
          {/* Hide collapse button in storyboard mode - use timeline for navigation */}
          {!isStoryboardMode && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => setIsExpanded(false)}
            >
              <Icon icon="solar:alt-arrow-up-linear" width={16} />
            </Button>
          )}
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

        <div className="flex items-start gap-3">
          <div className="flex-1">
            <Input
              value={localRefinement}
              onChange={(e) => setLocalRefinement(e.target.value)}
              onBlur={handleRefinementBlur}
              placeholder="Custom prompt for this scene..."
              size="sm"
              startContent={<Icon icon="solar:pen-bold-duotone" className="text-text-muted" width={14} />}
              classNames={{
                input: "text-sm",
                inputWrapper: "bg-surface-base border-border-base",
              }}
            />
          </div>
          <SupportingImageUploader
            teamId={teamId}
            maxImages={3}
            images={supportingImages}
            onImagesChange={handleSupportingImagesChange}
          />
        </div>

        {/* Advanced options hidden - keeping code for future use */}

        {generation?.status === "generating" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {generation.progressMessage}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-accent-400 font-medium">
                  {generation.progress}%
                </span>
                <Button
                  size="sm"
                  variant="flat"
                  className="bg-red-500/20 text-red-400 h-6 min-w-0 px-2"
                  onPress={handleCancel}
                  startContent={<Icon icon="solar:close-circle-bold" width={12} />}
                >
                  Cancel
                </Button>
              </div>
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
          <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <Icon icon="solar:danger-triangle-bold" width={16} />
              <span>{generation.error || "Generation failed"}</span>
            </div>
            <Button
              size="sm"
              variant="flat"
              className="bg-red-500/20 text-red-400 h-7"
              onPress={() => handleGenerate()}
              startContent={<Icon icon="solar:refresh-bold" width={14} />}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* B-Roll Shots Display - shown for B-roll scenes */}
        {scene.bRollShots && scene.bRollShots.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <Icon icon="solar:video-library-bold" width={14} />
                <span className="font-medium">B-Roll Shots ({scene.bRollShots.length})</span>
              </div>
              <span className="text-[10px] text-text-muted">Click to select, double-click to zoom</span>
            </div>
            <div className="space-y-2">
              {scene.bRollShots.map((shot, idx) => {
                const generatedImage = generation?.generatedImages?.[idx];
                const customImage = customBRollImages?.[idx];
                // Custom image takes priority over generated
                const shotImage = customImage || generatedImage;
                const isCustom = !!customImage;
                const isSelected = selectedBRollIndex === idx;
                const isUploadingThis = uploadingShotIndex === idx;
                // Only show this shot as regenerating if it's the specific shot being regenerated
                // OR if all shots are regenerating (regeneratingShotIndex === null and isGenerating)
                const isShotRegenerating = isCurrentlyGenerating && (
                  regeneratingShotIndex === null || regeneratingShotIndex === idx
                );
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-2 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-400"
                        : "bg-surface-base border-border-base hover:border-amber-400/50"
                    }`}
                    onClick={() => setSelectedBRollIndex(isSelected ? null : idx)}
                  >
                    <div
                      className={`w-16 h-20 rounded-lg overflow-hidden ring-2 relative transition-all shrink-0 ${
                        isShotRegenerating
                          ? "ring-blue-400 animate-pulse"
                          : shotImage?.url
                            ? isCustom
                              ? isSelected ? "ring-green-400" : "ring-green-400/50"
                              : isSelected ? "ring-amber-400" : "ring-amber-400/50"
                            : "ring-border-base bg-surface-elevated"
                      }`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (shotImage?.url && !isShotRegenerating) setZoomImageUrl(shotImage.url);
                      }}
                    >
                      {isShotRegenerating ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-blue-500/20">
                          <Icon icon="solar:refresh-bold" className="text-blue-400 animate-spin" width={16} />
                          <span className="text-[9px] text-blue-400">Regenerating</span>
                        </div>
                      ) : shotImage?.url ? (
                        <>
                          <img
                            src={shotImage.url}
                            alt={`Shot ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full flex items-center justify-center ${isCustom ? "bg-green-400" : "bg-amber-400"}`}>
                            {isCustom ? (
                              <Icon icon="solar:upload-bold" className="text-white" width={8} />
                            ) : (
                              <span className="text-[9px] font-bold text-white">{idx + 1}</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                          <Icon icon="solar:gallery-add-bold-duotone" className="text-text-muted" width={16} />
                          <span className="text-[9px] text-text-muted">{idx + 1}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-medium text-amber-400">Shot {idx + 1}</span>
                        <span className="text-[10px] text-text-muted">{shot.durationSeconds}s</span>
                        {isCustom && (
                          <Chip size="sm" className="bg-green-500/20 text-green-400 h-4 text-[9px]">
                            Custom
                          </Chip>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary line-clamp-2">{shot.action}</p>
                    </div>
                    {isSelected && (
                      <div className="flex gap-1 shrink-0">
                        {shotImage?.url && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            className="bg-amber-500/20 text-amber-400"
                            onPress={() => setZoomImageUrl(shotImage.url)}
                          >
                            <Icon icon="solar:magnifer-zoom-in-bold" width={14} />
                          </Button>
                        )}
                        {/* Upload custom image button */}
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          className={isCustom ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"}
                          isLoading={isUploadingThis}
                          onPress={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = "image/*";
                            input.onchange = (e) => handleBRollFileSelect(e as any, idx);
                            input.click();
                          }}
                        >
                          <Icon icon="solar:upload-bold" width={14} />
                        </Button>
                        {/* Remove custom image button */}
                        {isCustom && onCustomBRollImageChange && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            className="bg-red-500/20 text-red-400"
                            onPress={() => onCustomBRollImageChange(idx, undefined, undefined)}
                          >
                            <Icon icon="solar:trash-bin-trash-bold" width={14} />
                          </Button>
                        )}
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          className="bg-blue-500/20 text-blue-400"
                          isLoading={isShotRegenerating}
                          isDisabled={isCurrentlyGenerating}
                          onPress={() => handleGenerate(idx)}
                        >
                          <Icon icon="solar:refresh-bold" width={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular scene image display - for non-B-roll scenes */}
        {!scene.bRollShots && (imageKey || (generation?.status === "completed" && (generation.generatedImages?.length ?? 0) > 0)) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Icon icon="solar:gallery-check-bold" width={14} />
              <span>Generated image (click to zoom)</span>
            </div>
            <div className="flex items-center justify-center">
              <div
                className={`w-28 h-36 rounded-lg overflow-hidden bg-surface-base ring-2 relative transition-all ${
                  isGenerating
                    ? "ring-blue-500 animate-pulse"
                    : "ring-accent-400 cursor-zoom-in hover:ring-accent-300"
                }`}
                onClick={() =>
                  !isGenerating &&
                  setZoomImageUrl(imageUrl || generation?.generatedImages?.[0]?.url || null)
                }
              >
                <img
                  src={imageUrl || generation?.generatedImages?.[0]?.url}
                  alt="Scene image"
                  className={`w-full h-full object-cover ${isGenerating ? "opacity-50" : ""}`}
                />
                {!isGenerating && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent-400 flex items-center justify-center">
                    <Icon icon="solar:check-circle-bold" className="text-white" width={10} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border-base">
          <div className="flex items-center gap-2">
            {hasImage && (
              <span className="text-xs text-accent-400 flex items-center gap-1">
                <Icon icon="solar:check-circle-bold" width={14} />
                {scene.bRollShots ? `${generation?.generatedImages?.length || 0} shots ready` : "Image ready"}
              </span>
            )}
          </div>

          <Button
            className={hasImage ? "border-border-base text-text-secondary" : "bg-accent-400 text-white"}
            variant={hasImage ? "bordered" : "solid"}
            size="sm"
            onPress={() => handleGenerate()}
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
            {hasImage
              ? (scene.bRollShots ? "Regenerate All" : "Regenerate")
              : (scene.bRollShots ? "Generate Shots" : "Generate Image")}
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
