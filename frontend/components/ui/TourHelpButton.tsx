"use client";

import { Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

interface TourHelpButtonProps {
  onPress: () => void;
}

export default function TourHelpButton({ onPress }: TourHelpButtonProps) {
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Button
          isIconOnly
          variant="tertiary"
          size="sm"
          onPress={onPress}
          className="bg-surface-base border border-border-base text-text-secondary hover:text-accent-400"
        >
          <Icon icon="solar:question-circle-bold" width={18} />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>Page walkthrough</Tooltip.Content>
    </Tooltip>
  );
}
