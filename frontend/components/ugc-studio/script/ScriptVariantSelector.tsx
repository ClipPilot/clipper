"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { UGCScript } from "./types";

interface ScriptVariantSelectorProps {
  scripts: UGCScript[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function ScriptVariantSelector({
  scripts,
  selectedIndex,
  onSelect,
}: ScriptVariantSelectorProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {scripts.map((script, index) => (
        <Card
          key={index}
          isPressable
          onPress={() => onSelect(index)}
          className={`flex-shrink-0 w-64 border transition-all ${
            selectedIndex === index
              ? "border-accent-400 bg-accent-400/10"
              : "border-border-base bg-surface-elevated hover:border-border-hover"
          }`}
        >
          <CardBody className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">
                Variant {index + 1}
              </span>
              <div className="flex items-center gap-1">
                <Icon icon="solar:star-bold" className="text-yellow-400" width={12} />
                <span className="text-xs font-semibold text-text-primary">
                  {script.viralScore}
                </span>
              </div>
            </div>
            <p className="text-sm font-medium text-text-primary line-clamp-1">
              {script.title}
            </p>
            <p className="text-xs text-text-secondary line-clamp-2">
              {script.hook}
            </p>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>{script.scenes.length} scenes</span>
              <span>•</span>
              <span>{script.totalEstimatedDuration}s</span>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
