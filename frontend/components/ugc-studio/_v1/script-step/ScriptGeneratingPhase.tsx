"use client";

import { Progress } from "@heroui/react";
import { Icon } from "@iconify/react";

interface ScriptGeneratingPhaseProps {
  progress: number;
  message: string;
}

export function ScriptGeneratingPhase({ progress, message }: ScriptGeneratingPhaseProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-400/20 to-purple-500/20 flex items-center justify-center mb-6 animate-pulse">
        <Icon
          icon="solar:magic-stick-3-bold-duotone"
          className="text-accent-400"
          width={48}
        />
      </div>
      <h3 className="text-xl font-semibold text-text-primary mb-2">
        Crafting Your Viral Script
      </h3>
      <p className="text-text-secondary mb-6">
        {message || "Analyzing product images and generating script variations..."}
      </p>
      <div className="w-full max-w-md space-y-2">
        <Progress
          value={progress}
          size="lg"
          classNames={{
            indicator: "bg-gradient-to-r from-accent-400 to-purple-500",
          }}
        />
        <p className="text-center text-xs text-text-muted">{progress}% complete</p>
      </div>
    </div>
  );
}
