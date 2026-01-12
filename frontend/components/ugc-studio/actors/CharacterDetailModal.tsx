"use client";

import { useState, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, Button, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { actorsAPI } from "@/api/actors";
import type { Character } from "./types";

interface CharacterDetailModalProps {
  character: Character | null;
  isOpen: boolean;
  onClose: () => void;
  allCharacters: Character[];
  onVariation?: (character: Character) => void;
  onSelect?: (character: Character) => void;
}

export function CharacterDetailModal({
  character,
  isOpen,
  onClose,
  allCharacters,
  onVariation,
  onSelect,
}: CharacterDetailModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [fullCharacter, setFullCharacter] = useState<Character | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [loadedCharacters, setLoadedCharacters] = useState<Record<number, Character>>({});
  const [loading, setLoading] = useState(false);

  const variations = allCharacters.filter((c) => c.parent_character_id === character?.id);
  const allOptions = character ? [character, ...variations] : [];

  // Load character data when needed
  const loadCharacterData = async (char: Character) => {
    if (loadedCharacters[char.id]) return loadedCharacters[char.id];
    if (char.imageUrls && char.imageUrls.length > 0) {
      setLoadedCharacters((prev) => ({ ...prev, [char.id]: char }));
      return char;
    }

    setLoading(true);
    try {
      const res = await actorsAPI.getById(char.id);
      setLoadedCharacters((prev) => ({ ...prev, [char.id]: res.character }));
      return res.character;
    } catch (e) {
      console.error(e);
      return char;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (character && isOpen) {
      setSelectedCharacterId(character.id);
      setSelectedImageIndex(character.primary_image_index || 0);
      loadCharacterData(character).then((loaded) => {
        setFullCharacter(loaded);
      });
    }
  }, [character, isOpen]);

  // Handle selecting a different character/variation
  const handleCharacterSelect = async (char: Character) => {
    setSelectedCharacterId(char.id);
    setSelectedImageIndex(char.primary_image_index || 0);
    const loaded = await loadCharacterData(char);
    setFullCharacter(loaded);
  };

  if (!character) return null;

  const displayCharacter = fullCharacter || character;
  const images = displayCharacter.imageUrls || [];

  const handleSelectAndClose = () => {
    onSelect?.(displayCharacter);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-surface-base border border-border-base",
        header: "border-b border-border-base",
        body: "p-0",
        closeButton: "hover:bg-surface-elevated",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-text-primary truncate">{displayCharacter.name}</h2>
              {displayCharacter.public && (
                <Chip size="sm" variant="flat" classNames={{ base: "bg-green-500/20", content: "text-green-400 text-xs font-medium" }}>
                  Public
                </Chip>
              )}
            </div>
            {displayCharacter.gender && (
              <p className="text-sm text-text-secondary mt-1 capitalize">
                {displayCharacter.gender} &bull; {displayCharacter.age_range}
              </p>
            )}
          </div>
        </ModalHeader>

        <ModalBody>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" color="primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              <div className="space-y-4">
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-surface-elevated">
                  {images[selectedImageIndex] ? (
                    <img
                      src={images[selectedImageIndex]}
                      alt={`${displayCharacter.name} - Image ${selectedImageIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon icon="solar:user-circle-bold-duotone" className="text-text-muted" width={80} />
                    </div>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="flex gap-2 justify-center">
                    {images.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`relative w-16 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                          selectedImageIndex === index
                            ? "border-accent-400 ring-2 ring-accent-400/30"
                            : "border-border-base hover:border-accent-400/50"
                        }`}
                      >
                        <img src={url} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                        {index === displayCharacter.primary_image_index && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent-400 flex items-center justify-center">
                            <Icon icon="solar:star-bold" className="text-white" width={10} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {allOptions.length > 1 && (
                  <div className="space-y-2 pt-2 border-t border-border-base">
                    <p className="text-xs text-text-muted text-center">
                      Original & Variations ({allOptions.length})
                    </p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {allOptions.map((char) => {
                        const isSelected = selectedCharacterId === char.id;
                        const isOriginal = char.id === character?.id;
                        const thumbUrl = char.primaryImageUrl || char.imageUrls?.[0];

                        return (
                          <button
                            key={char.id}
                            onClick={() => handleCharacterSelect(char)}
                            className={`relative w-16 h-20 rounded-lg overflow-hidden border-2 transition-all group ${
                              isSelected
                                ? "border-accent-400 ring-2 ring-accent-400/30"
                                : isOriginal
                                  ? "border-border-base hover:border-accent-400/50"
                                  : "border-purple-500/50 hover:border-purple-400"
                            }`}
                          >
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={char.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
                                <Icon icon="solar:user-circle-bold-duotone" className="text-text-muted" width={24} />
                              </div>
                            )}
                            {isOriginal && (
                              <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-accent-400 flex items-center justify-center">
                                <Icon icon="solar:star-bold" className="text-white" width={10} />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                              <p className="text-[10px] text-white truncate">
                                {isOriginal ? "Original" : char.name}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {displayCharacter.appearance_config && (
                  <div className="bg-surface-elevated rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Icon icon="solar:face-scan-circle-bold-duotone" width={18} className="text-accent-400" />
                      Appearance
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-text-muted">Hair:</span>{" "}
                        <span className="text-text-secondary capitalize">
                          {displayCharacter.appearance_config.hairColor} {displayCharacter.appearance_config.hairStyle}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Eyes:</span>{" "}
                        <span className="text-text-secondary capitalize">{displayCharacter.appearance_config.eyeColor}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">Skin:</span>{" "}
                        <span className="text-text-secondary capitalize">{displayCharacter.appearance_config.skinTone}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">Body:</span>{" "}
                        <span className="text-text-secondary capitalize">{displayCharacter.appearance_config.bodyType}</span>
                      </div>
                    </div>
                  </div>
                )}

                {displayCharacter.style_config && (
                  <div className="bg-surface-elevated rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Icon icon="solar:hanger-2-bold-duotone" width={18} className="text-accent-400" />
                      Style
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-text-muted">Outfit:</span>{" "}
                        <span className="text-text-secondary capitalize">
                          {displayCharacter.style_config.outfit === "other"
                            ? displayCharacter.style_config.outfitCustom
                            : displayCharacter.style_config.outfit}
                        </span>
                      </div>
                      {displayCharacter.style_config.setting && (
                        <div className="col-span-2">
                          <span className="text-text-muted">Setting:</span>{" "}
                          <span className="text-text-secondary">{displayCharacter.style_config.setting}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}


                <div className="flex items-center gap-4 text-sm text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <Icon icon="solar:eye-bold" width={16} className="text-text-muted" />
                    <span>{displayCharacter.uses_count} uses</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon icon="solar:gallery-bold" width={16} className="text-text-muted" />
                    <span>{images.length} images</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 bg-accent-400 text-white font-semibold"
                    startContent={<Icon icon="solar:check-circle-bold" width={18} />}
                    onPress={handleSelectAndClose}
                  >
                    Select Actor
                  </Button>
                  {onVariation && (
                    <Button
                      variant="bordered"
                      className="border-border-base text-text-secondary hover:border-accent-400 hover:text-accent-400"
                      startContent={<Icon icon="solar:magic-stick-3-linear" width={18} />}
                      onPress={() => {
                        onClose();
                        onVariation(displayCharacter);
                      }}
                    >
                      Variation
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
