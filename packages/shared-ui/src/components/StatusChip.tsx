"use client";

import { Chip } from "@heroui/react";
import type { JobStatus } from "@clipper/shared-types";

const statusConfig: Record<JobStatus, { color: "default" | "accent" | "success" | "danger" | "warning"; label: string }> = {
  queued: { color: "default", label: "Queued" },
  processing: { color: "accent", label: "Processing" },
  completed: { color: "success", label: "Completed" },
  failed: { color: "danger", label: "Failed" },
};

export function StatusChip({ status, size = "sm" }: { status: JobStatus; size?: "sm" | "md" | "lg" }) {
  const config = statusConfig[status];

  return (
    <Chip color={config.color} size={size} variant="soft">
      {config.label}
    </Chip>
  );
}
