"use client";

import { CharacterCard } from "./CharacterCard";
import type { Character } from "./types";

interface CharacterGridProps {
  characters: Character[];
  selectedId?: number;
  selectedIds?: number[];
  onSelect: (character: Character) => void;
  showShareToggle?: boolean;
  onShareToggle?: (character: Character, isPublic: boolean) => void;
}

export function CharacterGrid({
  characters,
  selectedId,
  selectedIds,
  onSelect,
  showShareToggle = false,
  onShareToggle,
}: CharacterGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-5">
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          isSelected={selectedIds ? selectedIds.includes(character.id) : character.id === selectedId}
          onSelect={onSelect}
          showShareToggle={showShareToggle}
          onShareToggle={onShareToggle}
        />
      ))}
    </div>
  );
}
