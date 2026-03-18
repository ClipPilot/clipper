"use client";

import { Button, Card, CardBody, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { FolderSelector } from "@/components/clips";
import { FACE_SWAP_TIPS, FULL_BODY_SWAP_TIPS } from "./constants";

interface GeneratePanelProps {
  hasVideo: boolean;
  characterCount: number;
  segmentCount: number;
  totalDuration: number;
  onGenerate: () => void;
  onAutoDetectAndGenerate?: () => void;
  onFaceSwapGenerate?: () => void;
  showEditor?: boolean;
  onToggleEditor?: () => void;
  swapType?: "face" | "fullbody";
  onSwapTypeChange?: (type: "face" | "fullbody") => void;
  // Folder selection
  teamId?: number;
  selectedFolderId?: number | null;
  onFolderSelect?: (folderId: number | null) => void;
}

export function GeneratePanel({
  hasVideo,
  characterCount,
  segmentCount,
  totalDuration,
  onGenerate,
  onAutoDetectAndGenerate,
  onFaceSwapGenerate,
  showEditor = false,
  onToggleEditor,
  swapType = "fullbody",
  onSwapTypeChange,
  teamId,
  selectedFolderId,
  onFolderSelect,
}: GeneratePanelProps) {
  const hasCharacter = characterCount > 0;
  const creditCost = characterCount * 5;
  const isValid = hasVideo && hasCharacter && segmentCount > 0 && totalDuration <= 300.01;
  const canAutoGenerate = hasVideo && hasCharacter;
  const canFaceSwap = hasVideo && hasCharacter;

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-4">
        <div className="space-y-4">
          {/* Swap Mode Toggle */}
          {onSwapTypeChange && (
            <div className="flex gap-1 p-1 bg-surface-elevated rounded-lg">
              <Tooltip content="Only swaps face, works for most videos" delay={400}>
                <button
                  className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                    swapType === "face"
                      ? "bg-accent-400 text-white"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  onClick={() => onSwapTypeChange("face")}
                >
                  Face Swap
                </button>
              </Tooltip>
              <Tooltip content="Experimental, best on talking head or dance videos" delay={400}>
                <button
                  className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                    swapType === "fullbody"
                      ? "bg-purple-500 text-white"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  onClick={() => onSwapTypeChange("fullbody")}
                >
                  Full Body
                </button>
              </Tooltip>
            </div>
          )}

          {/* Checklist */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${hasVideo ? "bg-green-500" : "bg-surface-elevated"}`} />
              <span className={`text-sm ${hasVideo ? "text-text-primary" : "text-text-tertiary"}`}>
                Video uploaded
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${hasCharacter ? "bg-green-500" : "bg-surface-elevated"}`} />
              <span className={`text-sm ${hasCharacter ? "text-text-primary" : "text-text-tertiary"}`}>
                {characterCount > 0
                  ? `${characterCount} face${characterCount > 1 ? "s" : ""} selected`
                  : "Select character faces"}
              </span>
            </div>
            {showEditor && (
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    hasVideo && segmentCount > 0 && totalDuration <= 300.01 ? "bg-green-500" : "bg-surface-elevated"
                  }`}
                />
                <span
                  className={`text-sm ${
                    hasVideo && segmentCount > 0 && totalDuration <= 300.01 ? "text-text-primary" : "text-text-tertiary"
                  }`}
                >
                  {segmentCount} segment{segmentCount !== 1 ? "s" : ""} (≤5min)
                </span>
              </div>
            )}
            {!showEditor && (
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${hasVideo && hasCharacter ? (swapType === "face" ? "bg-accent-400" : "bg-purple-500") : "bg-surface-elevated"}`} />
                <span className={`text-sm ${hasVideo && hasCharacter ? (swapType === "face" ? "text-accent-400" : "text-purple-400") : "text-text-tertiary"}`}>
                  Auto-detect faces on generate
                </span>
              </div>
            )}
          </div>

          <div className="p-3 bg-surface-elevated rounded-lg space-y-2">
            <p className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <Icon icon="solar:lightbulb-bolt-bold" className="text-yellow-400" width={14} />
              {swapType === "face" ? "About Face Swap" : "About Full Body Swap"}
            </p>
            <ul className="text-xs text-text-tertiary space-y-1 pl-5 list-disc">
              {(swapType === "face" ? FACE_SWAP_TIPS : FULL_BODY_SWAP_TIPS).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          {/* Folder Selection */}
          {teamId && onFolderSelect && (
            <FolderSelector
              teamId={teamId}
              selectedFolderId={selectedFolderId ?? null}
              onFolderSelect={onFolderSelect}
              label="Save to folder"
              placeholder="Root (no folder)"
              size="sm"
            />
          )}

          {showEditor && segmentCount >= 2 && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <Icon icon="solar:layers-bold" className="text-blue-400" width={16} />
                <span className="text-sm font-medium text-blue-400">Full Video Mode</span>
              </div>
              <p className="text-xs text-text-secondary">
                Swap applies to selected segments only. Gaps and edges keep original footage.
              </p>
            </div>
          )}

          {/* Face Swap mode — auto-detect button (no editor) */}
          {swapType === "face" && !showEditor && onFaceSwapGenerate && (
            <Button
              className="w-full bg-accent-400 text-white font-semibold"
              size="lg"
              isDisabled={!canFaceSwap}
              onPress={onFaceSwapGenerate}
              startContent={<Icon icon="solar:magic-stick-3-bold-duotone" width={20} />}
              endContent={
                <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                  {creditCost > 0 ? `${creditCost} Credits` : "5 Credits"}
                </span>
              }
            >
              Generate Face Swap
            </Button>
          )}

          {/* Full Body mode — auto-detect button (no editor) */}
          {swapType === "fullbody" && !showEditor && onAutoDetectAndGenerate && (
            <Button
              className="w-full bg-purple-500 text-white font-semibold"
              size="lg"
              isDisabled={!canAutoGenerate}
              onPress={onAutoDetectAndGenerate}
              startContent={<Icon icon="solar:face-scan-circle-bold" width={20} />}
              endContent={
                <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                  {creditCost > 0 ? `${creditCost} Credits` : "5 Credits"}
                </span>
              }
            >
              Auto-detect & Generate
            </Button>
          )}

          {/* Both modes — back to auto-detect (editor open) */}
          {showEditor && onToggleEditor && (
            <Button
              className={`w-full ${swapType === "face" ? "bg-accent-400/20 text-accent-400" : "bg-purple-500/20 text-purple-400"} font-medium`}
              size="lg"
              variant="flat"
              onPress={onToggleEditor}
              startContent={<Icon icon="solar:face-scan-circle-bold" width={20} />}
            >
              Back to Auto-detect
            </Button>
          )}

          {/* Both modes — manual generate (editor open) */}
          {showEditor && (
            <Button
              className="w-full bg-accent-400 text-white font-semibold"
              size="lg"
              isDisabled={!isValid}
              onPress={onGenerate}
              startContent={<Icon icon="solar:magic-stick-3-bold-duotone" width={20} />}
              endContent={
                <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                  {creditCost > 0 ? `${creditCost} Credits` : "5 Credits"}
                </span>
              }
            >
              {swapType === "face" ? "Generate Face Swap" : "Generate"}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
