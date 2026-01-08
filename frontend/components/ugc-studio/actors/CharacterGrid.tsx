"use client";

import { CharacterCard } from "./CharacterCard";
import type { Character } from "./types";

interface CharacterGridProps {
  characters: Character[];
  selectedId?: number;
  onSelect: (character: Character) => void;
  showVariationButton?: boolean;
  onVariation?: (character: Character) => void;
}

export function CharacterGrid({
  characters,
  selectedId,
  onSelect,
  showVariationButton = false,
  onVariation,
}: CharacterGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          isSelected={character.id === selectedId}
          onSelect={onSelect}
          showVariationButton={showVariationButton}
          onVariation={onVariation}
        />
      ))}
    </div>
  );
}
