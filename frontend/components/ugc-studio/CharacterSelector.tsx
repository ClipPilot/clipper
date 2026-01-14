"use client";

import { useRef, useState, useCallback } from "react";
import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import { EXAMPLE_CHARACTERS, SelectedCharacter } from "./types";

interface CharacterSelectorProps {
  selectedCharacters: SelectedCharacter[];
  onCharactersChange: (characters: SelectedCharacter[]) => void;
  maxSelections?: number;
}

export function CharacterSelector({
  selectedCharacters,
  onCharactersChange,
  maxSelections = 10,
}: CharacterSelectorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingCharacterId, setLoadingCharacterId] = useState<string | null>(null);

  const canAddMore = selectedCharacters.length < maxSelections;

  const handleImageSelect = useCallback(
    (file: File) => {
      if (!canAddMore) return;

      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) return;

      const preview = URL.createObjectURL(file);
      const newCharacter: SelectedCharacter = { type: "uploaded", src: preview, file };
      onCharactersChange([...selectedCharacters, newCharacter]);
    },
    [selectedCharacters, onCharactersChange, canAddMore]
  );

  const handleExampleSelect = async (id: string, src: string) => {
    if (!canAddMore) return;

    // Check if this example is already selected
    const alreadySelected = selectedCharacters.some(
      (c) => c.type === "example" && c.src === src
    );
    if (alreadySelected) return;

    setLoadingCharacterId(id);
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const filename = src.split("/").pop() || "character.jpg";
      const file = new File([blob], filename, { type: blob.type });
      const newCharacter: SelectedCharacter = { type: "example", src, file };
      onCharactersChange([...selectedCharacters, newCharacter]);
    } catch {
      const newCharacter: SelectedCharacter = { type: "example", src };
      onCharactersChange([...selectedCharacters, newCharacter]);
    } finally {
      setLoadingCharacterId(null);
    }
  };

  const handleRemoveCharacter = (index: number) => {
    const character = selectedCharacters[index];
    // Revoke object URL if it was an uploaded file
    if (character.type === "uploaded" && character.src) {
      URL.revokeObjectURL(character.src);
    }
    const newCharacters = selectedCharacters.filter((_, i) => i !== index);
    onCharactersChange(newCharacters);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const handleClearAll = () => {
    // Revoke all uploaded file URLs
    selectedCharacters.forEach((c) => {
      if (c.type === "uploaded" && c.src) {
        URL.revokeObjectURL(c.src);
      }
    });
    onCharactersChange([]);
  };

  // Check if an example character is already selected
  const isExampleSelected = (src: string) => {
    return selectedCharacters.some((c) => c.type === "example" && c.src === src);
  };

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Icon icon="solar:user-circle-bold-duotone" className="text-purple-500" width={22} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-text-primary">Character Faces</h3>
            <p className="text-xs text-text-tertiary">
              {selectedCharacters.length > 0
                ? `${selectedCharacters.length}/${maxSelections} faces selected`
                : "Select faces to swap (max 10)"}
            </p>
          </div>
          {selectedCharacters.length > 0 && (
            <Button
              size="sm"
              variant="flat"
              className="text-text-muted"
              onPress={handleClearAll}
            >
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody className="pt-4 space-y-4">
        {/* Selected characters grid */}
        {selectedCharacters.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-text-tertiary">Selected faces</p>
            <div className="grid grid-cols-5 gap-2">
              {selectedCharacters.map((character, index) => (
                <div
                  key={`${character.src}-${index}`}
                  className="relative aspect-square rounded-lg overflow-hidden bg-surface-elevated group"
                >
                  <img
                    src={character.src}
                    alt={`Character ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleRemoveCharacter(index)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Icon icon="solar:close-circle-bold" width={14} />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                    <span className="text-[10px] text-white font-medium">
                      {character.type === "uploaded" ? "Custom" : "Example"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add more section - only show if can add more */}
        {canAddMore && (
          <>
            {selectedCharacters.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border-base" />
                <span className="text-xs text-text-muted">Add more</span>
                <div className="flex-1 h-px bg-border-base" />
              </div>
            )}

            <div>
              <p className="text-xs text-text-tertiary mb-2">Choose an example</p>
              <div className="grid grid-cols-4 gap-2">
                {EXAMPLE_CHARACTERS.map((char) => {
                  const selected = isExampleSelected(char.src);
                  return (
                    <button
                      key={char.id}
                      onClick={() => handleExampleSelect(String(char.id), char.src)}
                      disabled={loadingCharacterId !== null || selected}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all focus:outline-none ${
                        selected
                          ? "border-green-500 opacity-50 cursor-not-allowed"
                          : loadingCharacterId === String(char.id)
                            ? "border-purple-500 opacity-50"
                            : "border-transparent hover:border-purple-500 hover:scale-105"
                      }`}
                    >
                      <img
                        src={char.src}
                        alt={`Character ${char.id}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border-base" />
              <span className="text-xs text-text-muted">or</span>
              <div className="flex-1 h-px bg-border-base" />
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
                isDragging
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-border-base hover:border-purple-500/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center">
                  <Icon icon="solar:gallery-add-bold-duotone" className="text-xl text-purple-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-text-primary">Upload your own</p>
                  <p className="text-xs text-text-tertiary">JPG, PNG, WebP</p>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelect(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="flat"
                  className="bg-purple-500/20 text-purple-500"
                  onPress={() => imageInputRef.current?.click()}
                  startContent={<Icon icon="solar:folder-open-bold" />}
                >
                  Browse
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Max reached message */}
        {!canAddMore && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <Icon icon="solar:info-circle-bold" className="text-amber-400" width={18} />
            <span className="text-sm text-amber-400">
              Maximum {maxSelections} faces reached
            </span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
