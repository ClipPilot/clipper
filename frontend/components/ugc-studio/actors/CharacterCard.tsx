"use client";

import { useState } from "react";
import { Card, CardBody, Chip, Switch, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { actorsAPI } from "@/api/actors";
import type { Character } from "./types";

interface CharacterCardProps {
  character: Character;
  isSelected?: boolean;
  onSelect: (character: Character) => void;
  showShareToggle?: boolean;
  onShareToggle?: (character: Character, isPublic: boolean) => void;
}

export function CharacterCard({
  character,
  isSelected = false,
  onSelect,
  showShareToggle = false,
  onShareToggle,
}: CharacterCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const imageUrl = character.primaryImageUrl || character.imageUrls?.[character.primary_image_index || 0];

  return (
    <Card
      isPressable
      onPress={() => onSelect(character)}
      className={`bg-surface-base border-2 transition-all duration-200 group overflow-hidden rounded-2xl ${
        isSelected
          ? "border-accent-400 ring-2 ring-accent-400/30 shadow-lg shadow-accent-400/10"
          : "border-border-base hover:border-accent-400/50 hover:shadow-md"
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
            <div className="absolute top-3 right-3">
              <div className="w-7 h-7 rounded-full bg-accent-400 flex items-center justify-center shadow-lg">
                <Icon icon="solar:check-circle-bold" className="text-white" width={18} />
              </div>
            </div>
          )}

          {character.public && (
            <div className="absolute top-3 left-3">
              <Chip
                size="sm"
                variant="flat"
                classNames={{
                  base: "bg-green-500/90 backdrop-blur-sm h-6",
                  content: "text-xs font-medium text-white px-1.5",
                }}
              >
                Public
              </Chip>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-12">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-white font-semibold text-base leading-tight line-clamp-2 mb-1">{character.name}</h3>
                {character.gender && (
                  <p className="text-white/70 text-sm capitalize">{character.gender} • {character.age_range}</p>
                )}
              </div>
              {character.uses_count > 0 && (
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1.5 shrink-0">
                  <Icon icon="solar:eye-bold" width={14} className="text-white/80" />
                  <span className="text-white/90 text-sm font-medium">
                    {character.uses_count >= 1000
                      ? `${(character.uses_count / 1000).toFixed(1)}k`
                      : character.uses_count}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {showShareToggle && (
          <div className="p-3 border-t border-border-base" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon
                  icon={character.public ? "solar:users-group-rounded-bold" : "solar:lock-bold"}
                  className={character.public ? "text-green-400" : "text-text-muted"}
                  width={16}
                />
                <span className="text-sm text-text-secondary">
                  {character.public ? "Shared" : "Private"}
                </span>
              </div>
              <Tooltip content={character.public ? "Make private" : "Share with community"}>
                <div>
                  <Switch
                    size="sm"
                    isSelected={character.public}
                    isDisabled={isUpdating}
                    onValueChange={async () => {
                      if (isUpdating) return;
                      setIsUpdating(true);
                      try {
                        const response = await actorsAPI.update(character.id, { isPublic: !character.public });
                        onShareToggle?.(response.character, !character.public);
                      } catch (error) {
                        console.error("Failed to update character:", error);
                      } finally {
                        setIsUpdating(false);
                      }
                    }}
                    classNames={{
                      wrapper: "group-data-[selected=true]:bg-green-500",
                    }}
                  />
                </div>
              </Tooltip>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
