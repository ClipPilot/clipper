"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAtom } from "jotai";
import { Card, CardBody, Button, Input, Textarea, Progress, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ProductImageUploader } from "./ProductImageUploader";
import { ScriptEditor } from "./ScriptEditor";
import { ScriptVariantSelector } from "./ScriptVariantSelector";
import { ugcScriptAPI } from "@/api/ugc";
import { scriptIdAtom, scriptsAtom, selectedVariantIndexAtom, productImageKeysAtom, sceneImagesAtom, videoJobIdAtom, videoStatusAtom, videoPreviewUrlAtom } from "@/store/ugc";
import { connectSocket, joinTeam, leaveTeam } from "@/lib/socket";
import type { Character } from "../actors/types";
import type { UGCScript, UGCScene, ProductImage, SceneType, ShotType, ScriptSummary } from "./types";
import { SCRIPT_STRUCTURES, SCENE_TYPES, SHOT_TYPES } from "./types";

interface ScriptStepProps {
  teamId: number;
  selectedCharacter: Character;
  onContinue?: () => void;
}

type ScriptPhase = "upload" | "generating" | "editing";

export function ScriptStep({
  teamId,
  selectedCharacter,
  onContinue,
}: ScriptStepProps) {
  const [scripts, setScripts] = useAtom(scriptsAtom);
  const [selectedVariantIndex, setSelectedVariantIndex] = useAtom(selectedVariantIndexAtom);
  const [scriptId, setScriptId] = useAtom(scriptIdAtom);
  const [, setProductImageKeys] = useAtom(productImageKeysAtom);
  const [, setSceneImages] = useAtom(sceneImagesAtom);
  const [, setVideoJobId] = useAtom(videoJobIdAtom);
  const [, setVideoStatus] = useAtom(videoStatusAtom);
  const [, setVideoPreviewUrl] = useAtom(videoPreviewUrlAtom);

  const [phase, setPhase] = useState<ScriptPhase>("upload");
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [productName, setProductName] = useState("");
  const [scriptDirection, setScriptDirection] = useState("");
  const [selectedStructureId, setSelectedStructureId] = useState("classic");
  const [customPattern, setCustomPattern] = useState<{ type: SceneType; shot: ShotType }[]>([
    { type: "hook", shot: "a-roll" },
    { type: "problem", shot: "a-roll" },
    { type: "demo", shot: "b-roll" },
    { type: "cta", shot: "a-roll" },
  ]);
  const [selectedActorImageIndex, setSelectedActorImageIndex] = useState(
    selectedCharacter.primary_image_index || 0
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingScriptId, setPendingScriptId] = useState<string | null>(null);

  // Existing scripts state
  const [existingScripts, setExistingScripts] = useState<ScriptSummary[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "existing">("new");

  const clearVideoState = useCallback(() => {
    setSceneImages({});
    setVideoJobId(null);
    setVideoStatus(null);
    setVideoPreviewUrl(null);
  }, [setSceneImages, setVideoJobId, setVideoStatus, setVideoPreviewUrl]);

  // Fetch existing scripts on mount
  useEffect(() => {
    const fetchExistingScripts = async () => {
      setIsLoadingExisting(true);
      try {
        const response = await ugcScriptAPI.listScripts(teamId, { limit: 20 });
        setExistingScripts(response.scripts);
      } catch (err) {
        console.error("Failed to fetch existing scripts:", err);
      } finally {
        setIsLoadingExisting(false);
      }
    };
    fetchExistingScripts();
  }, [teamId]);

  const handleLoadExistingScript = async (existingScript: ScriptSummary) => {
    setIsLoadingScript(true);
    setError(null);
    try {
      const response = await ugcScriptAPI.getFullScript(existingScript.id);

      // Clear all previous generation state for fresh start
      setSceneImages({});
      setVideoJobId(null);
      setVideoStatus(null);
      setVideoPreviewUrl(null);
      setProductImageKeys([]);

      // Set flags to skip loading saved data in subsequent steps
      sessionStorage.setItem("skipLoadExistingVideo", existingScript.id);
      sessionStorage.setItem("skipLoadSceneImages", existingScript.id);

      setScripts(response.scripts);
      setScriptId(existingScript.id);
      setSelectedVariantIndex(response.selectedVariantIndex);
      setPhase("editing");
    } catch (err: any) {
      setError(err.message || "Failed to load script");
    } finally {
      setIsLoadingScript(false);
    }
  };

  // Handle variant selection and sync to backend
  const handleVariantSelect = useCallback(async (index: number) => {
    setSelectedVariantIndex(index);

    // Sync to backend so scene generation uses the correct variant
    if (scriptId) {
      try {
        await ugcScriptAPI.updateScript(scriptId, { selectedVariantIndex: index });
      } catch (err) {
        console.error("Failed to sync variant selection:", err);
      }
    }
  }, [scriptId, setSelectedVariantIndex]);

  // WebSocket listener for real-time script updates
  useEffect(() => {
    const socket = connectSocket();
    joinTeam(teamId);

    interface ScriptJobUpdate {
      scriptId: string;
      status: "queued" | "generating" | "completed" | "failed";
      progress: number;
      progressMessage: string;
      scripts?: UGCScript[];
      error?: string;
    }

    const handleScriptUpdate = (update: ScriptJobUpdate) => {
      // Only handle updates for our pending script
      if (!pendingScriptId || update.scriptId !== pendingScriptId) return;

      setGenerationProgress(update.progress);
      setProgressMessage(update.progressMessage);

      if (update.status === "completed" && update.scripts) {
        setScripts(update.scripts);
        setScriptId(update.scriptId);
        setProductImageKeys(productImages.map((img) => img.key));
        clearVideoState();
        setPhase("editing");
        setIsGenerating(false);
        setPendingScriptId(null);
      } else if (update.status === "failed") {
        setError(update.error || "Script generation failed");
        setPhase("upload");
        setIsGenerating(false);
        setPendingScriptId(null);
      }
    };

    socket.on("script-job-update", handleScriptUpdate);

    return () => {
      socket.off("script-job-update", handleScriptUpdate);
      leaveTeam(teamId);
    };
  }, [teamId, pendingScriptId, productImages, setScripts, setScriptId, setProductImageKeys, clearVideoState]);

  const handleGenerate = async () => {
    if (!scriptDirection.trim()) {
      setError("Please provide a script direction");
      return;
    }

    setPhase("generating");
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);
    setProgressMessage("Queuing script generation...");

    try {
      const response = await ugcScriptAPI.generateScript({
        teamId,
        characterId: selectedCharacter.id,
        productImageKeys: productImages.map((img) => img.key),
        productName: productName || undefined,
        scriptDirection: scriptDirection || undefined,
        numberOfVariations: 2,
        structureId: selectedStructureId,
        customPattern: selectedStructureId === "custom" ? customPattern : undefined,
      });

      // Set pending scriptId - WebSocket will handle updates
      setPendingScriptId(response.scriptId);
    } catch (err: any) {
      setError(err.message || "Failed to generate script");
      setPhase("upload");
      setIsGenerating(false);
    }
  };

  const handleSceneUpdate = (sceneIndex: number, updates: Partial<UGCScene>) => {
    setScripts((prev) =>
      prev.map((script, i) => {
        if (i !== selectedVariantIndex) return script;
        return {
          ...script,
          scenes: script.scenes.map((scene, si) =>
            si === sceneIndex ? { ...scene, ...updates } : scene
          ),
        };
      })
    );
  };

  const handleSceneReorder = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= scripts[selectedVariantIndex].scenes.length) return;

    setScripts((prev) =>
      prev.map((script, i) => {
        if (i !== selectedVariantIndex) return script;
        const newScenes = [...script.scenes];
        const [moved] = newScenes.splice(fromIndex, 1);
        newScenes.splice(toIndex, 0, moved);
        return {
          ...script,
          scenes: newScenes.map((scene, idx) => ({
            ...scene,
            sceneNumber: idx + 1,
          })),
        };
      })
    );
  };

  const handleAddScene = (afterIndex: number) => {
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

    setScripts((prev) =>
      prev.map((script, i) => {
        if (i !== selectedVariantIndex) return script;
        const newScenes = [...script.scenes];
        newScenes.splice(afterIndex + 1, 0, newScene);
        return {
          ...script,
          scenes: newScenes.map((scene, idx) => ({
            ...scene,
            sceneNumber: idx + 1,
          })),
        };
      })
    );
  };

  const handleRemoveScene = (sceneIndex: number) => {
    setScripts((prev) =>
      prev.map((script, i) => {
        if (i !== selectedVariantIndex) return script;
        if (script.scenes.length <= 3) return script;
        return {
          ...script,
          scenes: script.scenes
            .filter((_, idx) => idx !== sceneIndex)
            .map((scene, idx) => ({ ...scene, sceneNumber: idx + 1 })),
        };
      })
    );
  };

  const handleRegenerateScene = async (sceneIndex: number) => {
    if (!scriptId) return;

    const scene = scripts[selectedVariantIndex].scenes[sceneIndex];

    const response = await ugcScriptAPI.regenerateScene({
      teamId,
      scriptId,
      sceneId: scene.id,
      currentDialogue: scene.dialogue,
      currentEmotion: scene.emotion,
      regenerationType: "full",
    });

    handleSceneUpdate(sceneIndex, response.scene);
  };

  const handleContinue = () => {
    if (scriptId && scripts[selectedVariantIndex] && onContinue) {
      onContinue();
    }
  };

  const handleGoBackToUpload = () => {
    clearVideoState();
    setPhase("upload");
  };

  const actorImages = selectedCharacter.imageUrls || [];

  if (phase === "upload") {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Card className="bg-surface-elevated border border-border-base">
          <CardBody className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-24 rounded-xl overflow-hidden bg-surface-base flex-shrink-0">
                {actorImages[selectedActorImageIndex] ? (
                  <img
                    src={actorImages[selectedActorImageIndex]}
                    alt={selectedCharacter.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon icon="solar:user-circle-bold-duotone" className="text-text-muted" width={32} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-text-primary truncate">
                  {selectedCharacter.name}
                </h3>
                <p className="text-sm text-text-secondary capitalize">
                  {selectedCharacter.gender} • {selectedCharacter.age_range}
                </p>
                {actorImages.length > 1 && (
                  <p className="text-xs text-text-muted mt-1">
                    Select a look for your script
                  </p>
                )}
              </div>
            </div>

            {actorImages.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                {actorImages.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedActorImageIndex(index)}
                    className={`relative w-14 h-[70px] rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                      selectedActorImageIndex === index
                        ? "border-accent-400 ring-2 ring-accent-400/30"
                        : "border-border-base hover:border-accent-400/50"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Look ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {index === selectedCharacter.primary_image_index && (
                      <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-accent-400 flex items-center justify-center">
                        <Icon icon="solar:star-bold" className="text-white" width={8} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Tab selector for New vs Existing scripts */}
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as "new" | "existing")}
          classNames={{
            tabList: "bg-surface-base border border-border-base rounded-xl p-1",
            cursor: "bg-accent-400",
            tab: "text-text-secondary data-[selected=true]:text-white",
            tabContent: "group-data-[selected=true]:text-white",
          }}
        >
          <Tab
            key="new"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:add-circle-bold-duotone" width={18} />
                <span>Create New Script</span>
              </div>
            }
          />
          <Tab
            key="existing"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:document-text-bold-duotone" width={18} />
                <span>Use Existing</span>
                {existingScripts.length > 0 && (
                  <span className="bg-accent-400/20 text-accent-400 text-xs px-1.5 py-0.5 rounded-full">
                    {existingScripts.length}
                  </span>
                )}
              </div>
            }
          />
        </Tabs>

        {activeTab === "existing" ? (
          // Existing Scripts List
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                Your Scripts
              </h2>
              <p className="text-text-secondary">
                Select a script to continue editing or generate videos from it.
              </p>
            </div>

            {isLoadingExisting ? (
              <div className="flex items-center justify-center py-12">
                <Icon icon="solar:spinner-bold" className="animate-spin text-accent-400" width={32} />
              </div>
            ) : existingScripts.length === 0 ? (
              <Card className="bg-surface-elevated border border-border-base">
                <CardBody className="py-12 text-center">
                  <Icon icon="solar:document-text-bold-duotone" className="text-text-muted mx-auto mb-4" width={48} />
                  <h3 className="text-lg font-semibold text-text-primary mb-2">No Scripts Yet</h3>
                  <p className="text-text-secondary text-sm mb-4">
                    Create your first script to get started!
                  </p>
                  <Button
                    className="bg-accent-400 text-white"
                    onPress={() => setActiveTab("new")}
                    startContent={<Icon icon="solar:add-circle-bold" width={18} />}
                  >
                    Create New Script
                  </Button>
                </CardBody>
              </Card>
            ) : (
              <div className="grid gap-3">
                {existingScripts.map((script) => (
                  <Card
                    key={script.id}
                    isPressable
                    className="bg-surface-elevated border border-border-base hover:border-accent-400/50 transition-all"
                    onPress={() => handleLoadExistingScript(script)}
                  >
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-text-primary truncate">
                              {script.title || "Untitled Script"}
                            </h3>
                            <span className="flex items-center gap-1 text-xs bg-accent-400/20 text-accent-400 px-2 py-0.5 rounded-full">
                              <Icon icon="solar:fire-bold" width={12} />
                              {script.viralScore}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary line-clamp-1 mb-2">
                            {script.hook || script.scriptDirection || "No description"}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-text-muted">
                            {script.productName && (
                              <span className="flex items-center gap-1">
                                <Icon icon="solar:box-bold-duotone" width={14} />
                                {script.productName}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:video-frame-bold-duotone" width={14} />
                              {script.sceneCount} scenes
                            </span>
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:clock-circle-bold-duotone" width={14} />
                              {script.totalDuration}s
                            </span>
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:calendar-bold-duotone" width={14} />
                              {new Date(script.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {isLoadingScript ? (
                            <Icon icon="solar:spinner-bold" className="animate-spin text-accent-400" width={20} />
                          ) : (
                            <Icon icon="solar:arrow-right-linear" className="text-text-muted" width={20} />
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          // New Script Form
          <>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                Product Images <span className="text-text-muted font-normal text-lg">(Optional)</span>
              </h2>
              <p className="text-text-secondary">
                Upload up to 5 images of your product. Our AI will analyze them to create
                a viral script.
              </p>
            </div>

            <ProductImageUploader
              teamId={teamId}
              maxImages={5}
              images={productImages}
              onImagesChange={setProductImages}
            />

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Icon icon="solar:video-frame-bold-duotone" width={20} className="text-accent-400" />
                Script Structure
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {SCRIPT_STRUCTURES.map((structure) => (
                  <button
                    key={structure.id}
                    onClick={() => setSelectedStructureId(structure.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedStructureId === structure.id
                        ? "border-accent-400 bg-accent-400/10"
                        : "border-border-base bg-surface-elevated hover:border-accent-400/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon
                        icon={structure.icon}
                        width={20}
                        className={selectedStructureId === structure.id ? "text-accent-400" : "text-text-muted"}
                      />
                      <span className="font-medium text-text-primary text-sm">{structure.name}</span>
                    </div>
                    <p className="text-xs text-text-secondary mb-2">{structure.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {structure.bestFor.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-surface-base text-text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              {selectedStructureId === "custom" ? (
                <div className="bg-surface-base rounded-lg p-4 border border-border-base space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text-primary">Build your structure:</p>
                    <Button
                      size="sm"
                      variant="flat"
                      className="text-accent-400"
                      onPress={() => setCustomPattern([...customPattern, { type: "demo", shot: "b-roll" }])}
                      isDisabled={customPattern.length >= 8}
                      startContent={<Icon icon="solar:add-circle-linear" width={16} />}
                    >
                      Add Scene
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {customPattern.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 bg-surface-elevated p-2 rounded-lg">
                        <span className="text-xs text-text-muted w-5">{i + 1}.</span>
                        <select
                          value={step.type}
                          onChange={(e) => {
                            const newPattern = [...customPattern];
                            newPattern[i].type = e.target.value as SceneType;
                            setCustomPattern(newPattern);
                          }}
                          className="flex-1 bg-surface-base border border-border-base rounded px-2 py-1 text-sm text-text-primary"
                        >
                          {SCENE_TYPES.map((type) => (
                            <option key={type} value={type} className="capitalize">{type}</option>
                          ))}
                        </select>
                        <select
                          value={step.shot}
                          onChange={(e) => {
                            const newPattern = [...customPattern];
                            newPattern[i].shot = e.target.value as ShotType;
                            setCustomPattern(newPattern);
                          }}
                          className={`w-24 border rounded px-2 py-1 text-sm ${
                            step.shot === "a-roll" ? "bg-green-500/10 border-green-500/30 text-green-400" :
                            step.shot === "b-roll" ? "bg-blue-500/10 border-blue-500/30 text-blue-400" :
                            "bg-purple-500/10 border-purple-500/30 text-purple-400"
                          }`}
                        >
                          {SHOT_TYPES.map((shot) => (
                            <option key={shot} value={shot}>{shot}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setCustomPattern(customPattern.filter((_, idx) => idx !== i))}
                          disabled={customPattern.length <= 3}
                          className="p-1 text-text-muted hover:text-red-400 disabled:opacity-30"
                        >
                          <Icon icon="solar:trash-bin-minimalistic-linear" width={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-text-muted">Min 3 scenes, max 8. Start with hook, end with CTA.</p>
                </div>
              ) : (
                <div className="bg-surface-base rounded-lg p-3 border border-border-base">
                  <p className="text-xs text-text-muted mb-2">Structure breakdown:</p>
                  <div className="flex flex-wrap gap-2">
                    {SCRIPT_STRUCTURES.find((s) => s.id === selectedStructureId)?.pattern.map((step, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-xs bg-surface-elevated px-2 py-1 rounded"
                      >
                        <span className="text-text-muted">{i + 1}.</span>
                        <span className="text-text-primary capitalize">{step.type}</span>
                        <span className={`text-[10px] px-1 rounded ${
                          step.shot === "a-roll" ? "bg-green-500/20 text-green-400" :
                          step.shot === "b-roll" ? "bg-blue-500/20 text-blue-400" :
                          "bg-purple-500/20 text-purple-400"
                        }`}>
                          {step.shot}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Card className="bg-surface-elevated border border-border-base">
              <CardBody className="space-y-4">
                <Input
                  label="Product Name (Optional)"
                  placeholder="e.g., GlowSkin Serum"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  classNames={{
                    input: "bg-surface-base text-text-primary",
                    inputWrapper: "bg-surface-base border-border-base",
                  }}
                />
                <Textarea
                  isRequired
                  label="Script Direction"
                  labelPlacement="outside"
                  placeholder="Describe what you want... e.g., Make it funny, focus on the before/after, target skeptics"
                  value={scriptDirection}
                  onChange={(e) => setScriptDirection(e.target.value)}
                  minRows={3}
                />
              </CardBody>
            </Card>

            <div className="flex justify-center">
              <Button
                size="lg"
                className="bg-accent-400 text-white font-semibold px-8"
                isDisabled={!scriptDirection.trim()}
                onPress={handleGenerate}
                startContent={<Icon icon="solar:magic-stick-3-bold" width={20} />}
              >
                Generate Script
              </Button>
            </div>
          </>
        )}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
  }

  if (phase === "generating") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-400/20 to-purple-500/20 flex items-center justify-center mb-6 animate-pulse">
          <Icon
            icon="solar:magic-stick-3-bold-duotone"
            className="text-accent-400"
            width={48}
          />
        </div>
        <h3 className="text-xl font-semibold text-text-primary mb-2">
          Crafting Your Viral Script
        </h3>
        <p className="text-text-secondary mb-6">
          {progressMessage || "Analyzing product images and generating script variations..."}
        </p>
        <div className="w-full max-w-md space-y-2">
          <Progress
            value={generationProgress}
            size="lg"
            classNames={{
              indicator: "bg-gradient-to-r from-accent-400 to-purple-500",
            }}
          />
          <p className="text-center text-xs text-text-muted">{generationProgress}% complete</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {scripts.length > 1 && (
        <ScriptVariantSelector
          scripts={scripts}
          selectedIndex={selectedVariantIndex}
          onSelect={handleVariantSelect}
        />
      )}

      <ScriptEditor
        script={scripts[selectedVariantIndex]}
        character={selectedCharacter}
        selectedActorImageUrl={actorImages[selectedActorImageIndex]}
        onSceneUpdate={handleSceneUpdate}
        onSceneReorder={handleSceneReorder}
        onAddScene={handleAddScene}
        onRemoveScene={handleRemoveScene}
        onRegenerateScene={handleRegenerateScene}
      />

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center pt-4">
        <div className="flex items-center gap-2">
          <Button
            variant="bordered"
            className="border-border-base text-text-secondary"
            onPress={handleGoBackToUpload}
            startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
          >
            Edit & Regenerate
          </Button>
        </div>
        <Button
          size="lg"
          className="bg-accent-400 text-white font-semibold"
          onPress={handleContinue}
          endContent={<Icon icon="solar:arrow-right-linear" width={16} />}
        >
          Continue to Audio
        </Button>
      </div>
    </div>
  );
}
