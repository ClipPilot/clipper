"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
  toast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { campaignAPI, type CampaignVideo } from "@/api/campaign";
import { clipsAPI, type Clip, type Folder } from "@/api/clips";

export interface ClipPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  campaignId: number;
  existingClipIds: Set<number>;
  onAdded: (videos: CampaignVideo[]) => void;
}

export function ClipPickerModal({
  isOpen,
  onClose,
  teamId,
  campaignId,
  existingClipIds,
  onAdded,
}: ClipPickerModalProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const BATCH_SIZE = 40;

  // Load folders once
  useEffect(() => {
    if (!isOpen) return;
    clipsAPI.getFolders(teamId).then(setFolders).catch(() => {});
  }, [isOpen, teamId]);

  // Load clips (all saved or by folder)
  const loadClips = useCallback(
    async (folderId: number | null, reset: boolean) => {
      setIsLoading(true);
      try {
        if (folderId !== null) {
          const folderClips = await clipsAPI.getClipsByFolder(teamId, folderId);
          setClips(folderClips);
          setHasMore(false);
          setOffset(folderClips.length);
        } else {
          const newOffset = reset ? 0 : offset;
          const { clips: batch, hasMore: more } = await clipsAPI.getSavedClips(
            teamId,
            BATCH_SIZE,
            newOffset,
          );
          if (reset) {
            setClips(batch);
          } else {
            setClips((prev) => [...prev, ...batch]);
          }
          setHasMore(more);
          setOffset(newOffset + batch.length);
        }
      } catch {
        toast.danger("Failed to load clips", { description: "Could not load your clip library." });
      } finally {
        setIsLoading(false);
      }
    },
    [teamId, offset],
  );

  // Initial load when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setActiveFolderId(null);
      setOffset(0);
      return;
    }
    loadClips(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleFolderClick = (folderId: number | null) => {
    setActiveFolderId(folderId);
    setOffset(0);
    loadClips(folderId, true);
  };

  const toggleClip = (clipId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const available = clips.filter((c) => !existingClipIds.has(c.id));
    setSelectedIds(new Set(available.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setIsAdding(true);
    try {
      const result = await campaignAPI.addVideos(teamId, campaignId, Array.from(selectedIds));
      toast.success("Clips added", { description: `${selectedIds.size} clip${selectedIds.size !== 1 ? "s" : ""} added to campaign.` });
      onAdded(result.videos);
      onClose();
    } catch (err: any) {
      toast.danger("Failed to add clips", { description: err.message || "Something went wrong" });
    } finally {
      setIsAdding(false);
    }
  };

  const availableClips = clips.filter((c) => !existingClipIds.has(c.id));
  const allSelected = availableClips.length > 0 && availableClips.every((c) => selectedIds.has(c.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      classNames={{ base: "bg-surface-base border border-border-base" }}
    >
      <ModalContent>
        <ModalHeader className="border-b border-border-base">
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:library-bold-duotone"
              className="text-accent-400"
              width={22}
            />
            <span className="text-text-primary">Add from Library</span>
          </div>
        </ModalHeader>

        <ModalBody className="py-4 gap-4">
          {/* Folder tabs */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={activeFolderId === null ? "solid" : "flat"}
              color={activeFolderId === null ? "primary" : "default"}
              className={activeFolderId === null ? "" : "bg-surface-elevated text-text-secondary"}
              onPress={() => handleFolderClick(null)}
            >
              All Saved
            </Button>
            {folders.map((folder) => (
              <Button
                key={folder.id}
                size="sm"
                variant={activeFolderId === folder.id ? "solid" : "flat"}
                color={activeFolderId === folder.id ? "primary" : "default"}
                className={activeFolderId === folder.id ? "" : "bg-surface-elevated text-text-secondary"}
                onPress={() => handleFolderClick(folder.id)}
                startContent={
                  <Icon icon="solar:folder-bold-duotone" width={14} />
                }
              >
                {folder.name}
              </Button>
            ))}
          </div>

          {/* Select all / deselect */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary">
              {availableClips.length} clip{availableClips.length !== 1 ? "s" : ""} available
              {selectedIds.size > 0 && (
                <span className="text-accent-400 ml-1">
                  ({selectedIds.size} selected)
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="light"
                className="text-text-secondary h-7 text-xs"
                onPress={allSelected ? deselectAll : selectAll}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </div>

          {/* Clip grid */}
          {isLoading && clips.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" color="primary" />
            </div>
          ) : availableClips.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Icon
                icon="solar:video-library-bold-duotone"
                className="text-text-tertiary"
                width={32}
              />
              <p className="text-sm text-text-secondary">
                {clips.length > 0
                  ? "All clips from this view are already in the campaign."
                  : "No saved clips found."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {availableClips.map((clip) => {
                  const isSelected = selectedIds.has(clip.id);
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      onClick={() => toggleClip(clip.id)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                        isSelected
                          ? "border-accent-400 ring-1 ring-accent-400/30"
                          : "border-border-base hover:border-text-tertiary"
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-[9/16] bg-surface-elevated flex items-center justify-center">
                        {clip.clipUrl ? (
                          <video
                            src={clip.clipUrl}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <Icon
                            icon="solar:video-library-bold-duotone"
                            className="text-text-tertiary"
                            width={24}
                          />
                        )}
                      </div>

                      {/* Overlay info */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-[11px] text-white truncate">
                          {clip.title || `Clip #${clip.id}`}
                        </p>
                      </div>

                      {/* Selection checkbox */}
                      <div className="absolute top-2 left-2">
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-accent-400 border-accent-400"
                              : "bg-black/40 border-white/50"
                          }`}
                        >
                          {isSelected && (
                            <Icon icon="solar:check-read-bold" width={12} className="text-white" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Load more */}
              {hasMore && activeFolderId === null && (
                <div className="flex justify-center pt-2">
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-surface-elevated text-text-secondary"
                    onPress={() => loadClips(null, false)}
                    isLoading={isLoading}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </ModalBody>

        <ModalFooter className="border-t border-border-base">
          <Button
            variant="flat"
            className="bg-surface-elevated text-text-secondary"
            onPress={onClose}
            isDisabled={isAdding}
          >
            Cancel
          </Button>
          <Button
            className="bg-accent-400 text-white font-medium"
            onPress={handleAdd}
            isLoading={isAdding}
            isDisabled={selectedIds.size === 0}
            startContent={
              !isAdding && <Icon icon="solar:add-circle-bold" width={18} />
            }
          >
            Add {selectedIds.size > 0 ? `${selectedIds.size} Clip${selectedIds.size !== 1 ? "s" : ""}` : "Selected"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
