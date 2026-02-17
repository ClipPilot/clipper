"use client";

import { Spinner } from "@heroui/react";

export function RecalcOverlay({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      {active && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-dark/60 rounded-xl backdrop-blur-[1px]">
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <Spinner size="sm" />
            <span>Recalculating…</span>
          </div>
        </div>
      )}
    </div>
  );
}
