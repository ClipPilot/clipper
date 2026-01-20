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
  Switch,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { SCENE_TYPE_CONFIG, type UGCScene } from "../script/types";
import { SupportingImageUploader } from "./SupportingImageUploader";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import type { SupportingImage, SceneImageGeneration } from "./types";

type RegenerateMode = "both" | "start" | "end";

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
  onGenerationStart: (jobId: string) => void;
  onGenerationUpdate: (status: SceneImageGeneration) => void;
  onImageSelect: (key: string, url: string) => void;
  onRefinementChange: (refinement: string) => void;
  onSupportingImagesChange: (keys: string[]) => void;
  onUseEndFrameChange: (useEndFrame: boolean) => void;
  onCustomImageChange: (type: "start" | "end", key: string | undefined, url: string | undefined) => void;
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
  onGenerationStart,
  onGenerationUpdate,
  onImageSelect,
  onRefinementChange,
  onSupportingImagesChange,
  onUseEndFrameChange,
  onCustomImageChange,
  isStoryboardMode = false,
}: SceneImageCardProps) {
  // In storyboard mode, always show expanded view
  const [isExpanded, setIsExpanded] = useState(isStoryboardMode);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localRefinement, setLocalRefinement] = useState(userRefinement || "");
  const [supportingImages, setSupportingImages] = useState<SupportingImage[]>(
    []
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingEndFrame, setIsGeneratingEndFrame] = useState(false);
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
            setIsGeneratingEndFrame(false);
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
            setIsGeneratingEndFrame(false);
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

  const handleGenerate = async (mode: RegenerateMode = "both") => {
    if (mode === "end") {
      setIsGeneratingEndFrame(true);
    } else {
      setIsGenerating(true);
    }

    // Determine what to keep vs regenerate based on mode
    const existingEndFrame = generation?.generatedImages?.[1]?.key;

    const requestData = {
      teamId,
      scriptId,
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      characterId,
      userRefinement: localRefinement || undefined,
      supportingImageKeys: supportingImageKeys,
      generateEndFrame: mode === "both" ? useEndFrame : mode === "end",
      // When regenerating end only, keep the existing start image
      customStartImageKey: mode === "end" ? imageKey : customStartImageKey,
      // When regenerating start only, keep the existing end image
      customEndImageKey: mode === "start" ? existingEndFrame : customEndImageKey,
    };

    try {
      const response = await sceneBuilderAPI.generateSceneImages(requestData);
      onGenerationStart(response.jobId);
    } catch (error) {
      console.error("Failed to start generation:", error);
      setIsGenerating(false);
      setIsGeneratingEndFrame(false);
    }
  };

  const handleUseEndFrameToggle = async (enabled: boolean) => {
    onUseEndFrameChange(enabled);

    if (enabled) {
      // Auto-generate end frame if start exists and no end frame yet
      if (imageKey && !customEndImageKey && (generation?.generatedImages?.length ?? 0) < 2) {
        handleGenerate("end");
      }
    } else {
      // Clear end frame data when disabled
      onCustomImageChange("end", undefined, undefined);

      // Remove end frame from generated images if it exists
      if (generation?.generatedImages && generation.generatedImages.length > 1) {
        onGenerationUpdate({
          ...generation,
          generatedImages: [generation.generatedImages[0]], // Keep only start frame
        });
      }
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

        <div className="border border-border-base rounded-lg overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-2 bg-surface-base hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-2">
              <Icon icon="solar:settings-bold-duotone" className="text-text-muted" width={14} />
              <span className="text-xs font-medium text-text-primary">Advanced</span>
              {(useEndFrame || customStartImageKey || customEndImageKey) && (
                <span className="text-[10px] text-accent-400 bg-accent-400/10 px-1.5 py-0.5 rounded">Active</span>
              )}
            </div>
            <Icon icon={showAdvanced ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} className="text-text-muted" width={14} />
          </button>

          {showAdvanced && (
            <div className="p-3 space-y-3 border-t border-border-base">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:video-frame-play-horizontal-bold-duotone" className="text-text-muted" width={14} />
                  <span className="text-xs text-text-primary">Use End Frame</span>
                </div>
                <Switch
                  isSelected={useEndFrame || false}
                  onValueChange={handleUseEndFrameToggle}
                  isDisabled={isGeneratingEndFrame}
                  size="sm"
                  classNames={{ wrapper: "group-data-[selected=true]:bg-accent-400" }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:gallery-add-bold" className="text-text-muted" width={12} />
                  <span className="text-[10px] text-text-muted">Custom images (upload your own)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-text-muted">Start</span>
                  {customStartImageUrl ? (
                    <div className="relative group">
                      <div
                        className="w-12 h-14 rounded-md overflow-hidden bg-surface-elevated cursor-zoom-in ring-2 ring-accent-400"
                        onClick={() => setZoomImageUrl(customStartImageUrl)}
                      >
                        <img src={customStartImageUrl} alt="Start" className="w-full h-full object-cover" />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCustomImageRemove("start"); }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Icon icon="solar:close-circle-bold" width={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-12 h-14 rounded-md border-2 border-dashed border-border-base flex flex-col items-center justify-center cursor-pointer hover:border-accent-400/50 transition-colors">
                      <Icon icon="solar:upload-bold" className="text-text-muted" width={12} />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleCustomImageUpload("start", file); }} />
                    </label>
                  )}
                </div>

                {useEndFrame && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-text-muted">End</span>
                    {customEndImageUrl ? (
                      <div className="relative group">
                        <div
                          className="w-12 h-14 rounded-md overflow-hidden bg-surface-elevated cursor-zoom-in ring-2 ring-accent-400"
                          onClick={() => setZoomImageUrl(customEndImageUrl)}
                        >
                          <img src={customEndImageUrl} alt="End" className="w-full h-full object-cover" />
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCustomImageRemove("end"); }}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Icon icon="solar:close-circle-bold" width={10} />
                        </button>
                      </div>
                    ) : (
                      <label className="w-12 h-14 rounded-md border-2 border-dashed border-border-base flex flex-col items-center justify-center cursor-pointer hover:border-accent-400/50 transition-colors">
                        <Icon icon="solar:upload-bold" className="text-text-muted" width={12} />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleCustomImageUpload("end", file); }} />
                      </label>
                    )}
                  </div>
                )}
                </div>
              </div>
            </div>
          )}
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

        {(imageKey || (generation?.status === "completed" && (generation.generatedImages?.length ?? 0) > 0)) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Icon icon="solar:gallery-check-bold" width={14} />
              <span>Generated {(generation?.generatedImages?.length ?? 0) > 1 ? "frames" : "image"} (click to zoom)</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-text-secondary">
                  {useEndFrame || (generation?.generatedImages?.length ?? 0) > 1 ? "Start Frame" : "Scene Image"}
                </span>
                <div
                  className={`w-24 h-32 rounded-lg overflow-hidden bg-surface-base ring-2 relative transition-all ${
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
                    alt="Start frame"
                    className={`w-full h-full object-cover ${isGenerating ? "opacity-50" : ""}`}
                  />
                  {!isGenerating && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent-400 flex items-center justify-center">
                      <Icon icon="solar:check-circle-bold" className="text-white" width={10} />
                    </div>
                  )}
                </div>
              </div>

              {(generation?.generatedImages?.length ?? 0) > 1 && (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary">End Frame</span>
                  <div
                    className="w-24 h-32 rounded-lg overflow-hidden bg-surface-base ring-2 ring-accent-400 cursor-zoom-in hover:ring-accent-300 relative transition-all"
                    onClick={() => setZoomImageUrl(generation?.generatedImages?.[1]?.url || null)}
                  >
                    <img
                      src={generation?.generatedImages?.[1]?.url}
                      alt="End frame"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent-400 flex items-center justify-center">
                      <Icon icon="solar:check-circle-bold" className="text-white" width={10} />
                    </div>
                  </div>
                </div>
              )}
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

          {/* Show dropdown when both frames exist, otherwise show simple button */}
          {hasImage && (generation?.generatedImages?.length ?? 0) > 1 ? (
            <Dropdown>
              <DropdownTrigger>
                <Button
                  className="border-border-base text-text-secondary"
                  variant="bordered"
                  size="sm"
                  isLoading={isGenerating || isGeneratingEndFrame || generation?.status === "generating"}
                  isDisabled={generation?.status === "generating"}
                  endContent={<Icon icon="solar:alt-arrow-down-linear" width={14} />}
                  startContent={<Icon icon="solar:refresh-bold" width={14} />}
                >
                  Regenerate
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Regenerate options"
                onAction={(key) => handleGenerate(key as RegenerateMode)}
              >
                <DropdownItem
                  key="start"
                  startContent={<Icon icon="solar:play-bold" width={14} />}
                  description="Keep end frame, regenerate start"
                >
                  Start Frame
                </DropdownItem>
                <DropdownItem
                  key="end"
                  startContent={<Icon icon="solar:stop-bold" width={14} />}
                  description="Keep start frame, regenerate end"
                >
                  End Frame
                </DropdownItem>
                <DropdownItem
                  key="both"
                  startContent={<Icon icon="solar:restart-bold" width={14} />}
                  description="Regenerate both frames"
                  className="text-warning"
                >
                  Both Frames
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          ) : (
            <Button
              className={hasImage ? "border-border-base text-text-secondary" : "bg-accent-400 text-white"}
              variant={hasImage ? "bordered" : "solid"}
              size="sm"
              onPress={() => handleGenerate("both")}
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
          )}
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
