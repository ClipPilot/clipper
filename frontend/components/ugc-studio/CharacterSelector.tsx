"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button, Card, Input, Tabs, toast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { EXAMPLE_CHARACTERS, SelectedCharacter } from "./types";
import { savedFacesAPI, SavedFace } from "@/api/ugc/savedFaces";
import { voicesConfig, type Voice } from "@/config/voicesConfig";
import { VoiceCard } from "./voice/VoiceCard";
import { VoiceCloneModal } from "./voice/VoiceCloneModal";
import { voiceCloneAPI, type ClonedVoice } from "@/api/voiceClone";

type TabType = "saved" | "examples" | "upload";
type GenderFilter = "all" | "male" | "female";

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

  // Voice sidebar state
  const [voiceSidebarOpen, setVoiceSidebarOpen] = useState(false);
  const [voiceSidebarAnimating, setVoiceSidebarAnimating] = useState(false);
  const [editingVoiceForIndex, setEditingVoiceForIndex] = useState<number | null>(null);
  const [voiceFilter, setVoiceFilter] = useState<GenderFilter>("all");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cloned voices state
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

  const canAddMore = selectedCharacters.length < maxSelections;

  function clonedToVoice(cv: ClonedVoice): Voice {
    return {
      id: cv.voiceId,
      name: cv.name,
      previewFile: cv.previewUrl,
      gender: cv.gender,
      description: "Your cloned voice",
      isCloned: true,
      clonedVoiceDbId: cv.id,
    };
  }

  // Fetch cloned voices on mount
  useEffect(() => {
    if (!teamId) return;
    voiceCloneAPI
      .listClonedVoices(teamId)
      .then((res) => setClonedVoices(res.voices.map(clonedToVoice)))
      .catch((err) => console.error("[CharacterSelector] Failed to load cloned voices:", err));
  }, [teamId]);

  const refreshClonedVoices = useCallback(() => {
    if (!teamId) return;
    voiceCloneAPI
      .listClonedVoices(teamId)
      .then((res) => setClonedVoices(res.voices.map(clonedToVoice)))
      .catch((err) => console.error("[CharacterSelector] Refresh cloned voices failed:", err));
  }, [teamId]);

  const handleDeleteClonedVoice = useCallback(async (voice: Voice) => {
    if (!voice.clonedVoiceDbId) return;
    try {
      await voiceCloneAPI.deleteClonedVoice(voice.clonedVoiceDbId);
      setClonedVoices((prev) => prev.filter((v) => v.id !== voice.id));
      // Clear voice from any character that had it selected
      const updated = selectedCharacters.map((c) =>
        c.voiceId === voice.id ? { ...c, voiceId: undefined, voiceName: undefined } : c
      );
      onCharactersChange(updated);
    } catch (err) {
      console.error("[CharacterSelector] Delete cloned voice failed:", err);
    }
  }, [selectedCharacters, onCharactersChange]);

  const allVoices = [...clonedVoices, ...voicesConfig];
  const filteredVoices =
    voiceFilter === "all"
      ? allVoices
      : allVoices.filter((v) => v.gender === voiceFilter);

  const openVoiceSidebar = useCallback((index: number) => {
    setEditingVoiceForIndex(index);
    setVoiceSidebarOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setVoiceSidebarAnimating(true);
      });
    });
  }, []);

  const closeVoiceSidebar = useCallback(() => {
    setVoiceSidebarAnimating(false);
    setTimeout(() => {
      setVoiceSidebarOpen(false);
      setEditingVoiceForIndex(null);
    }, 300);
  }, []);

  const handleVoiceSelect = useCallback(
    (voice: Voice) => {
      if (editingVoiceForIndex === null) return;
      const updated = [...selectedCharacters];
      const current = updated[editingVoiceForIndex];
      if (current.voiceId === voice.id) {
        updated[editingVoiceForIndex] = { ...current, voiceId: undefined, voiceName: undefined };
      } else {
        updated[editingVoiceForIndex] = { ...current, voiceId: voice.id, voiceName: voice.name };
      }
      onCharactersChange(updated);
      closeVoiceSidebar();
    },
    [editingVoiceForIndex, selectedCharacters, onCharactersChange, closeVoiceSidebar]
  );

  const handleVoicePlayToggle = useCallback(
    (voice: Voice) => {
      if (playingVoiceId === voice.id) {
        audioRef.current?.pause();
        setPlayingVoiceId(null);
        setPlaybackProgress(0);
        return;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = voice.previewFile;
        audioRef.current.load();
        audioRef.current
          .play()
          .then(() => {
            setPlayingVoiceId(voice.id);
            setPlaybackProgress(0);
          })
          .catch(() => setPlayingVoiceId(null));
      }
    },
    [playingVoiceId]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => { setPlayingVoiceId(null); setPlaybackProgress(0); };
    const handleTimeUpdate = () => { if (audio.duration) setPlaybackProgress(audio.currentTime / audio.duration); };
    const handleError = () => { setPlayingVoiceId(null); setPlaybackProgress(0); };
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("error", handleError);
    };
  }, []);

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
      toast.success("Face saved!");
    } catch (err) {
      toast.danger("Failed to save face");
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

  const handleSavedFaceSelect = (face: SavedFace) => {
    if (!canAddMore) return;

    const alreadySelected = selectedCharacters.some(
      (c) => c.type === "saved" && c.savedFaceId === face.id
    );
    if (alreadySelected) return;

    // Use imageKey directly - no need to fetch the image, backend already has it in S3
    const newCharacter: SelectedCharacter = {
      type: "saved",
      src: face.imageUrl,
      savedFaceId: face.id,
      imageKey: face.imageKey,
    };
    onCharactersChange([...selectedCharacters, newCharacter]);
  };

  const handleDeleteSavedFace = async (face: SavedFace, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await savedFacesAPI.delete(face.id);
      setSavedFaces((prev) => prev.filter((f) => f.id !== face.id));
      toast.success("Face deleted");
    } catch {
      toast.danger("Failed to delete");
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
      <Card.Header className="pb-0">
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
            <Button size="sm" variant="tertiary" className="text-text-muted" onPress={handleClearAll}>
              Clear all
            </Button>
          )}
        </div>
      </Card.Header>
      <Card.Content className="pt-4 space-y-4">
        {selectedCharacters.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-text-tertiary">Selected faces</p>
            <div className="grid grid-cols-2 gap-3">
              {selectedCharacters.map((character, index) => (
                <div
                  key={`${character.src}-${index}`}
                  className="flex flex-col gap-1.5"
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-elevated group">
                    <img src={character.src} alt={`Character ${index + 1}`} className="w-full h-full object-cover" />
                    <Button
                      isIconOnly
                      variant="tertiary"
                      size="sm"
                      onPress={() => handleRemoveCharacter(index)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon icon="solar:close-circle-bold" width={14} />
                    </Button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                      <span className="text-[10px] text-white font-medium">
                        {character.type === "uploaded" ? "Custom" : character.type === "saved" ? "Saved" : "Example"}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onPress={() => openVoiceSidebar(index)}
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all border ${
                      character.voiceId
                        ? "border-accent-400/50 bg-accent-400/10 text-accent-400"
                        : "border-border-base bg-surface-elevated text-text-muted hover:border-accent-400/30"
                    }`}
                  >
                    <Icon icon="solar:microphone-3-bold-duotone" width={14} className={character.voiceId ? "text-accent-400" : "text-text-tertiary"} />
                    <span className="truncate flex-1 text-left">
                      {character.voiceName || "Voice"}
                    </span>
                    <Icon icon="solar:alt-arrow-right-linear" width={12} className="text-text-tertiary shrink-0" />
                  </Button>
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
 placeholder="Enter a name..."
 value={saveName}
 onChange={(e) => setSaveName(e.target.value)}
 />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="tertiary" className="flex-1" onPress={handleAddWithoutSaving}>
                Just use once
              </Button>
              <Button
 size="sm"
 className="flex-1 bg-purple-500 text-white"
 onPress={handleSaveAndAdd}
 isPending={isSaving}
 isDisabled={!saveName.trim()}
 >
                Save & Use
              </Button>
              <Button size="sm" variant="tertiary" isIconOnly onPress={handleCancelSave}>
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
                <div
                  onClick={() => setActiveTab("saved")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
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
                </div>
              )}
              <div
                onClick={() => setActiveTab("examples")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "examples"
                    ? "bg-purple-500 text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Icon icon="solar:gallery-bold" width={14} />
                <span className="hidden sm:inline">Examples</span>
              </div>
              <div
                onClick={() => setActiveTab("upload")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "upload"
                    ? "bg-purple-500 text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Icon icon="solar:upload-bold" width={14} />
                <span className="hidden sm:inline">Upload</span>
              </div>
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
                        <div
                          key={face.id}
                          onClick={() => !(loadingCharacterId !== null || selected) && handleSavedFaceSelect(face)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
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
                            <div
                              onClick={(e) => handleDeleteSavedFace(face, e)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <Icon icon="solar:trash-bin-trash-bold" width={12} />
                            </div>
                          )}
                        </div>
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
                    <div
                      key={char.id}
                      onClick={() => !(loadingCharacterId !== null || selected) && handleExampleSelect(String(char.id), char.src)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selected
                          ? "border-green-500 opacity-50 cursor-not-allowed"
                          : loadingCharacterId === String(char.id)
                            ? "border-purple-500 opacity-50"
                            : "border-transparent hover:border-purple-500 hover:scale-105 cursor-pointer"
                      }`}
                    >
                      <img src={char.src} alt={`Character ${char.id}`} className="w-full h-full object-cover" />
                    </div>
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
 variant="tertiary"
 className="bg-purple-500/20 text-purple-500"
 onPress={() => imageInputRef.current?.click()}
 >
                    <Icon icon="solar:folder-open-bold" />
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

        <audio ref={audioRef} className="hidden" preload="none" />

        {/* Voice Selector Sidebar */}
        {voiceSidebarOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
                voiceSidebarAnimating ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeVoiceSidebar}
            />
            <div
              className={`relative w-80 max-w-full h-full bg-surface-base border-l border-border-base shadow-xl flex flex-col transition-transform duration-300 ease-out ${
                voiceSidebarAnimating ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="flex items-center justify-between p-4 border-b border-border-base">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
                    <Icon icon="solar:microphone-3-bold-duotone" className="text-accent-400" width={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">Select Voice</h3>
                    <p className="text-xs text-text-tertiary">
                      {editingVoiceForIndex !== null
                        ? `Character ${editingVoiceForIndex + 1}`
                        : "Choose the AI voice"}
                    </p>
                  </div>
                </div>
                <Button isIconOnly variant="tertiary" size="sm" onPress={closeVoiceSidebar}>
                  <Icon icon="solar:close-circle-bold" className="text-text-muted" width={20} />
                </Button>
              </div>
              {/* Clone button in sidebar */}
              {teamId && (
                <div className="px-4 pt-4">
                  <Button
 size="sm"
 className="bg-purple-500 text-white"
 onPress={() => setIsCloneModalOpen(true)}
 >
                    <Icon icon="solar:microphone-3-bold" width={16} />
                    Clone Your Voice
                  </Button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4">
                <Tabs selectedKey={voiceFilter} onSelectionChange={(key) => setVoiceFilter(key as GenderFilter)}>
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="Voice filter">
                      <Tabs.Tab id="all">All<Tabs.Indicator /></Tabs.Tab>
                      <Tabs.Tab id="male">Male<Tabs.Indicator /></Tabs.Tab>
                      <Tabs.Tab id="female">Female<Tabs.Indicator /></Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                </Tabs>
                <div className="flex flex-col gap-2 mt-4">
                  {filteredVoices.map((voice) => (
                    <VoiceCard
                      key={voice.id}
                      voice={voice}
                      isSelected={
                        editingVoiceForIndex !== null &&
                        selectedCharacters[editingVoiceForIndex]?.voiceId === voice.id
                      }
                      isPlaying={playingVoiceId === voice.id}
                      progress={playingVoiceId === voice.id ? playbackProgress : 0}
                      onSelect={() => handleVoiceSelect(voice)}
                      onPlayToggle={() => handleVoicePlayToggle(voice)}
                      onDelete={voice.isCloned ? () => handleDeleteClonedVoice(voice) : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Voice Clone Modal */}
        {teamId && (
          <VoiceCloneModal
            isOpen={isCloneModalOpen}
            onClose={() => setIsCloneModalOpen(false)}
            teamId={teamId}
            onSuccess={refreshClonedVoices}
          />
        )}
      </Card.Content>
    </Card>
  );
}
