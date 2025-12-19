"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { Chip } from "@heroui/react";
import { ClipCard } from "./ClipCard";
import { Clip } from "@/api/clips";

interface NewClipsSectionProps {
  clips: Clip[];
  onDelete: (clipId: number) => void;
  onClipClick: (clip: Clip) => void;
  onEditClick?: (clip: Clip) => void;
}

export default function NewClipsSection({
  clips,
  onDelete,
  onClipClick,
  onEditClick,
}: NewClipsSectionProps) {
  if (clips.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
        <Icon icon="solar:star-circle-bold-duotone" className="text-2xl text-accent-400" />
        New ({clips.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clips.map((clip) => (
          <div key={clip.id} className="relative">
            <Chip
              color="success"
              variant="flat"
              size="sm"
              className="absolute -top-2 -right-2 z-10"
            >
              NEW
            </Chip>
            <ClipCard
              clip={clip}
              onDelete={onDelete}
              onView={() => onClipClick(clip)}
              onEdit={onEditClick ? () => onEditClick(clip) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
