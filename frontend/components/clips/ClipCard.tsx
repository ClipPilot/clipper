"use client";

import React from "react";
import { Card, CardBody, CardFooter, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Clip } from "@/api/clips";

interface ClipCardProps {
  clip: Clip;
  onDelete?: (clipId: number) => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, clipId: number) => void;
  onDragEnd?: () => void;
}

export const ClipCard: React.FC<ClipCardProps> = ({ clip, onDelete, isDragging, onDragStart, onDragEnd }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("clipId", clip.id.toString());
    e.dataTransfer.effectAllowed = "move";
    if (onDragStart) {
      onDragStart(e, clip.id);
    }
  };

  return (
    <Card
      className={`bg-surface-base border border-border-accent hover:bg-surface-elevated transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50 scale-95" : ""
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-surface-elevated rounded-lg flex items-center justify-center border border-border-base">
              <Icon icon="solar:video-frame-play-vertical-bold-duotone" className="text-3xl text-accent-400" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-text-primary truncate">
                Clip #{clip.id}
              </h3>
              {clip.clip_score && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-accent-400/10 rounded-full">
                  <Icon icon="solar:star-bold" className="text-xs text-accent-400" />
                  <span className="text-xs font-medium text-accent-400">{clip.clip_score}</span>
                </div>
              )}
            </div>
            
            {clip.message && (
              <p className="text-xs text-text-secondary line-clamp-2 mb-2">
                {clip.message}
              </p>
            )}
            
            <div className="flex items-center gap-3 text-xs text-text-tertiary">
              <div className="flex items-center gap-1">
                <Icon icon="solar:clock-circle-outline" className="text-sm" />
                <span>{formatDate(clip.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
      
      <CardFooter className="px-4 py-2 border-t border-border-base flex justify-between gap-2">
        <Button
          size="sm"
          variant="light"
          className="text-xs text-text-secondary hover:text-accent-400"
          startContent={<Icon icon="solar:eye-outline" className="text-base" />}
        >
          View
        </Button>
        
        <Button
          size="sm"
          variant="light"
          className="text-xs text-text-secondary hover:text-accent-400"
          startContent={<Icon icon="solar:download-outline" className="text-base" />}
        >
          Download
        </Button>
        
        {onDelete && (
          <Button
            size="sm"
            variant="light"
            color="danger"
            className="text-xs"
            startContent={<Icon icon="solar:trash-bin-outline" className="text-base" />}
            onPress={() => onDelete(clip.id)}
          >
            Delete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

