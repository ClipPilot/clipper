"use client";

import { Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ChipSelector } from "../ChipSelector";
import { GENDERS, AGE_RANGES } from "../types";

interface BasicInfoStepProps {
  name: string;
  gender: string;
  ageRange: string;
  onNameChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onAgeRangeChange: (value: string) => void;
}

export function BasicInfoStep({
  name,
  gender,
  ageRange,
  onNameChange,
  onGenderChange,
  onAgeRangeChange,
}: BasicInfoStepProps) {
  return (
    <div className="space-y-8 max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-accent-400/20 flex items-center justify-center mx-auto mb-4">
          <Icon icon="solar:user-id-bold-duotone" className="text-accent-400" width={28} />
        </div>
        <h3 className="text-xl font-semibold text-text-accent mb-2">Basic Information</h3>
        <p className="text-text-secondary text-sm">
          Give your actor a name and define their basic characteristics
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-accent">Actor Name</label>
          <Input
 value={name}
 onChange={(e) => onNameChange(e.target.value)}
 placeholder="e.g., Sarah, Alex, Jordan"
 startContent={
 <Icon icon="solar:user-rounded-bold" className="text-text-muted" width={18} />
 }
 />
        </div>

        <ChipSelector
          label="Gender"
          options={GENDERS}
          value={gender}
          onChange={(v) => onGenderChange(v as string)}
          columns={2}
        />

        <ChipSelector
          label="Age Range"
          options={AGE_RANGES}
          value={ageRange}
          onChange={(v) => onAgeRangeChange(v as string)}
          columns={4}
        />
      </div>
    </div>
  );
}
