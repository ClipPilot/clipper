"use client";

import React from "react";
import { Card, Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

interface GeneratedClip {
  id: number;
  clipPath: string;
  finalMessage: string;
  evalScore: number;
}

interface GeneratedClipCardProps {
  clip: GeneratedClip;
  index: number;
}

export const GeneratedClipCard: React.FC<GeneratedClipCardProps> = ({ clip, index }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "success";
    if (score >= 60) return "warning";
    return "default";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    return "Fair";
  };

  return (
    <Card className="bg-surface-base border border-border-accent hover:bg-surface-elevated transition-all">
      <Card.Header className="flex items-center justify-between p-4 border-b border-border-base">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-400/10 rounded-lg flex items-center justify-center">
            <Icon icon="solar:video-frame-play-vertical-bold-duotone" className="text-2xl text-accent-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">
              Clip #{index + 1}
            </h3>
            <p className="text-xs text-text-tertiary">ID: {clip.id}</p>
          </div>
        </div>

        <Chip
 color={getScoreColor(clip.evalScore)}
 variant="tertiary"
 size="sm"
 >
          <Icon icon="solar:star-bold" />
          {clip.evalScore}/100
        </Chip>
      </Card.Header>

      <Card.Content className="p-4">
        {/* Video Preview Placeholder */}
        <div className="aspect-video bg-surface-dark rounded-lg mb-4 flex items-center justify-center border border-border-base">
          <div className="text-center">
            <Icon icon="solar:play-circle-bold-duotone" className="text-6xl text-accent-400 mb-2" />
            <p className="text-sm text-text-secondary">Video Preview</p>
            <p className="text-xs text-text-tertiary mt-1">{clip.clipPath.split('/').pop()}</p>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Icon icon="solar:chat-round-bold-duotone" className="text-lg text-accent-400" />
              <h4 className="text-sm font-semibold text-text-primary">AI Analysis</h4>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed pl-6">
              {clip.finalMessage}
            </p>
          </div>

          {/* Quality Badge */}
          <div className="flex items-center gap-2 pl-6">
            <Icon icon="solar:medal-star-bold-duotone" className="text-lg text-accent-400" />
            <span className="text-sm font-medium text-text-primary">
              Quality: {getScoreLabel(clip.evalScore)}
            </span>
          </div>
        </div>
      </Card.Content>

      <Card.Footer className="p-4 border-t border-border-base flex gap-2">
        <Button variant="primary"
 size="sm"
 className="flex-1"
 >
          <Icon icon="solar:download-bold" />
          Download
        </Button>
        <Button
 size="sm"
 variant="outline"
 className="flex-1"
 >
          <Icon icon="solar:share-bold" />
          Share
        </Button>
        <Button
 size="sm"
 variant="tertiary"
 isIconOnly
 >
        <Icon icon="solar:eye-bold" />
        </Button>
      </Card.Footer>
    </Card>
  );
};

