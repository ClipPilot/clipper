"use client";

import { Chip } from "@heroui/react";
import type { Clip } from "@clipper/shared-types";

type ClipStatus = Clip["status"];

const statusConfig: Record<ClipStatus, { color: "default" | "accent" | "success" | "danger" | "warning"; label: string }> = {
  pending: { color: "default", label: "Pending" },
  completed: { color: "success", label: "Completed" },
  failed: { color: "danger", label: "Failed" },
};

export function StatusChip({ status, size = "sm" }: { status: ClipStatus; size?: "sm" | "md" | "lg" }) {
  const config = statusConfig[status];

  return (
    <Chip color={config.color} size={size} variant="soft">
      {config.label}
    </Chip>
  );
}
