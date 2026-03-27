"use client";

import { useState } from "react";
import { Dropdown,
  Button,
  Input,
  Popover } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CAMERA_ANGLES, CAMERA_ANGLE_CONFIG, type CameraAngle } from "./types";

interface CameraAngleSelectorProps {
  value: CameraAngle;
  customValue?: string;
  onChange: (angle: CameraAngle, customValue?: string) => void;
}

export function CameraAngleSelector({
  value,
  customValue,
  onChange,
}: CameraAngleSelectorProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState(customValue || "");

  const config = CAMERA_ANGLE_CONFIG[value];
  const displayLabel = value === "custom" && customValue ? customValue : config.label;

  const handleSelect = (key: string) => {
    const angle = key as CameraAngle;
    if (angle === "custom") {
      setIsCustomOpen(true);
    } else {
      onChange(angle);
    }
  };

  const handleCustomSave = () => {
    onChange("custom", customInput);
    setIsCustomOpen(false);
  };

  return (
    <Popover isOpen={isCustomOpen} onOpenChange={setIsCustomOpen} placement="bottom">
      <Popover.Trigger>
        <div className="inline-block">
          <Dropdown>
<Button variant="tertiary" size="sm" className="bg-surface-base min-w-[110px]">
                <Icon icon={config.icon} width={14} />
                <span className="truncate max-w-[80px]">{displayLabel}</span>
              </Button>
<Dropdown.Popover>

<Dropdown.Menu
              aria-label="Select camera angle"
              selectionMode="single"
              selectedKeys={[value]}
              onAction={(key) => handleSelect(key as string)}
              className="bg-surface-elevated"
            >
              {CAMERA_ANGLES.map((angle) => {
                const angleConfig = CAMERA_ANGLE_CONFIG[angle];
                return (
                  <Dropdown.Item
                    key={angle}
                    className="text-text-primary"
                  >
                    <Icon icon={angleConfig.icon} width={16} />
                    {angleConfig.label}
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Menu>
</Dropdown.Popover>
          </Dropdown>
        </div>
      </Popover.Trigger>
      <Popover.Content className="bg-surface-elevated border border-border-base p-3 w-64">
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">Custom camera angle</p>
          <Input
 placeholder="e.g., Over-the-shoulder shot"
 value={customInput}
 onChange={(e) => setCustomInput(e.target.value)}
 />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="tertiary" onPress={() => setIsCustomOpen(false)}>
              Cancel
            </Button>
            <Button
 size="sm"
 className="bg-accent-400 text-white"
 onPress={handleCustomSave}
 isDisabled={!customInput.trim()}
 >
              Save
            </Button>
          </div>
        </div>
      </Popover.Content>
    </Popover>
  );
}
