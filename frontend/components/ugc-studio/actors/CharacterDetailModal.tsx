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
  const [loading, setLoading] = useState(false);

  const variations = allCharacters.filter((c) => c.parent_character_id === character?.id);

  useEffect(() => {
    if (character && isOpen) {
      setSelectedImageIndex(character.primary_image_index || 0);
      if (!character.imageUrls || character.imageUrls.length === 0) {
        setLoading(true);
        actorsAPI.getById(character.id)
          .then((res) => setFullCharacter(res.character))
          .catch(console.error)
          .finally(() => setLoading(false));
      } else {
        setFullCharacter(character);
      }
    }
  }, [character, isOpen]);

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
                      <div>
                        <span className="text-text-muted">Camera:</span>{" "}
                        <span className="text-text-secondary capitalize">
                          {displayCharacter.style_config.cameraStyle?.replace("-", " ")}
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

                {variations.length > 0 && (
                  <div className="bg-surface-elevated rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Icon icon="solar:copy-bold-duotone" width={18} className="text-purple-400" />
                      Variations ({variations.length})
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {variations.slice(0, 6).map((variation) => (
                        <button
                          key={variation.id}
                          onClick={() => {
                            onClose();
                            setTimeout(() => onSelect?.(variation), 100);
                          }}
                          className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface-base group"
                        >
                          {variation.primaryImageUrl || variation.imageUrls?.[0] ? (
                            <img
                              src={variation.primaryImageUrl || variation.imageUrls?.[0]}
                              alt={variation.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icon icon="solar:user-circle-bold-duotone" className="text-text-muted" width={32} />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-xs text-white truncate">{variation.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    {variations.length > 6 && (
                      <p className="text-xs text-text-muted text-center">+{variations.length - 6} more</p>
                    )}
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
                  {variations.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Icon icon="solar:copy-bold" width={16} className="text-text-muted" />
                      <span>{variations.length} variations</span>
                    </div>
                  )}
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
