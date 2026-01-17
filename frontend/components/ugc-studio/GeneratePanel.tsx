"use client";

import { useState } from "react";
import { Button, Card, CardBody, Image, Spinner, Modal, ModalContent, ModalBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface GeneratePanelProps {
  hasVideo: boolean;
  characterCount: number;
  segmentCount: number;
  totalDuration: number;
  onGenerate: () => void;
  onAutoDetectAndGenerate?: () => void;
  showEditor?: boolean;
  onToggleEditor?: () => void;
  onGeneratePose?: () => void;
  isGeneratingPose?: boolean;
  generatedPoseUrl?: string | null;
  onClearPose?: () => void;
}

export function GeneratePanel({
  hasVideo,
  characterCount,
  segmentCount,
  totalDuration,
  onGenerate,
  onAutoDetectAndGenerate,
  showEditor = false,
  onToggleEditor,
  onGeneratePose,
  isGeneratingPose = false,
  generatedPoseUrl,
  onClearPose,
}: GeneratePanelProps) {
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  const hasCharacter = characterCount > 0;
  const creditCost = characterCount * 5;
  const hasPose = !!generatedPoseUrl;
  const poseRequired = !!onGeneratePose; // If pose feature is enabled, it's required
  const poseReady = hasPose && !isGeneratingPose; // Pose exists and not currently regenerating
  const isValid = hasVideo && hasCharacter && segmentCount > 0 && totalDuration <= 50.01 && (!poseRequired || poseReady);
  const canAutoGenerate = hasVideo && hasCharacter && (!poseRequired || poseReady);
  const canGeneratePose = hasVideo && hasCharacter && !isGeneratingPose;

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-4">
        <div className="space-y-4">
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
            {poseRequired && (
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${hasPose ? "bg-green-500" : "bg-surface-elevated"}`} />
                <span className={`text-sm ${hasPose ? "text-text-primary" : "text-text-tertiary"}`}>
                  {hasPose ? "Pose generated" : "Generate pose match"}
                </span>
              </div>
            )}
            {showEditor ? (
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    hasVideo && segmentCount > 0 && totalDuration <= 50.01 ? "bg-green-500" : "bg-surface-elevated"
                  }`}
                />
                <span
                  className={`text-sm ${
                    hasVideo && segmentCount > 0 && totalDuration <= 50.01 ? "text-text-primary" : "text-text-tertiary"
                  }`}
                >
                  {segmentCount} segment{segmentCount !== 1 ? "s" : ""} (≤50s)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${hasVideo && hasCharacter ? "bg-purple-500" : "bg-surface-elevated"}`} />
                <span className={`text-sm ${hasVideo && hasCharacter ? "text-purple-400" : "text-text-tertiary"}`}>
                  Auto-detect faces on generate
                </span>
              </div>
            )}
          </div>

          <div className="p-3 bg-surface-elevated rounded-lg space-y-2">
            <p className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <Icon icon="solar:lightbulb-bolt-bold" className="text-yellow-400" width={14} />
              Tips for best results
            </p>
            <ul className="text-xs text-text-tertiary space-y-1 pl-5 list-disc">
              <li>Use clips with clear faces looking at the camera</li>
              <li>Avoid videos with text overlays or captions</li>
              <li>Ensure good lighting on the face</li>
            </ul>
          </div>

          {/* Pose Generation Section */}
          {onGeneratePose && (
            <div className="p-3 bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Icon icon="solar:running-round-bold" className="text-orange-400" width={16} />
                <span className="text-sm font-medium text-orange-400">Pose Match</span>
              </div>
              <p className="text-xs text-text-secondary">
                Generate a preview of your character in the video&apos;s pose for better face swap results.
              </p>

              {generatedPoseUrl ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => !isGeneratingPose && setIsZoomOpen(true)}
                    className={`relative w-full rounded-lg overflow-hidden border-2 transition-all ${
                      isGeneratingPose
                        ? "border-orange-500/30 cursor-wait"
                        : "border-green-500/40 cursor-zoom-in hover:border-green-500/60"
                    }`}
                  >
                    <Image
                      src={generatedPoseUrl}
                      alt="Generated pose"
                      className={`w-full h-auto max-h-52 object-contain transition-all ${
                        isGeneratingPose ? "opacity-50 blur-[1px]" : ""
                      }`}
                    />
                    {isGeneratingPose ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                        <Spinner size="lg" color="warning" />
                        <span className="text-sm text-white mt-3 font-medium">Regenerating pose...</span>
                      </div>
                    ) : (
                      <>
                        <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 rounded-full flex items-center gap-1.5 shadow-lg">
                          <Icon icon="solar:check-circle-bold" width={14} className="text-white" />
                          <span className="text-xs text-white font-semibold">Ready</span>
                        </div>
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded-full flex items-center gap-1">
                          <Icon icon="solar:magnifer-bold" width={12} className="text-white/80" />
                          <span className="text-[10px] text-white/80">Click to zoom</span>
                        </div>
                      </>
                    )}
                  </button>
                  {!isGeneratingPose && (
                    <p className="text-xs text-green-400 flex items-center gap-1.5">
                      <Icon icon="solar:check-circle-bold" width={14} />
                      This posed image will be used for face swap
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-surface-elevated text-text-secondary font-medium"
                      size="sm"
                      variant="flat"
                      isDisabled={isGeneratingPose}
                      onPress={onGeneratePose}
                      startContent={!isGeneratingPose && <Icon icon="solar:refresh-bold" width={14} />}
                    >
                      {isGeneratingPose ? "Generating..." : "Regenerate"}
                    </Button>
                    <Button
                      className="bg-surface-elevated text-text-secondary"
                      size="sm"
                      variant="flat"
                      isIconOnly
                      isDisabled={isGeneratingPose}
                      onPress={onClearPose}
                    >
                      <Icon icon="solar:trash-bin-minimalistic-bold" width={16} />
                    </Button>
                  </div>

                  {/* Zoom Modal */}
                  <Modal
                    isOpen={isZoomOpen}
                    onClose={() => setIsZoomOpen(false)}
                    size="3xl"
                    backdrop="blur"
                    classNames={{
                      body: "p-0",
                      base: "bg-transparent shadow-none",
                    }}
                  >
                    <ModalContent>
                      <ModalBody>
                        <div className="relative">
                          <Image
                            src={generatedPoseUrl}
                            alt="Generated pose - zoomed"
                            className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                          />
                          <Button
                            isIconOnly
                            className="absolute top-2 right-2 bg-black/60 text-white"
                            size="sm"
                            variant="flat"
                            onPress={() => setIsZoomOpen(false)}
                          >
                            <Icon icon="solar:close-circle-bold" width={20} />
                          </Button>
                        </div>
                      </ModalBody>
                    </ModalContent>
                  </Modal>
                </div>
              ) : (
                <Button
                  className="w-full bg-orange-500/20 text-orange-400 font-medium"
                  size="sm"
                  variant="flat"
                  isDisabled={!canGeneratePose}
                  isLoading={isGeneratingPose}
                  onPress={onGeneratePose}
                  startContent={!isGeneratingPose && <Icon icon="solar:body-bold" width={16} />}
                >
                  {isGeneratingPose ? "Generating..." : "Generate Pose"}
                </Button>
              )}
            </div>
          )}

          {segmentCount >= 2 && (
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

          {!showEditor && onAutoDetectAndGenerate && (
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

          {showEditor && onToggleEditor && (
            <Button
              className="w-full bg-purple-500/20 text-purple-400 font-medium"
              size="lg"
              variant="flat"
              onPress={onToggleEditor}
              startContent={<Icon icon="solar:face-scan-circle-bold" width={20} />}
            >
              Back to Auto-detect
            </Button>
          )}

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
              Generate
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
