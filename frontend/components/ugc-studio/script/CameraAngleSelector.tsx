"use client";

import { useState } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react";
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
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button variant="flat" size="sm" className="bg-surface-base min-w-[110px]">
            <Icon icon={config.icon} width={14} />
            <span className="truncate max-w-[80px]">{displayLabel}</span>
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Select camera angle"
          selectionMode="single"
          selectedKeys={[value]}
          onAction={(key) => handleSelect(key as string)}
          className="bg-surface-elevated"
        >
          {CAMERA_ANGLES.map((angle) => {
            const angleConfig = CAMERA_ANGLE_CONFIG[angle];
            return (
              <DropdownItem
                key={angle}
                startContent={<Icon icon={angleConfig.icon} width={16} />}
                description={angleConfig.description}
                className="text-text-primary"
              >
                {angleConfig.label}
              </DropdownItem>
            );
          })}
        </DropdownMenu>
      </Dropdown>

      <Popover isOpen={isCustomOpen} onOpenChange={setIsCustomOpen} placement="bottom">
        <PopoverTrigger>
          <span className="hidden" />
        </PopoverTrigger>
        <PopoverContent className="bg-surface-elevated border border-border-base p-3 w-64">
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Custom camera angle</p>
            <Input
              size="sm"
              placeholder="e.g., Over-the-shoulder shot"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              classNames={{
                input: "bg-surface-base text-text-primary",
                inputWrapper: "bg-surface-base border-border-base",
              }}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="flat" onPress={() => setIsCustomOpen(false)}>
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
        </PopoverContent>
      </Popover>
    </>
  );
}
