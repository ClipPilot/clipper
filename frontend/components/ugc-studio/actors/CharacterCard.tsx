"use client";

import { Card, CardBody, Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { Character } from "./types";

interface CharacterCardProps {
  character: Character;
  isSelected?: boolean;
  onSelect: (character: Character) => void;
  showVariationButton?: boolean;
  onVariation?: (character: Character) => void;
}

export function CharacterCard({
  character,
  isSelected = false,
  onSelect,
  showVariationButton = false,
  onVariation,
}: CharacterCardProps) {
  const imageUrl = character.primaryImageUrl || character.imageUrls?.[character.primary_image_index || 0];

  return (
    <Card
      isPressable
      onPress={() => onSelect(character)}
      className={`bg-surface-base border-2 transition-all duration-200 group overflow-hidden ${
        isSelected
          ? "border-accent-400 ring-2 ring-accent-400/30"
          : "border-border-base hover:border-accent-400/50"
      }`}
    >
      <CardBody className="p-0">
        <div className="relative aspect-[3/4] overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={character.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
              <Icon icon="solar:user-circle-bold-duotone" className="text-text-muted" width={48} />
            </div>
          )}

          {isSelected && (
            <div className="absolute top-2 right-2">
              <div className="w-6 h-6 rounded-full bg-accent-400 flex items-center justify-center">
                <Icon icon="solar:check-circle-bold" className="text-white" width={16} />
              </div>
            </div>
          )}

          {character.public && (
            <div className="absolute top-2 left-2">
              <Chip
                size="sm"
                variant="flat"
                classNames={{
                  base: "bg-surface-base/80 backdrop-blur-sm h-5",
                  content: "text-[10px] font-medium text-text-secondary px-1",
                }}
              >
                Public
              </Chip>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
            <h3 className="text-white font-semibold text-sm truncate">{character.name}</h3>
            {character.gender && (
              <p className="text-white/70 text-xs capitalize">{character.gender} • {character.age_range}</p>
            )}
          </div>
        </div>

        {showVariationButton && (
          <div className="p-3 border-t border-border-base">
            <Button
              size="sm"
              variant="bordered"
              className="w-full border-border-base text-text-secondary hover:border-accent-400 hover:text-accent-400"
              startContent={<Icon icon="solar:magic-stick-3-linear" width={14} />}
              onPress={() => onVariation?.(character)}
            >
              Create Variation
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
