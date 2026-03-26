"use client";

import { useState } from "react";
import { Button, Card, Spinner, ProgressBar, Input, TextArea } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { GeneratedImage } from "../types";

interface RegenerationTweaks {
  setting?: string;
  anythingElse?: string;
}

interface GenerateStepProps {
  generatedImages: GeneratedImage[];
  selectedImageKeys: string[];
  isGenerating: boolean;
  progress: number;
  progressMessage: string;
  onGenerate: (tweaks?: RegenerationTweaks) => void;
  onImageToggle: (key: string) => void;
}

function RegenerationPanel({
  isGenerating,
  onGenerate,
}: {
  isGenerating: boolean;
  onGenerate: (tweaks?: RegenerationTweaks) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [setting, setSetting] = useState("");
  const [anythingElse, setAnythingElse] = useState("");

  const handleRegenerate = () => {
    const tweaks: RegenerationTweaks = {};
    if (setting.trim()) tweaks.setting = setting.trim();
    if (anythingElse.trim()) tweaks.anythingElse = anythingElse.trim();
    onGenerate(Object.keys(tweaks).length > 0 ? tweaks : undefined);
  };

  if (!isExpanded) {
    return (
      <div className="flex items-center justify-center gap-3">
        <Button
 variant="outline"
 className="border-border-base text-text-secondary"
 onPress={() => onGenerate()}
 isPending={isGenerating}
 >
          <Icon icon="solar:refresh-bold" width={16} />
          Regenerate
        </Button>
        <Button
 variant="tertiary"
 className="text-text-muted"
 onPress={() => setIsExpanded(true)}
 >
          <Icon icon="solar:tuning-2-bold" width={16} />
          Tweak & Regenerate
        </Button>
      </div>
    );
  }

  return (
    <Card className="bg-surface-elevated border border-border-base p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon icon="solar:tuning-2-bold-duotone" className="text-accent-400" width={20} />
          <span className="text-sm font-medium text-text-primary">Tweak Before Regenerating</span>
        </div>
        <Button
 isIconOnly
 variant="tertiary"
 size="sm"
 onPress={() => setIsExpanded(false)}
 >
          <Icon icon="solar:close-circle-bold" className="text-text-muted" width={18} />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Setting / Environment</label>
          <Input
 value={setting}
 onChange={(e) => setSetting(e.target.value)}
 placeholder="e.g., Coffee shop, Beach at sunset, Modern office..."
 />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Additional Details</label>
          <TextArea
 value={anythingElse}
 onChange={(e) => setAnythingElse(e.target.value)}
 placeholder="e.g., Holding a coffee cup, warm lighting, more confident pose..."
 minRows={2}
 />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
 variant="tertiary"
 className="text-text-muted"
 onPress={() => setIsExpanded(false)}
 >
            Cancel
          </Button>
          <Button
 className="bg-accent-400 text-white font-medium"
 onPress={handleRegenerate}
 isPending={isGenerating}
 >
            <Icon icon="solar:magic-stick-3-bold" width={16} />
            Regenerate with Tweaks
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function GenerateStep({
  generatedImages,
  selectedImageKeys,
  isGenerating,
  progress,
  progressMessage,
  onGenerate,
  onImageToggle,
}: GenerateStepProps) {
  if (generatedImages.length === 0) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent-400/20 flex items-center justify-center mx-auto mb-4">
            <Icon icon="solar:magic-stick-3-bold-duotone" className="text-accent-400" width={28} />
          </div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">Generate Your Actor</h3>
          <p className="text-text-secondary text-sm">
            We'll create 4 unique variations based on your selections
          </p>
        </div>

        <Card className="bg-surface-elevated border border-border-base p-8">
          <div className="text-center">
            {isGenerating ? (
              <div className="py-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-400/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <Icon icon="solar:magic-stick-3-bold-duotone" className="text-accent-400" width={36} />
                </div>
                <h4 className="text-lg font-semibold text-text-primary mb-2">
                  Generating Your Actor
                </h4>
                <p className="text-text-secondary text-sm mb-6">{progressMessage}</p>
                <div className="max-w-xs mx-auto mb-4">
                  <ProgressBar
 value={progress}
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
                </div>
                <p className="text-text-muted text-xs">
                  {progress > 0 ? `${progress}% complete` : "Starting..."}
                </p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-400/30 to-purple-500/30 flex items-center justify-center mx-auto mb-6">
                  <Icon icon="solar:stars-bold-duotone" className="text-accent-400" width={40} />
                </div>
                <h4 className="text-lg font-semibold text-text-primary mb-2">
                  Ready to Generate
                </h4>
                <p className="text-text-secondary text-sm mb-6 max-w-sm mx-auto">
                  Click the button below to generate 4 unique AI actor variations
                </p>
                <Button
 size="lg"
 className="bg-accent-400 text-white font-semibold px-8"
 onPress={() => onGenerate()}
 >
                  <Icon icon="solar:magic-stick-3-bold" width={20} />
                  Generate Actors
                </Button>
                <p className="text-text-muted text-xs mt-4">
                  Preview is free • Only pay for images you keep (1 credit each)
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h3 className="text-xl font-semibold text-text-primary mb-2">Select Your Favorites</h3>
        <p className="text-text-secondary text-sm">
          Click on images to select them • {selectedImageKeys.length} selected
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {generatedImages.map((image) => {
          const isSelected = selectedImageKeys.includes(image.key);
          return (
            <button
              key={image.key}
              onClick={() => onImageToggle(image.key)}
              className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
                isSelected
                  ? "border-accent-400 ring-2 ring-accent-400/30"
                  : "border-border-base hover:border-accent-400/50"
              }`}
            >
              <img
                src={image.url}
                alt={`Generated variant ${image.index + 1}`}
                className="w-full h-full object-cover"
              />
              <div
                className={`absolute inset-0 bg-accent-400/20 transition-opacity ${
                  isSelected ? "opacity-100" : "opacity-0"
                }`}
              />
              <div
                className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isSelected ? "bg-accent-400" : "bg-surface-base/80 border border-border-base"
                }`}
              >
                {isSelected ? (
                  <Icon icon="solar:check-circle-bold" className="text-white" width={18} />
                ) : (
                  <span className="text-text-muted text-sm">{image.index + 1}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <RegenerationPanel
        isGenerating={isGenerating}
        onGenerate={onGenerate}
      />

      <div className="bg-surface-elevated rounded-xl p-4 border border-border-base">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon icon="solar:tag-bold-duotone" className="text-accent-400" width={20} />
            <span className="text-sm text-text-primary">Credit Cost</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-semibold text-text-primary">
              {selectedImageKeys.length} credits
            </span>
            <p className="text-xs text-text-muted">1 credit per selected image</p>
          </div>
        </div>
      </div>
    </div>
  );
}
