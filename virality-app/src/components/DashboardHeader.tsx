"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  onAddAccount?: () => void;
  onOpenSettings?: () => void;
}

export function DashboardHeader({ title, subtitle, onAddAccount, onOpenSettings }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {subtitle && (
          <p className="text-sm text-text-tertiary mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="tertiary"
          className="bg-surface-elevated text-text-secondary"
          onPress={onOpenSettings}
        >
          <Icon icon="solar:bell-bold-duotone" width={16} />
          Alert Settings
        </Button>
        <Button
          size="sm"
          className="bg-accent-400 text-white"
          onPress={onAddAccount}
        >
          <Icon icon="solar:add-circle-bold-duotone" width={16} />
          Add Account
        </Button>
      </div>
    </div>
  );
}
