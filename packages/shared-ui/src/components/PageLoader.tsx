"use client";

import { Spinner } from "@heroui/react";

export function PageLoader({ color = "accent" }: { color?: string }) {
  return (
    <div className="min-h-screen bg-surface-dark flex items-center justify-center">
      <Spinner size="lg" color={color as any} />
    </div>
  );
}
