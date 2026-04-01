"use client";

import { Input, TextArea, TextField, Label } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ChipSelector } from "../ChipSelector";
import { OUTFITS, StyleConfig } from "../types";

interface StyleStepProps {
  style: StyleConfig;
  onStyleChange: (style: StyleConfig) => void;
}

export function StyleStep({ style, onStyleChange }: StyleStepProps) {
  const handleChange = <K extends keyof StyleConfig>(key: K, value: StyleConfig[K]) => {
    onStyleChange({ ...style, [key]: value });
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-accent-400/20 flex items-center justify-center mx-auto mb-4">
          <Icon icon="solar:hanger-2-bold-duotone" className="text-accent-400" width={28} />
        </div>
        <h3 className="text-xl font-semibold text-text-primary mb-2">Style & Setting</h3>
        <p className="text-text-secondary text-sm">Choose the outfit and location for your actor</p>
      </div>

      <div className="space-y-6">
        <ChipSelector
          label="Outfit"
          options={OUTFITS}
          value={style.outfit}
          onChange={(v) => handleChange("outfit", v as StyleConfig["outfit"])}
          columns={3}
        />

        {style.outfit === "other" && (
          <TextField fullWidth variant="secondary">
            <Label>Describe the outfit</Label>
            <Input
              value={style.outfitCustom || ""}
              onChange={(e) => handleChange("outfitCustom", e.target.value)}
              placeholder="e.g., Summer dress, Business casual, Athleisure..."
            />
          </TextField>
        )}

        <TextField fullWidth variant="secondary">
          <Label>Setting / Location</Label>
          <Input
            value={style.setting}
            onChange={(e) => handleChange("setting", e.target.value)}
            placeholder="e.g., Modern living room, Coffee shop, Beach, Office desk..."
          />
        </TextField>

        <TextField fullWidth variant="secondary">
          <Label>Anything else?</Label>
          <TextArea
            value={style.anythingElse || ""}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange("anythingElse", e.target.value)}
            placeholder="Add any other details... e.g., holding a coffee cup, warm lighting, smiling..."
            rows={3}
          />
          <p className="text-xs text-text-muted mt-1">
            Optional: Add specific poses, props, expressions, or any other details
          </p>
        </TextField>
      </div>
    </div>
  );
}
