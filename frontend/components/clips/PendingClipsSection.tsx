"use client";

import React from "react";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Clip {
  id: number;
  status: string;
  created_at: string;
}

interface PendingClipsSectionProps {
  clips: Clip[];
  onClipClick: (clip: Clip) => void;
}

export default function PendingClipsSection({
  clips,
  onClipClick,
}: PendingClipsSectionProps) {
  if (clips.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
        <Icon
          icon="solar:clock-circle-bold-duotone"
          className="text-2xl text-warning-400"
        />
        Processing ({clips.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clips.map((clip) => (
          <Card
            key={clip.id}
            isPressable
            onPress={() => onClipClick(clip)}
            className="bg-surface-base border border-warning-500/30 hover:border-warning-500/50 transition-colors"
          >
            <CardBody className="p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
              <Icon
                icon="solar:loading-circle-bold"
                className="text-6xl animate-spin text-warning-400"
              />
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary mb-1">
                  {clip.status === "pending" ? "Processing" : "Processing..."}
                </p>
                <p className="text-xs text-text-tertiary">
                  Started {new Date(clip.created_at).toLocaleTimeString()}
                </p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
