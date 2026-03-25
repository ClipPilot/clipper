"use client";

import { Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { Character } from "../../actors/types";

interface CharacterPreviewCardProps {
  character: Character;
  selectedImageIndex: number;
  onImageIndexChange: (index: number) => void;
}

export function CharacterPreviewCard({
  character,
  selectedImageIndex,
  onImageIndexChange,
}: CharacterPreviewCardProps) {
  const actorImages = character.imageUrls || [];

  return (
    <Card className="bg-surface-elevated border border-border-base">
      <Card.Content className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-24 rounded-xl overflow-hidden bg-surface-base flex-shrink-0">
            {actorImages[selectedImageIndex] ? (
              <img
                src={actorImages[selectedImageIndex]}
                alt={character.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon icon="solar:user-circle-bold-duotone" className="text-text-muted" width={32} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-accent truncate">
              {character.name}
            </h3>
            <p className="text-sm text-text-secondary capitalize">
              {character.gender} • {character.age_range}
            </p>
            {actorImages.length > 1 && (
              <p className="text-xs text-text-muted mt-1">
                Select a look for your script
              </p>
            )}
          </div>
        </div>

        {actorImages.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {actorImages.map((url, index) => (
              <button
                key={index}
                onClick={() => onImageIndexChange(index)}
                className={`relative w-14 h-[70px] rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                  selectedImageIndex === index
                    ? "border-accent-400 ring-2 ring-accent-400/30"
                    : "border-border-base hover:border-accent-400/50"
                }`}
              >
                <img
                  src={url}
                  alt={`Look ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {index === character.primary_image_index && (
                  <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-accent-400 flex items-center justify-center">
                    <Icon icon="solar:star-bold" className="text-white" width={8} />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
