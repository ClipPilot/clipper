"use client";

import { Icon } from "@iconify/react";
import { ChipSelector } from "../ChipSelector";
import {
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  EYE_COLORS,
  BODY_TYPES,
  AppearanceConfig,
} from "../types";

interface AppearanceStepProps {
  appearance: AppearanceConfig;
  onAppearanceChange: (appearance: AppearanceConfig) => void;
}

export function AppearanceStep({ appearance, onAppearanceChange }: AppearanceStepProps) {
  const handleChange = <K extends keyof AppearanceConfig>(key: K, value: AppearanceConfig[K]) => {
    onAppearanceChange({ ...appearance, [key]: value });
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-accent-400/20 flex items-center justify-center mx-auto mb-4">
          <Icon icon="solar:face-scan-circle-bold-duotone" className="text-accent-400" width={28} />
        </div>
        <h3 className="text-xl font-semibold text-text-primary mb-2">Physical Appearance</h3>
        <p className="text-text-secondary text-sm">
          Customize how your actor looks - hair, skin, eyes, and more
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <ChipSelector
            label="Hair Color"
            options={HAIR_COLORS}
            value={appearance.hairColor}
            onChange={(v) => handleChange("hairColor", v as AppearanceConfig["hairColor"])}
            showColorPreview
            columns={3}
          />

          <ChipSelector
            label="Hair Style"
            options={HAIR_STYLES}
            value={appearance.hairStyle}
            onChange={(v) => handleChange("hairStyle", v as AppearanceConfig["hairStyle"])}
            columns={3}
          />

          <ChipSelector
            label="Eye Color"
            options={EYE_COLORS}
            value={appearance.eyeColor}
            onChange={(v) => handleChange("eyeColor", v as AppearanceConfig["eyeColor"])}
            showColorPreview
            columns={3}
          />
        </div>

        <div className="space-y-6">
          <ChipSelector
            label="Skin Tone"
            options={SKIN_TONES}
            value={appearance.skinTone}
            onChange={(v) => handleChange("skinTone", v as AppearanceConfig["skinTone"])}
            showColorPreview
            columns={3}
          />

          <ChipSelector
            label="Body Type"
            options={BODY_TYPES}
            value={appearance.bodyType}
            onChange={(v) => handleChange("bodyType", v as AppearanceConfig["bodyType"])}
            columns={2}
          />
        </div>
      </div>
    </div>
  );
}
