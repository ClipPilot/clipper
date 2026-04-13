"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { DateRangeFilter } from "@clipper/shared-ui";
import { DateRangeValue } from "@clipper/shared-ui/components/DateRangeFilter";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  dateRange: DateRangeValue;
  setDateRange: (value: { startDate?: string; endDate?: string }) => void;
  onAddAccount?: () => void;
  onOpenSettings?: () => void;
}

export function DashboardHeader({
  title,
  subtitle,
  dateRange,
  setDateRange,
  onAddAccount,
  onOpenSettings,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <p className="text-text-secondary text-sm mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        <Button
          variant="outline"
          className="border-border-base text-text-secondary"
          onPress={onOpenSettings}
        >
          <Icon icon="solar:bell-bold" width={18} />
          Alert Settings
        </Button>
        <Button
          size="sm"
          className="bg-blue-500 text-white hover:bg-blue-600"
          onPress={onAddAccount}
        >
          <Icon icon="solar:add-circle-bold" width={16} />
          Add Account
        </Button>
      </div>
    </div>
  );
}
