"use client";

import { useRef, useState, useCallback } from "react";
import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import { EXAMPLE_CHARACTERS, SelectedCharacter } from "./types";

interface CharacterSelectorProps {
  selectedCharacter: SelectedCharacter | null;
  onCharacterChange: (character: SelectedCharacter | null) => void;
}

export function CharacterSelector({
  selectedCharacter,
  onCharacterChange,
}: CharacterSelectorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingCharacterId, setLoadingCharacterId] = useState<string | null>(null);

  const characterPreview = selectedCharacter?.src || null;

  const handleImageSelect = useCallback(
    (file: File) => {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) return;

      if (selectedCharacter?.type === "uploaded" && selectedCharacter.src) {
        URL.revokeObjectURL(selectedCharacter.src);
      }

      const preview = URL.createObjectURL(file);
      onCharacterChange({ type: "uploaded", src: preview, file });
    },
    [selectedCharacter, onCharacterChange]
  );

  const handleExampleSelect = async (id: string, src: string) => {
    if (selectedCharacter?.type === "uploaded" && selectedCharacter.src) {
      URL.revokeObjectURL(selectedCharacter.src);
    }
    setLoadingCharacterId(id);
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const filename = src.split("/").pop() || "character.jpg";
      const file = new File([blob], filename, { type: blob.type });
      onCharacterChange({ type: "example", src, file });
    } catch {
      onCharacterChange({ type: "example", src });
    } finally {
      setLoadingCharacterId(null);
    }
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

  const handleClear = () => {
    if (selectedCharacter?.type === "uploaded" && selectedCharacter.src) {
      URL.revokeObjectURL(selectedCharacter.src);
    }
    onCharacterChange(null);
  };

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Icon icon="solar:user-circle-bold-duotone" className="text-purple-500" width={22} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Character Face</h3>
            <p className="text-xs text-text-tertiary">Upload the face to swap</p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="pt-4 space-y-4">
        {selectedCharacter && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-surface-elevated aspect-square">
              <img
                src={characterPreview || ""}
                alt="Character"
                className="w-full h-full object-cover"
              />
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                className="absolute top-2 right-2 bg-surface-base/80"
                onPress={handleClear}
              >
                <Icon icon="solar:close-circle-bold" width={18} />
              </Button>
            </div>
            {selectedCharacter.type === "uploaded" && selectedCharacter.file && (
              <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
                <Icon icon="solar:gallery-bold-duotone" width={16} />
                <span className="truncate">{selectedCharacter.file.name}</span>
              </div>
            )}
            {selectedCharacter.type === "example" && (
              <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
                <Icon icon="solar:star-bold-duotone" width={16} />
                <span>Example Character</span>
              </div>
            )}
          </div>
        )}

        {!selectedCharacter && (
          <>
            <div>
              <p className="text-xs text-text-tertiary mb-2">Choose an example</p>
              <div className="grid grid-cols-4 gap-2">
                {EXAMPLE_CHARACTERS.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => handleExampleSelect(String(char.id), char.src)}
                    disabled={loadingCharacterId !== null}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all focus:outline-none ${
                      loadingCharacterId === String(char.id)
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
                ))}
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
      </CardBody>
    </Card>
  );
}
