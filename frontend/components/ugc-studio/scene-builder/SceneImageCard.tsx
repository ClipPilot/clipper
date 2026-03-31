"use client";

import { useState, useEffect, useRef } from "react";
import {
  Button,
  Chip,
  ProgressBar,
  Modal,
  Input,
  TextArea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SCENE_TYPE_CONFIG, type UGCScene, type BRollShot } from "../script/types";
import { EmotionSelector } from "../script/EmotionSelector";
import { CameraAngleSelector } from "../script/CameraAngleSelector";
import { SupportingImageUploader } from "./SupportingImageUploader";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import { ugcScriptAPI } from "@/api/ugc";
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
  /** Called when scene text fields are edited inline (dialogue, action, b-roll actions) */
  onSceneUpdate?: (updatedScene: UGCScene) => void;
  /** Called when B-roll save/regeneration starts or finishes (prevents navigation during regeneration) */
  onSavingStateChange?: (isSaving: boolean) => void;
  /** When true, always shows expanded view (used in storyboard mode) */
  isStoryboardMode?: boolean;
  /** Called when user requests AI regeneration of dialogue + action with optional custom prompt */
  onRegenerateScene?: (customPrompt?: string) => Promise<void>;
  /** Override for single B-roll prompt regeneration (ad clone uses different API) */
  onRegenerateBRollPrompt?: (params: {
    sceneId: string;
    bRollShotIndex: number;
    newAction: string;
  }) => Promise<void>;
  /** Override for regenerating all B-roll shots when scene action changes */
  onRegenerateAllBRollShots?: (params: {
    sceneId: string;
    newSceneAction: string;
    shotCount: number;
    shotDurations: number[];
  }) => Promise<{ bRollShots: BRollShot[] }>;
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
  onSceneUpdate,
  onSavingStateChange,
  onCustomBRollImageChange,
  isStoryboardMode = false,
  onRegenerateScene,
  onRegenerateBRollPrompt,
  onRegenerateAllBRollShots,
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
  // Track which B-roll shot is being saved + regenerated
  const [savingBRollIndex, setSavingBRollIndex] = useState<number | null>(null);
  // Track the current phase of b-roll regeneration
  const [regenPhase, setRegenPhase] = useState<"updating-prompts" | "generating-images" | null>(null);

  // Keep a ref to latest scene to avoid stale closures in async callbacks
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  // Visible error state for b-roll regeneration failures
  const [bRollError, setBRollError] = useState<string | null>(null);

  // Inline editing state for storyboard mode
  const [editingField, setEditingField] = useState<"dialogue" | "action" | null>(null);
  const [editingBRollIndex, setEditingBRollIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Scene regeneration state
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState("");
  const [isRegeneratingScene, setIsRegeneratingScene] = useState(false);

  const handleRegenerateScene = async () => {
    if (!onRegenerateScene) return;
    setIsRegeneratingScene(true);
    try {
      await onRegenerateScene(regenPrompt.trim() || undefined);
      setShowRegenInput(false);
      setRegenPrompt("");
    } catch (error) {
      console.error("Failed to regenerate scene:", error);
    } finally {
      setIsRegeneratingScene(false);
    }
  };

  const startEditing = (field: "dialogue" | "action") => {
    if (!onSceneUpdate) return;
    setEditingField(field);
    setEditValue(field === "dialogue" ? scene.dialogue : scene.action);
    setEditingBRollIndex(null);
  };

  const startEditingBRoll = (index: number) => {
    if (!onSceneUpdate || !scene.bRollShots?.[index]) return;
    setEditingBRollIndex(index);
    setEditValue(scene.bRollShots[index].action);
    setEditingField(null);
  };

  const saveEdit = async () => {
    if (!onSceneUpdate) return;
    if (editingField === "dialogue" && editValue !== scene.dialogue) {
      onSceneUpdate({ ...scene, dialogue: editValue });
    } else if (editingField === "action" && editValue !== scene.action) {
      await onSceneUpdate({ ...scene, action: editValue });
      setEditingField(null);

      if (scene.bRollShots && scene.bRollShots.length > 0 && onRegenerateAllBRollShots) {
        setBRollError(null);
        onSavingStateChange?.(true);
        try {
          // Phase 1: Regenerate all shot descriptions from new scene action
          setRegenPhase("updating-prompts");
          const shotDurations = scene.bRollShots.map((s) => s.durationSeconds);
          const result = await onRegenerateAllBRollShots({
            sceneId: sceneRef.current.id,
            newSceneAction: editValue,
            shotCount: scene.bRollShots.length,
            shotDurations,
          });

          // Update frontend state with new shot descriptions
          await onSceneUpdate({ ...sceneRef.current, bRollShots: result.bRollShots });

          // Phase 2: Regenerate images with updated prompts
          setRegenPhase("generating-images");
          await handleGenerate();
        } catch (error) {
          console.error("Failed to regenerate B-roll shots:", error);
          setBRollError(error instanceof Error ? error.message : "Failed to regenerate shots.");
          setRegenPhase(null);
        } finally {
          onSavingStateChange?.(false);
        }
      }
      return;
    }
    setEditingField(null);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditingBRollIndex(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingBRollIndex !== null) {
        handleSaveBRoll();
      } else {
        saveEdit();
      }
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const handleSaveBRoll = async () => {
    if (!onSceneUpdate || editingBRollIndex === null || !scene.bRollShots) return;
    const currentIndex = editingBRollIndex;
    const originalAction = scene.bRollShots[currentIndex]?.action;
    const actionChanged = editValue !== originalAction;

    // Update the scene with new action text
    const updatedShots = scene.bRollShots.map((shot, idx) =>
      idx === currentIndex ? { ...shot, action: editValue } : shot
    );
    await onSceneUpdate({ ...scene, bRollShots: updatedShots });
    setEditingBRollIndex(null);

    // If action changed, regenerate the cinematic prompt then auto-regenerate ALL b-roll shots
    if (actionChanged) {
      setSavingBRollIndex(currentIndex);
      setBRollError(null);
      onSavingStateChange?.(true);
      try {
        // Phase 1: Regenerate cinematic prompt via LLM
        setRegenPhase("updating-prompts");
        if (onRegenerateBRollPrompt) {
          await onRegenerateBRollPrompt({
            sceneId: sceneRef.current.id,
            bRollShotIndex: currentIndex,
            newAction: editValue,
          });
        } else {
          await ugcScriptAPI.regenerateBRollPrompt({
            scriptId,
            sceneId: sceneRef.current.id,
            bRollShotIndex: currentIndex,
            newAction: editValue,
          });
        }
        // Phase 2: Regenerate all shot images (use ref to avoid stale closure)
        setRegenPhase("generating-images");
        await handleGenerate();
      } catch (error) {
        console.error("Failed to regenerate B-roll prompt:", error);
        setBRollError(error instanceof Error ? error.message : "Failed to regenerate shots. Please try again.");
        setRegenPhase(null);
      } finally {
        setSavingBRollIndex(null);
        onSavingStateChange?.(false);
      }
    }
  };

  const handleAddBRollShot = () => {
    if (!onSceneUpdate) return;
    const newShot: BRollShot = {
      action: "Product showcase",
      cinematicPrompt: "Close-up shot of the product",
      durationSeconds: 3,
      productImageNeeded: true,
    };
    const currentShots = scene.bRollShots || [];
    onSceneUpdate({ ...scene, bRollShots: [...currentShots, newShot] });
  };

  const handleRemoveBRollShot = (index: number) => {
    if (!onSceneUpdate || !scene.bRollShots || scene.bRollShots.length <= 1) return;
    const newShots = scene.bRollShots.filter((_, i) => i !== index);
    onSceneUpdate({ ...scene, bRollShots: newShots });
    // If we removed the selected shot, deselect
    if (selectedBRollIndex === index) setSelectedBRollIndex(null);
  };

  const sceneConfig = SCENE_TYPE_CONFIG[scene.sceneType];
  const hasImage = !!imageKey;

  // Reset local generating state when generation completes (global polling handles the actual polling)
  useEffect(() => {
    if (generation?.status === "completed" || generation?.status === "failed") {
      setIsGenerating(false);
      setRegeneratingShotIndex(null);
      setRegenPhase(null);
    }
  }, [generation?.status]);

  const handleGenerate = async (singleShotIndex?: number) => {
    setIsGenerating(true);
    // Track which specific shot is being regenerated (null means all)
    setRegeneratingShotIndex(singleShotIndex ?? null);

    // Use ref to get latest scene data (avoids stale closure after onSceneUpdate re-renders)
    const currentScene = sceneRef.current;

    // Build existing images array, merging custom images with generated images
    let existingImages: string[] | undefined;

    if (singleShotIndex !== undefined && currentScene.bRollShots) {
      existingImages = currentScene.bRollShots.map((_, idx) => {
        // Use custom image if available, otherwise use generated image
        const customImage = customBRollImages?.[idx];
        const generatedImage = generation?.generatedImages?.[idx];
        const key = customImage?.key || generatedImage?.key || "";
        return key;
      }).filter(Boolean);

      // Only pass if we have some existing images to preserve
      if (existingImages.length === 0) {
        existingImages = undefined;
      }
    }

    // Use local supportingImages state if available (more up-to-date), fall back to props
    const currentSupportingKeys = supportingImages.length > 0
      ? supportingImages.map(img => img.key)
      : supportingImageKeys;

    const requestData = {
      teamId,
      scriptId,
      sceneId: currentScene.id,
      sceneNumber: currentScene.sceneNumber,
      characterId,
      userRefinement: localRefinement || undefined,
      supportingImageKeys: currentSupportingKeys,
      generateEndFrame: false,
      singleBRollShotIndex: singleShotIndex,
      existingBRollImages: existingImages,
      // Pass existing scene image for regeneration reference
      existingSceneImageKey: imageKey || undefined,
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

  const [uploadingShotIndex, setUploadingShotIndex] = useState<number | null>(null);

  const handleBRollImageUpload = async (shotIndex: number, file: File) => {
    if (!onCustomBRollImageChange) return;
    setUploadingShotIndex(shotIndex);
    try {
      const baseKey = generation?.generatedImages?.[0]?.key;

      if (baseKey) {
        const targetKey = baseKey.replace(/variant_\d+/, `variant_${shotIndex}`);
        const { key, url } = await sceneBuilderAPI.uploadToKey(targetKey, file);
        onCustomBRollImageChange(shotIndex, key, url);
      } else {
        const { key, url } = await sceneBuilderAPI.uploadSupportingImage(teamId, file);
        onCustomBRollImageChange(shotIndex, key, url);
      }
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
      <div
 onClick={() => setIsExpanded(true)}
 className={`rounded-xl bg-surface-elevated border transition-all cursor-pointer overflow-hidden ${
 isCurrentlyGenerating
 ? "border-blue-500 animate-pulse"
 : hasImage
 ? "border-accent-400/30 hover:border-accent-400/50"
 : "border-border-base hover:border-accent-400/30"
 }`}
 >
        <div className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs font-medium text-text-muted shrink-0">
                Scene {scene.sceneNumber}
              </span>
              <Chip
 size="sm"
 className={`${sceneConfig.color} shrink-0`}
 >
                <Icon icon={sceneConfig.icon} width={10} />
                {sceneConfig.label}
              </Chip>
              <Chip
 size="sm"
 variant="tertiary"
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
 variant="tertiary"
 className="bg-amber-500/30 text-amber-300"
 >
                  <Icon icon="solar:video-library-bold" width={10} />
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
        </div>

        <Modal>
          <Modal.Backdrop isOpen={!!zoomImageUrl} onOpenChange={() => setZoomImageUrl(null)}><Modal.Container><Modal.Dialog className="sm:max-w-2xl">
            <Modal.Body>
              <div className="relative flex items-center justify-center">
                <Button
 isIconOnly
 className="absolute top-2 right-2 z-10 bg-black/50 text-white"
 variant="tertiary"
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
            </Modal.Body>
          </Modal.Dialog></Modal.Container></Modal.Backdrop>
        </Modal>
      </div>
    );
  }

  return (
    <Card
      className={`bg-surface-elevated border ${
        isCurrentlyGenerating
          ? "border-blue-500 animate-pulse"
          : (scene.shotType === "a-roll" && !scene.dialogue?.trim()) || (scene.shotType === "a-roll-multi" && (!scene.arollShots?.length || scene.arollShots.some((s: any) => !s.dialogue?.trim())))
            ? "border-red-500/60"
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
 >
              <Icon icon={sceneConfig.icon} width={12} />
              {sceneConfig.label}
            </Chip>
            <Chip
 size="sm"
 variant="tertiary"
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
 variant="tertiary"
 className="bg-amber-500/30 text-amber-300"
 >
                <Icon icon="solar:video-library-bold" width={10} />
                {scene.bRollShots.length} shots
              </Chip>
            )}
            <span className="text-xs text-text-muted">
              {scene.estimatedDurationSeconds}s
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onRegenerateScene && (
              <Button
 size="sm"
 variant="tertiary"
 className="bg-purple-500/20 text-purple-400 h-7"
 onPress={() => setShowRegenInput(!showRegenInput)}
 isPending={isRegeneratingScene}
 >
                {!isRegeneratingScene ? <Icon icon="solar:magic-stick-3-bold" width={14} /> : undefined}
                Regen Scene
              </Button>
            )}
            {/* Hide collapse button in storyboard mode - use timeline for navigation */}
            {!isStoryboardMode && (
              <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 onPress={() => setIsExpanded(false)}
 >
                <Icon icon="solar:alt-arrow-up-linear" width={16} />
              </Button>
            )}
          </div>
        </div>

        {/* Regenerate scene inline input */}
        {showRegenInput && onRegenerateScene && (
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-lg p-2">
            <Icon icon="solar:magic-stick-3-bold" width={16} className="text-purple-400 shrink-0" />
            <input
              type="text"
              value={regenPrompt}
              onChange={(e) => setRegenPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRegenerateScene();
                if (e.key === "Escape") { setShowRegenInput(false); setRegenPrompt(""); }
              }}
              placeholder="Custom direction (optional)..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
              autoFocus
            />
            <Button
 size="sm"
 className="bg-purple-500 text-white h-7 min-w-0 px-3"
 onPress={handleRegenerateScene}
 isPending={isRegeneratingScene}
 >
              Regenerate
            </Button>
            <Button
              isIconOnly
              variant="tertiary"
              size="sm"
              onPress={() => { setShowRegenInput(false); setRegenPrompt(""); }}
              className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
            >
              <Icon icon="solar:close-circle-bold" width={16} />
            </Button>
          </div>
        )}

        {/* Dialogue (or silent b-roll indicator) */}
        {scene.shotType === "b-roll" && !scene.dialogue ? (
          <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:volume-cross-bold" width={14} className="text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Silent B-roll</span>
                <span className="text-xs text-text-muted">{scene.estimatedDurationSeconds}s</span>
              </div>
              {onSceneUpdate && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[3, 5, 7, 10].map((d) => (
                      <div
                        key={d}
                        onClick={() => onSceneUpdate({ ...scene, estimatedDurationSeconds: d })}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                          scene.estimatedDurationSeconds === d
                            ? "bg-amber-500 text-white"
                            : "bg-surface-base text-text-muted hover:text-amber-400"
                        }`}
                      >
                        {d}s
                      </div>
                    ))}
                  </div>
                  <Button
                    isIconOnly
                    variant="tertiary"
                    size="sm"
                    onPress={() => onSceneUpdate({ ...scene, dialogue: "Add voiceover text here..." })}
                    className="p-1 rounded hover:bg-accent-400/20 text-text-muted hover:text-accent-400 transition-colors"
                    aria-label="Add voiceover"
                  >
                    <Icon icon="solar:volume-loud-bold" width={14} />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-surface-base rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                {editingField === "dialogue" ? (
                  <TextArea
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className="w-full bg-surface-base/50 text-text-primary text-sm leading-relaxed resize-none outline-none border border-accent-400/30 rounded px-2 py-1 focus:ring-1 focus:ring-accent-400/50"
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                    rows={1}
                  />
                ) : (
                  <p className="text-text-primary text-sm leading-relaxed">
                    &ldquo;{scene.dialogue}&rdquo;
                  </p>
                )}
              </div>
              {onSceneUpdate && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {editingField === "dialogue" ? (
                    <>
                      <Button
                        isIconOnly
                        variant="tertiary"
                        size="sm"
                        onPress={saveEdit}
                        className="p-1 rounded hover:bg-green-500/20 text-green-400 transition-colors"
                      >
                        <Icon icon="solar:check-circle-bold" width={18} />
                      </Button>
                      <Button
                        isIconOnly
                        variant="tertiary"
                        size="sm"
                        onPress={cancelEdit}
                        className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                      >
                        <Icon icon="solar:close-circle-bold" width={18} />
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <Button
                        isIconOnly
                        variant="tertiary"
                        size="sm"
                        onPress={() => startEditing("dialogue")}
                        className="p-1 rounded hover:bg-accent-400/20 text-text-muted hover:text-accent-400 transition-colors"
                      >
                        <Icon icon="solar:pen-2-bold" width={16} />
                      </Button>
                      {scene.shotType === "b-roll" && (
                        <Button
                          isIconOnly
                          variant="tertiary"
                          size="sm"
                          onPress={() => onSceneUpdate({ ...scene, dialogue: "", estimatedDurationSeconds: scene.estimatedDurationSeconds || 5 })}
                          className="p-1 rounded hover:bg-amber-500/20 text-text-muted hover:text-amber-400 transition-colors"
                          aria-label="Remove voiceover (silent b-roll)"
                        >
                          <Icon icon="solar:volume-cross-bold" width={16} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {scene.shotType === "a-roll" && !scene.dialogue?.trim() && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <Icon icon="solar:danger-triangle-bold" width={14} className="text-red-400" />
            <span className="text-xs text-red-400">A-roll scenes require dialogue to proceed</span>
          </div>
        )}

        {scene.shotType === "a-roll-multi" && (!scene.arollShots?.length || scene.arollShots.some((s: any) => !s.dialogue?.trim())) && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <Icon icon="solar:danger-triangle-bold" width={14} className="text-red-400" />
            <span className="text-xs text-red-400">Podcast scenes require dialogue in all conversation turns</span>
          </div>
        )}

        {/* Action */}
        <div className="flex items-start gap-2 text-sm text-text-secondary">
          <Icon icon="solar:running-bold" width={14} className="text-text-muted shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {editingField === "action" ? (
              <TextArea
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full bg-surface-base/50 text-text-secondary text-sm leading-relaxed resize-none outline-none border border-accent-400/30 rounded px-2 py-1 focus:ring-1 focus:ring-accent-400/50"
                style={{ fieldSizing: "content" } as React.CSSProperties}
                rows={1}
              />
            ) : (
              <span>{scene.action}</span>
            )}
          </div>
          {onSceneUpdate && (
            <div className="flex items-center gap-0.5 shrink-0">
              {editingField === "action" ? (
                <>
                  <Button
                    isIconOnly
                    variant="tertiary"
                    size="sm"
                    onPress={saveEdit}
                    className="p-1 rounded hover:bg-green-500/20 text-green-400 transition-colors"
                  >
                    <Icon icon="solar:check-circle-bold" width={18} />
                  </Button>
                  <Button
                    isIconOnly
                    variant="tertiary"
                    size="sm"
                    onPress={cancelEdit}
                    className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold" width={18} />
                  </Button>
                </>
              ) : (
                <Button
                  isIconOnly
                  variant="tertiary"
                  size="sm"
                  onPress={() => startEditing("action")}
                  className="p-1 rounded hover:bg-accent-400/20 text-text-muted hover:text-accent-400 transition-colors"
                >
                  <Icon icon="solar:pen-2-bold" width={16} />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Metadata row — emotion + camera angle selectors (camera angle hidden for b-roll) */}
        {onSceneUpdate && (
          <div className="flex items-center gap-4">
            <EmotionSelector
              value={scene.emotion}
              onChange={(emotion) => onSceneUpdate({ ...scene, emotion })}
              compact
            />
            {scene.shotType !== "b-roll" && (
              <CameraAngleSelector
                value={scene.cameraAngle}
                onChange={(cameraAngle) =>
                  onSceneUpdate({ ...scene, cameraAngle })
                }
              />
            )}
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Icon icon="solar:pen-bold-duotone" className="text-text-muted" width={14} />
              </div>
              <Input
 value={localRefinement}
 onChange={(e) => setLocalRefinement(e.target.value)}
 onBlur={handleRefinementBlur}
 placeholder="Custom prompt for this scene..."
 className="pl-9"
 />
            </div>
          </div>
          <SupportingImageUploader
            teamId={teamId}
            maxImages={3}
            images={supportingImages}
            onImagesChange={handleSupportingImagesChange}
          />
        </div>


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
 variant="tertiary"
 className="bg-red-500/20 text-red-400 h-6 min-w-0 px-2"
 onPress={handleCancel}
 >
                  <Icon icon="solar:close-circle-bold" width={12} />
                  Cancel
                </Button>
              </div>
            </div>
            <ProgressBar
 value={generation.progress}
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
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
 variant="tertiary"
 className="bg-red-500/20 text-red-400 h-7"
 onPress={() => handleGenerate()}
 >
              <Icon icon="solar:refresh-bold" width={14} />
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
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted">Click to select</span>
                {onSceneUpdate && (
                  <Button
 size="sm"
 variant="tertiary"
 className="bg-amber-500/20 text-amber-400 h-6 min-w-0 px-2"
 onPress={handleAddBRollShot}
 >
                    <Icon icon="solar:add-circle-bold" width={12} />
                    Add Shot
                  </Button>
                )}
              </div>
            </div>
            {/* Regeneration phase indicator */}
            {regenPhase && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                regenPhase === "updating-prompts"
                  ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                  : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
              }`}>
                <Icon icon="solar:refresh-bold" className="animate-spin" width={14} />
                <span>
                  {regenPhase === "updating-prompts"
                    ? "Regenerating shots..."
                    : "Generating images..."}
                </span>
              </div>
            )}
            {/* B-roll regeneration error banner */}
            {bRollError && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400 text-xs">
                  <Icon icon="solar:danger-triangle-bold" width={14} />
                  <span>{bRollError}</span>
                </div>
                <Button
                  isIconOnly
                  variant="tertiary"
                  size="sm"
                  onPress={() => setBRollError(null)}
                  className="p-0.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                >
                  <Icon icon="solar:close-circle-bold" width={14} />
                </Button>
              </div>
            )}
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
                      <div className="flex items-start gap-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex-1 min-w-0">
                          {editingBRollIndex === idx ? (
                            <TextArea
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              className="w-full bg-surface-base/50 text-text-secondary text-xs resize-none outline-none border border-amber-400/30 rounded px-2 py-1 focus:ring-1 focus:ring-amber-400/50"
                              style={{ fieldSizing: "content" } as React.CSSProperties}
                              rows={1}
                            />
                          ) : (
                            <p className="text-xs text-text-secondary line-clamp-2">
                              {shot.action}
                            </p>
                          )}
                        </div>
                        {onSceneUpdate && (
                          <div className="flex items-center gap-0 shrink-0">
                            {editingBRollIndex === idx ? (
                              savingBRollIndex === idx ? (
                                <Icon icon="solar:refresh-bold" className="text-amber-400 animate-spin p-0.5" width={16} />
                              ) : (
                                <>
                                  <Button
                                    isIconOnly
                                    variant="tertiary"
                                    size="sm"
                                    onPress={handleSaveBRoll}
                                    className="p-0.5 rounded hover:bg-green-500/20 text-green-400 transition-colors"
                                  >
                                    <Icon icon="solar:check-circle-bold" width={15} />
                                  </Button>
                                  <Button
                                    isIconOnly
                                    variant="tertiary"
                                    size="sm"
                                    onPress={cancelEdit}
                                    className="p-0.5 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                                  >
                                    <Icon icon="solar:close-circle-bold" width={15} />
                                  </Button>
                                </>
                              )
                            ) : (
                              <Button
                                isIconOnly
                                variant="tertiary"
                                size="sm"
                                onPress={() => startEditingBRoll(idx)}
                                className="p-0.5 rounded hover:bg-amber-500/20 text-text-muted hover:text-amber-400 transition-colors"
                              >
                                <Icon icon="solar:pen-2-bold" width={13} />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex gap-1 shrink-0">
                        {shotImage?.url && (
                          <Button
 isIconOnly
 size="sm"
 variant="tertiary"
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
 variant="tertiary"
 className={isCustom ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"}
 isPending={isUploadingThis}
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
 variant="tertiary"
 className="bg-red-500/20 text-red-400"
 onPress={() => onCustomBRollImageChange(idx, undefined, undefined)}
 >
                            <Icon icon="solar:trash-bin-trash-bold" width={14} />
                          </Button>
                        )}
                        <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 className="bg-blue-500/20 text-blue-400"
 isPending={isShotRegenerating}
 isDisabled={isCurrentlyGenerating}
 onPress={() => handleGenerate(idx)}
 >
                          <Icon icon="solar:refresh-bold" width={14} />
                        </Button>
                        {/* Remove shot button */}
                        {onSceneUpdate && scene.bRollShots && scene.bRollShots.length > 1 && (
                          <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 className="bg-red-500/20 text-red-400"
 onPress={() => handleRemoveBRollShot(idx)}
 >
                            <Icon icon="solar:minus-circle-bold" width={14} />
                          </Button>
                        )}
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
 variant={hasImage ? "outline" : "primary"}
 size="sm"
 onPress={() => handleGenerate()}
 isPending={isGenerating || generation?.status === "generating"}
 isDisabled={generation?.status === "generating"}
 >
            {hasImage ? (
                <Icon icon="solar:refresh-bold" width={14} />
              ) : (
                <Icon icon="solar:magic-stick-3-bold" width={14} />
              )}
            {hasImage
              ? (scene.bRollShots ? "Regenerate All" : "Regenerate")
              : (scene.bRollShots ? "Generate Shots" : "Generate Image")}
          </Button>
        </div>
      </div>

      <Modal>
        <Modal.Backdrop isOpen={!!zoomImageUrl} onOpenChange={() => setZoomImageUrl(null)}><Modal.Container><Modal.Dialog className="sm:max-w-2xl">
          <Modal.Body>
            <div className="relative flex items-center justify-center">
              <Button
 isIconOnly
 className="absolute top-2 right-2 z-10 bg-black/50 text-white"
 variant="tertiary"
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
          </Modal.Body>
        </Modal.Dialog></Modal.Container></Modal.Backdrop>
      </Modal>
    </div>
  );
}
