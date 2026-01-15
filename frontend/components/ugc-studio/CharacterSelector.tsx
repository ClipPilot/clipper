"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button, Card, CardBody, CardHeader, Input, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { EXAMPLE_CHARACTERS, SelectedCharacter } from "./types";
import { savedFacesAPI, SavedFace } from "@/api/ugc/savedFaces";

type TabType = "saved" | "examples" | "upload";

interface CharacterSelectorProps {
  selectedCharacters: SelectedCharacter[];
  onCharactersChange: (characters: SelectedCharacter[]) => void;
  maxSelections?: number;
  teamId?: number;
}

export function CharacterSelector({
  selectedCharacters,
  onCharactersChange,
  maxSelections = 10,
  teamId,
}: CharacterSelectorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingCharacterId, setLoadingCharacterId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(teamId ? "saved" : "examples");
  const [savedFaces, setSavedFaces] = useState<SavedFace[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [savingFace, setSavingFace] = useState<{ file: File; preview: string } | null>(null);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canAddMore = selectedCharacters.length < maxSelections;

  useEffect(() => {
    if (teamId) {
      setIsLoadingSaved(true);
      savedFacesAPI
        .list(teamId)
        .then((faces) => {
          setSavedFaces(faces);
          if (faces.length === 0 && activeTab === "saved") {
            setActiveTab("examples");
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingSaved(false));
    }
  }, [teamId]);

  const handleImageSelect = useCallback(
    (file: File) => {
      if (!canAddMore) return;

      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) return;

      const preview = URL.createObjectURL(file);
      setSavingFace({ file, preview });
      setSaveName("");
    },
    [canAddMore]
  );

  const handleAddWithoutSaving = () => {
    if (!savingFace) return;
    const newCharacter: SelectedCharacter = { type: "uploaded", src: savingFace.preview, file: savingFace.file };
    onCharactersChange([...selectedCharacters, newCharacter]);
    setSavingFace(null);
  };

  const handleSaveAndAdd = async () => {
    if (!savingFace || !teamId || !saveName.trim()) return;

    setIsSaving(true);
    try {
      const saved = await savedFacesAPI.save(teamId, saveName.trim(), savingFace.file);
      setSavedFaces((prev) => [saved, ...prev]);

      const newCharacter: SelectedCharacter = { type: "saved", src: saved.imageUrl, file: savingFace.file, savedFaceId: saved.id };
      onCharactersChange([...selectedCharacters, newCharacter]);

      URL.revokeObjectURL(savingFace.preview);
      setSavingFace(null);
      addToast({ title: "Face saved!", color: "success" });
    } catch (err) {
      addToast({ title: "Failed to save face", color: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSave = () => {
    if (savingFace) {
      URL.revokeObjectURL(savingFace.preview);
      setSavingFace(null);
    }
  };

  const handleSavedFaceSelect = async (face: SavedFace) => {
    if (!canAddMore) return;

    const alreadySelected = selectedCharacters.some(
      (c) => c.type === "saved" && c.savedFaceId === face.id
    );
    if (alreadySelected) return;

    setLoadingCharacterId(String(face.id));
    try {
      const response = await fetch(face.imageUrl);
      const blob = await response.blob();
      const file = new File([blob], `${face.name}.jpg`, { type: blob.type });
      const newCharacter: SelectedCharacter = { type: "saved", src: face.imageUrl, file, savedFaceId: face.id };
      onCharactersChange([...selectedCharacters, newCharacter]);
    } catch {
      const newCharacter: SelectedCharacter = { type: "saved", src: face.imageUrl, savedFaceId: face.id };
      onCharactersChange([...selectedCharacters, newCharacter]);
    } finally {
      setLoadingCharacterId(null);
    }
  };

  const handleDeleteSavedFace = async (face: SavedFace, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await savedFacesAPI.delete(face.id);
      setSavedFaces((prev) => prev.filter((f) => f.id !== face.id));
      addToast({ title: "Face deleted", color: "success" });
    } catch {
      addToast({ title: "Failed to delete", color: "danger" });
    }
  };

  const handleExampleSelect = async (id: string, src: string) => {
    if (!canAddMore) return;

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
    selectedCharacters.forEach((c) => {
      if (c.type === "uploaded" && c.src) {
        URL.revokeObjectURL(c.src);
      }
    });
    onCharactersChange([]);
  };

  const isSavedFaceSelected = (id: number) => {
    return selectedCharacters.some((c) => c.type === "saved" && c.savedFaceId === id);
  };

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
            <Button size="sm" variant="flat" className="text-text-muted" onPress={handleClearAll}>
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody className="pt-4 space-y-4">
        {selectedCharacters.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-text-tertiary">Selected faces</p>
            <div className="grid grid-cols-5 gap-2">
              {selectedCharacters.map((character, index) => (
                <div
                  key={`${character.src}-${index}`}
                  className="relative aspect-square rounded-lg overflow-hidden bg-surface-elevated group"
                >
                  <img src={character.src} alt={`Character ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleRemoveCharacter(index)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Icon icon="solar:close-circle-bold" width={14} />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                    <span className="text-[10px] text-white font-medium">
                      {character.type === "uploaded" ? "Custom" : character.type === "saved" ? "Saved" : "Example"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {savingFace && teamId && (
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-3">
            <div className="flex gap-3">
              <img src={savingFace.preview} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-text-primary">Save this face?</p>
                <Input
                  size="sm"
                  placeholder="Enter a name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  classNames={{ inputWrapper: "bg-surface-elevated" }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="flat" className="flex-1" onPress={handleAddWithoutSaving}>
                Just use once
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-purple-500 text-white"
                onPress={handleSaveAndAdd}
                isLoading={isSaving}
                isDisabled={!saveName.trim()}
              >
                Save & Use
              </Button>
              <Button size="sm" variant="flat" isIconOnly onPress={handleCancelSave}>
                <Icon icon="solar:close-circle-bold" />
              </Button>
            </div>
          </div>
        )}

        {canAddMore && !savingFace && (
          <>
            {selectedCharacters.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border-base" />
                <span className="text-xs text-text-muted">Add more</span>
                <div className="flex-1 h-px bg-border-base" />
              </div>
            )}

            <div className="flex p-1 bg-surface-elevated rounded-lg border border-border-base">
              {teamId && (
                <button
                  onClick={() => setActiveTab("saved")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                    activeTab === "saved"
                      ? "bg-purple-500 text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon icon="solar:heart-bold" width={14} />
                  <span className="hidden sm:inline">Saved</span>
                  {savedFaces.length > 0 && (
                    <span className={`text-[10px] px-1 rounded-full ${
                      activeTab === "saved" ? "bg-white/20" : "bg-purple-500/20 text-purple-400"
                    }`}>
                      {savedFaces.length}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setActiveTab("examples")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                  activeTab === "examples"
                    ? "bg-purple-500 text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Icon icon="solar:gallery-bold" width={14} />
                <span className="hidden sm:inline">Examples</span>
              </button>
              <button
                onClick={() => setActiveTab("upload")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                  activeTab === "upload"
                    ? "bg-purple-500 text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Icon icon="solar:upload-bold" width={14} />
                <span className="hidden sm:inline">Upload</span>
              </button>
            </div>

            {activeTab === "saved" && teamId && (
              <div>
                {isLoadingSaved ? (
                  <div className="flex justify-center py-8">
                    <Icon icon="solar:refresh-circle-bold-duotone" className="text-2xl text-purple-500 animate-spin" />
                  </div>
                ) : savedFaces.length === 0 ? (
                  <div className="text-center py-6">
                    <Icon icon="solar:gallery-bold-duotone" className="text-3xl text-text-tertiary mx-auto mb-2" />
                    <p className="text-sm text-text-secondary">No saved faces yet</p>
                    <p className="text-xs text-text-tertiary">Upload a face and save it for later</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {savedFaces.map((face) => {
                      const selected = isSavedFaceSelected(face.id);
                      return (
                        <button
                          key={face.id}
                          onClick={() => handleSavedFaceSelect(face)}
                          disabled={loadingCharacterId !== null || selected}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all focus:outline-none group ${
                            selected
                              ? "border-green-500 opacity-50 cursor-not-allowed"
                              : loadingCharacterId === String(face.id)
                                ? "border-purple-500 opacity-50"
                                : "border-transparent hover:border-purple-500 hover:scale-105"
                          }`}
                        >
                          <img src={face.imageUrl} alt={face.name} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                            <span className="text-[10px] text-white font-medium truncate block">{face.name}</span>
                          </div>
                          {!selected && (
                            <button
                              onClick={(e) => handleDeleteSavedFace(face, e)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Icon icon="solar:trash-bin-trash-bold" width={12} />
                            </button>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "examples" && (
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
                      <img src={char.src} alt={`Character ${char.id}`} className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === "upload" && (
              <div
                className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
                  isDragging ? "border-purple-500 bg-purple-500/10" : "border-border-base hover:border-purple-500/50"
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
            )}
          </>
        )}

        {!canAddMore && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <Icon icon="solar:info-circle-bold" className="text-amber-400" width={18} />
            <span className="text-sm text-amber-400">Maximum {maxSelections} faces reached</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
