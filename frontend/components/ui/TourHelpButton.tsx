"use client";

import { Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

interface TourHelpButtonProps {
  onPress: () => void;
}

export default function TourHelpButton({ onPress }: TourHelpButtonProps) {
  return (
    <Tooltip content="Page walkthrough">
      <Button
        isIconOnly
        variant="flat"
        size="sm"
        onPress={onPress}
        className="bg-surface-base border border-border-base text-text-secondary hover:text-accent-400"
      >
        <Icon icon="solar:question-circle-bold" width={18} />
      </Button>
    </Tooltip>
  );
}
