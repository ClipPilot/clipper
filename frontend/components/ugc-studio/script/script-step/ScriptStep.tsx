"use client";

import { useState, useCallback, useEffect } from "react";
import { useAtom } from "jotai";
import { Button, Input, TextArea, Tooltip, TextField, Label, FieldError} from "@heroui/react";
import { Icon } from "@iconify/react";
import { ProductImageUploader } from "../ProductImageUploader";
import { ugcScriptAPI } from "@/api/ugc";
import { scriptIdAtom, scriptsAtom, selectedVariantIndexAtom, productImageKeysAtom, sceneImagesAtom, videoJobIdAtom, videoStatusAtom, freshStartAtom, isSilentAtom } from "@/store/ugc";
import type { UGCScript, UGCScene, ProductImage } from "../types";
import type { ScriptStepProps, ScriptPhase, CustomPatternStep } from "./types";
import { CharacterPreviewCard } from "./CharacterPreviewCard";
import { ScriptStructureSelector } from "./ScriptStructureSelector";
import { ScriptGeneratingPhase } from "./ScriptGeneratingPhase";
import { ScriptEditingPhase } from "./ScriptEditingPhase";

export function ScriptStep({
  teamId,
  selectedCharacter,
  onContinue,
  autoAdvance,
}: ScriptStepProps & { autoAdvance?: boolean }) {
  const [scripts, setScripts] = useAtom(scriptsAtom);
  const [selectedVariantIndex, setSelectedVariantIndex] = useAtom(selectedVariantIndexAtom);
  const [scriptId, setScriptId] = useAtom(scriptIdAtom);
  const [, setProductImageKeys] = useAtom(productImageKeysAtom);
  const [, setSceneImages] = useAtom(sceneImagesAtom);
  const [, setVideoJobId] = useAtom(videoJobIdAtom);
  const [, setVideoStatus] = useAtom(videoStatusAtom);
  const [, setFreshStart] = useAtom(freshStartAtom);
  const [, setIsSilentGlobal] = useAtom(isSilentAtom);

  // Phase state
  const [phase, setPhase] = useState<ScriptPhase>("upload");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [productName, setProductName] = useState("");
  const [scriptDirection, setScriptDirection] = useState("");
  const [selectedStructureId, setSelectedStructureId] = useState("auto");
  const [customPattern, setCustomPattern] = useState<CustomPatternStep[]>([]);
  const [selectedActorImageIndex, setSelectedActorImageIndex] = useState(
    selectedCharacter.primary_image_index || 0
  );

  // Auto-structure state
  const [isGeneratingAutoStructure, setIsGeneratingAutoStructure] = useState(false);
  const [autoStructureReasoning, setAutoStructureReasoning] = useState<string | undefined>();
  const [autoStructureName, setAutoStructureName] = useState<string | undefined>();
  const [isAutoSilent, setIsAutoSilent] = useState(false);
  const [autoStructureDirection, setAutoStructureDirection] = useState<string>("");
  const hasAutoStructure = selectedStructureId === "auto" && customPattern.length > 0 && !isGeneratingAutoStructure;
  const autoDirectionChanged = hasAutoStructure && scriptDirection.trim() !== autoStructureDirection.trim();

  // Editing state
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingBRoll, setIsSavingBRoll] = useState(false);

  const clearVideoState = useCallback(() => {
    setSceneImages({});
    setVideoJobId(null);
    setVideoStatus(null);
  }, [setSceneImages, setVideoJobId, setVideoStatus]);

  const isGenerating = false;

  // Auto-advance past editing phase when autoAdvance is enabled
  useEffect(() => {
    if (autoAdvance && phase === "editing" && onContinue) {
      onContinue();
    }
  }, [autoAdvance, phase, onContinue]);

  const handleVariantSelect = useCallback(async (index: number) => {
    setSelectedVariantIndex(index);
    if (scriptId) {
      try {
        await ugcScriptAPI.updateScript(scriptId, { selectedVariantIndex: index });
      } catch (err) {
        console.error("Failed to sync variant selection:", err);
      }
    }
  }, [scriptId, setSelectedVariantIndex]);

  const handleGenerateAutoStructure = async () => {
    if (!scriptDirection.trim()) {
      setError("Please provide a script direction first");
      return;
    }

    setError(null);
    setIsGeneratingAutoStructure(true);
    try {
      const result = await ugcScriptAPI.generateAutoStructure({
        scriptDirection,
        productName: productName || undefined,
        hasProductImages: productImages.length > 0,
      });
      setCustomPattern(result.pattern.map((p) => ({ type: p.type, shot: p.shot })));
      setAutoStructureReasoning(result.reasoning);
      setAutoStructureName(result.name);
      const silent = result.isSilent || isAutoSilent;
      setIsAutoSilent(silent);
      setIsSilentGlobal(silent);
      setAutoStructureDirection(scriptDirection);
    } catch (err: any) {
      setError(err.message || "Failed to generate structure");
    } finally {
      setIsGeneratingAutoStructure(false);
    }
  };

  const SILENT_TEMPLATE_IDS = new Set(["silent-before-after", "silent-showcase", "silent-montage"]);

  const handleStructureChange = (structureId: string) => {
    setSelectedStructureId(structureId);
    if (structureId !== "auto") {
      setAutoStructureReasoning(undefined);
      setAutoStructureName(undefined);
      setIsAutoSilent(false);
      setAutoStructureDirection("");
      const silent = SILENT_TEMPLATE_IDS.has(structureId);
      setIsAutoSilent(silent);
      setIsSilentGlobal(silent);
      if (structureId !== "custom") {
        setCustomPattern([
          { type: "hook", shot: "a-roll" },
          { type: "problem", shot: "a-roll" },
          { type: "demo", shot: "b-roll" },
          { type: "cta", shot: "a-roll" },
        ]);
      }
    } else {
      // Switching back to auto resets pattern so user must regenerate
      setCustomPattern([]);
      setAutoStructureReasoning(undefined);
      setAutoStructureName(undefined);
      setIsAutoSilent(false);
      setIsSilentGlobal(false);
      setAutoStructureDirection("");
    }
  };

  const handleGenerate = async () => {
    setError("Script generation has moved to the AI agent flow. Use the Create Video page instead.");
  };

  // Scene editing handlers
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
    const scene = scripts[selectedVariantIndex].scenes[sceneIndex];

    if (scriptId) {
      try {
        const response = await ugcScriptAPI.regenerateScene({
          teamId,
          scriptId,
          sceneId: scene.id,
          currentDialogue: scene.dialogue,
          currentEmotion: scene.emotion,
          regenerationType: "full",
        });
        handleSceneUpdate(sceneIndex, response.scene);
      } catch (err: any) {
        setError(err.message || "Failed to regenerate scene");
      }
    } else {
      const defaultDialogues: Record<string, string> = {
        hook: "Okay but why did no one tell me about this sooner...",
        problem: "I was literally SO tired of dealing with this every single day...",
        agitate: "And the worst part? Nothing I tried actually worked...",
        solution: "Until I found this and honestly... it changed everything.",
        demo: "Let me show you how it actually works...",
        "social-proof": "I was so skeptical until I saw the reviews...",
        testimonial: "After using it for a week, I literally can't go back...",
        transformation: "Look at the difference. I'm actually shook.",
        cta: "Seriously, you have to try this. Link's in my bio.",
      };

      handleSceneUpdate(sceneIndex, {
        dialogue: defaultDialogues[scene.sceneType] || "Add your dialogue here...",
        action: "Speaking to camera",
        emotion: "friendly",
      });
    }
  };

  const handleContinue = async () => {
    if (!scripts[selectedVariantIndex] || !onContinue) return;

    if (scriptId) {
      setIsSaving(true);
      setError(null);
      try {
        await ugcScriptAPI.updateScript(scriptId, {
          scenes: scripts[selectedVariantIndex].scenes,
          selectedVariantIndex,
        });
      } catch (err: any) {
        setError(err.message || "Failed to save script");
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    onContinue();
  };

  const handleGoBackToUpload = () => {
    clearVideoState();
    setPhase("upload");
  };

  const actorImages = selectedCharacter.imageUrls || [];

  // Render based on phase
  if (phase === "generating") {
    return (
      <ScriptGeneratingPhase
        progress={0}
        message="Generating..."
      />
    );
  }

  if (phase === "editing") {
    return (
      <ScriptEditingPhase
        scripts={scripts}
        selectedVariantIndex={selectedVariantIndex}
        scriptId={scriptId || ""}
        character={selectedCharacter}
        selectedActorImageUrl={actorImages[selectedActorImageIndex]}
        isSaving={isSaving}
        isSavingBRoll={isSavingBRoll}
        error={error}
        onVariantSelect={handleVariantSelect}
        onSceneUpdate={handleSceneUpdate}
        onSceneReorder={handleSceneReorder}
        onAddScene={handleAddScene}
        onRemoveScene={handleRemoveScene}
        onRegenerateScene={handleRegenerateScene}
        onSavingBRollChange={setIsSavingBRoll}
        onGoBack={handleGoBackToUpload}
        onContinue={handleContinue}
      />
    );
  }

  // Upload phase
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <CharacterPreviewCard
        character={selectedCharacter}
        selectedImageIndex={selectedActorImageIndex}
        onImageIndexChange={setSelectedActorImageIndex}
      />

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

      <ScriptStructureSelector
        selectedStructureId={selectedStructureId}
        customPattern={customPattern}
        onStructureChange={handleStructureChange}
        onCustomPatternChange={setCustomPattern}
        autoStructureReasoning={autoStructureReasoning}
        autoStructureName={autoStructureName}
        isGeneratingAutoStructure={isGeneratingAutoStructure}
        isAutoSilent={isAutoSilent}
      />

      <div className="rounded-xl border border-border-base overflow-hidden bg-surface-elevated p-4 space-y-4">
          <TextField>
            <Label>Product Name (Optional)</Label>
            <Input
 placeholder="e.g., GlowSkin Serum"
 value={productName}
 onChange={(e) => setProductName(e.target.value)}
 />
            <FieldError />
          </TextField>
          <TextField isRequired>
            <Label>Script Direction</Label>
            <TextArea
 placeholder="Describe what you want... e.g., Make it funny, focus on the before/after, target skeptics"
 value={scriptDirection}
 onChange={(e) => setScriptDirection(e.target.value)}
 minRows={3}
 />
            <FieldError />
          </TextField>
          <Tooltip
 content={
 customPattern.some((s) => s.shot === "a-roll")
 ? "Silent mode can't be used with A-roll scenes — remove A-roll scenes first"
 : "No dialogue is generated — great for edit-style videos with music. Incompatible with A-roll scenes."
 }
 placement="right"
 >
            <Button
 size="sm"
 variant={isAutoSilent ? "primary" : "outline"}
 isDisabled={!isAutoSilent && customPattern.some((s) => s.shot === "a-roll")}
 className={
 isAutoSilent
 ? "bg-accent-400 text-white font-medium"
 : "border-border-base text-text-secondary font-medium"
 }
 onPress={() => {
 const next = !isAutoSilent;
 setIsAutoSilent(next);
 setIsSilentGlobal(next);
 if (next) {
 setCustomPattern((prev) =>
 prev.map((s) => ({ ...s, shot: "visual" as const }))
 );
 }
 }}
 >
              <Icon icon={isAutoSilent ? "solar:volume-cross-bold" : "solar:volume-loud-bold"} width={16} />
              {isAutoSilent ? "Silent Mode On" : "Silent Mode Off"}
            </Button>
          </Tooltip>
      </div>

      <div className="flex justify-center gap-3">
        {selectedStructureId === "auto" && !hasAutoStructure && (
          <Button
 size="lg"
 className="bg-accent-400 text-white font-semibold px-8"
 isDisabled={!scriptDirection.trim() || isGeneratingAutoStructure}
 isPending={isGeneratingAutoStructure}
 onPress={handleGenerateAutoStructure}
 >
            {!isGeneratingAutoStructure ? <Icon icon="solar:magic-stick-3-bold" width={20} /> : undefined}
            Generate Structure
          </Button>
        )}
        {hasAutoStructure && (
          <>
            <Button
 size="lg"
 variant="outline"
 className="border-accent-400 text-accent-400 font-semibold px-6"
 isDisabled={isGeneratingAutoStructure}
 isPending={isGeneratingAutoStructure}
 onPress={handleGenerateAutoStructure}
 >
              {!isGeneratingAutoStructure ? <Icon icon="solar:refresh-bold" width={18} /> : undefined}
              Regenerate Structure
            </Button>
            <Button
 size="lg"
 className="bg-accent-400 text-white font-semibold px-8"
 isDisabled={!scriptDirection.trim() || isGenerating}
 onPress={handleGenerate}
 >
              <Icon icon="solar:magic-stick-3-bold" width={20} />
              Generate Script
            </Button>
          </>
        )}
        {selectedStructureId !== "auto" && (
          <Button
 size="lg"
 className="bg-accent-400 text-white font-semibold px-8"
 isDisabled={!scriptDirection.trim() || isGenerating}
 onPress={handleGenerate}
 >
            <Icon icon="solar:magic-stick-3-bold" width={20} />
            Generate Script
          </Button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
