"use client";

import { useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { addToast } from "@heroui/react";
import { selectedTeamAtom } from "@/store/auth";
import {
  pendingClipsAtom,
  unsavedClipsAtom,
  savedClipsAtom,
  foldersAtom,
  folderTreeAtom,
  selectedFolderIdAtom,
  folderPathAtom,
  tagsAtom,
  isLoadingClipsAtom,
  isLoadingMoreAtom,
  isLoadingFoldersAtom,
  hasMoreClipsAtom,
  clipsOffsetAtom,
  draggedClipIdAtom,
  selectedClipAtom,
  isViewModalOpenAtom,
  isPreviewModalOpenAtom,
  selectedPreviewClipAtom,
  isSavingPreviewClipAtom,
  isDeleteModalOpenAtom,
  clipToDeleteAtom,
  isDeletingClipAtom,
} from "@/store/clips";
import { clipsAPI, FolderTreeNode } from "@/api/clips";

const CLIPS_PER_PAGE = 12;

export function useClipsData() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [pendingClips, setPendingClips] = useAtom(pendingClipsAtom);
  const [unsavedClips, setUnsavedClips] = useAtom(unsavedClipsAtom);
  const [savedClips, setSavedClips] = useAtom(savedClipsAtom);
  const [isLoadingClips, setIsLoadingClips] = useAtom(isLoadingClipsAtom);
  const [isLoadingMore, setIsLoadingMore] = useAtom(isLoadingMoreAtom);
  const [hasMore, setHasMore] = useAtom(hasMoreClipsAtom);
  const [offset, setOffset] = useAtom(clipsOffsetAtom);
  const selectedFolderId = useAtomValue(selectedFolderIdAtom);
  const isDraggingRef = useRef(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useAtom(isDeleteModalOpenAtom);
  const [clipToDelete, setClipToDelete] = useAtom(clipToDeleteAtom);
  const [isDeleting, setIsDeleting] = useAtom(isDeletingClipAtom);
  const triggerRefreshRef = useRef<(() => void) | null>(null);
  const recentlyDeletedRef = useRef<Set<number>>(new Set());

  const loadPendingClips = useCallback(async () => {
    if (!selectedTeam?.id) return;
    try {
      const clips = await clipsAPI.getPendingClips(selectedTeam.id);
      setPendingClips(clips);
    } catch (error) {
      console.error("Failed to load pending clips:", error);
    }
  }, [selectedTeam?.id, setPendingClips]);

  const loadUnsavedClips = useCallback(async () => {
    if (!selectedTeam?.id) return;
    try {
      const clips = await clipsAPI.getUnsavedClips(selectedTeam.id);
      setUnsavedClips(clips);
    } catch (error) {
      console.error("Failed to load unsaved clips:", error);
    }
  }, [selectedTeam?.id, setUnsavedClips]);

  const loadSavedClips = useCallback(
    async (reset: boolean = false) => {
      if (!selectedTeam?.id) return;

      const currentOffset = reset ? 0 : offset;

      if (reset) {
        setIsLoadingClips(true);
        setOffset(0);
      }

      try {
        const { clips, hasMore: moreAvailable } = await clipsAPI.getSavedClips(
          selectedTeam.id,
          CLIPS_PER_PAGE,
          currentOffset
        );

        if (reset || currentOffset === 0) {
          setSavedClips(clips);
        } else {
          setSavedClips((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newClips = clips.filter((c) => !existingIds.has(c.id));
            return [...prev, ...newClips];
          });
        }

        setHasMore(moreAvailable);
      } catch (error) {
        console.error("Failed to load saved clips:", error);
      } finally {
        setIsLoadingClips(false);
      }
    },
    [selectedTeam?.id, offset, setIsLoadingClips, setOffset, setSavedClips, setHasMore]
  );

  const loadMoreClips = useCallback(async () => {
    if (!selectedTeam?.id || isLoadingMore || !hasMore || isDraggingRef.current) return;

    setIsLoadingMore(true);
    const newOffset = offset + CLIPS_PER_PAGE;

    try {
      const { clips, hasMore: moreAvailable } = await clipsAPI.getSavedClips(
        selectedTeam.id,
        CLIPS_PER_PAGE,
        newOffset
      );

      setSavedClips((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newClips = clips.filter((c) => !existingIds.has(c.id));
        return [...prev, ...newClips];
      });

      setOffset(newOffset);
      setHasMore(moreAvailable);
    } catch (error) {
      console.error("Failed to load more clips:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedTeam?.id, isLoadingMore, hasMore, offset, setIsLoadingMore, setSavedClips, setOffset, setHasMore]);

  const requestDeleteClip = useCallback(
    (clipId: number, clipName: string | undefined, triggerRefresh: () => void) => {
      setClipToDelete({ id: clipId, name: clipName });
      triggerRefreshRef.current = triggerRefresh;
      setIsDeleteModalOpen(true);
    },
    [setClipToDelete, setIsDeleteModalOpen]
  );

  const confirmDeleteClip = useCallback(async () => {
    if (!selectedTeam?.id || !clipToDelete) return;

    setIsDeleting(true);
    try {
      await clipsAPI.deleteClip(selectedTeam.id, clipToDelete.id);
      recentlyDeletedRef.current.add(clipToDelete.id);
      setTimeout(() => recentlyDeletedRef.current.delete(clipToDelete.id), 10_000);
      setPendingClips((prev) => prev.filter((c) => c.id !== clipToDelete.id));
      setUnsavedClips((prev) => prev.filter((c) => c.id !== clipToDelete.id));
      setSavedClips((prev) => prev.filter((c) => c.id !== clipToDelete.id));

      if (triggerRefreshRef.current) {
        triggerRefreshRef.current();
      }

      setIsDeleteModalOpen(false);
      setClipToDelete(null);
    } catch (error) {
      console.error("Failed to delete clip:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedTeam?.id, clipToDelete, setPendingClips, setUnsavedClips, setSavedClips, setIsDeleting, setIsDeleteModalOpen, setClipToDelete]);

  const cancelDeleteClip = useCallback(() => {
    setIsDeleteModalOpen(false);
    setClipToDelete(null);
    triggerRefreshRef.current = null;
  }, [setIsDeleteModalOpen, setClipToDelete]);

  const saveClip = useCallback(
    async (clipId: number, triggerRefresh: () => void) => {
      if (!selectedTeam?.id) return;

      try {
        await clipsAPI.saveClip(selectedTeam.id, clipId);
        setUnsavedClips((prev) => prev.filter((c) => c.id !== clipId));
        await loadSavedClips(true);
        triggerRefresh();
      } catch (error) {
        console.error("Failed to save clip:", error);
      }
    },
    [selectedTeam?.id, setUnsavedClips, loadSavedClips]
  );

  const rejectClip = useCallback(
    async (clipId: number) => {
      if (!selectedTeam?.id) return;

      try {
        await clipsAPI.rejectClip(selectedTeam.id, clipId);
        setUnsavedClips((prev) => prev.filter((c) => c.id !== clipId));
      } catch (error) {
        console.error("Failed to reject clip:", error);
      }
    },
    [selectedTeam?.id, setUnsavedClips]
  );

  // Merge-based refresh: fetches the first page and merges new/updated clips
  // into the existing list without resetting scroll position
  const refreshSavedClips = useCallback(async () => {
    if (!selectedTeam?.id) return;

    try {
      const { clips: freshClips } = await clipsAPI.getSavedClips(
        selectedTeam.id,
        CLIPS_PER_PAGE,
        0
      );

      setSavedClips((prev) => {
        // Filter out recently deleted clips so they don't get re-added
        const deleted = recentlyDeletedRef.current;
        const filtered = freshClips.filter((c) => !deleted.has(c.id));

        // Build new array: fresh clips first (preserving server order), then remaining existing
        const freshIds = new Set(filtered.map((c) => c.id));
        const remaining = prev.filter((c) => !freshIds.has(c.id) && !deleted.has(c.id));
        return [...filtered, ...remaining];
      });
    } catch (error) {
      console.error("Failed to refresh saved clips:", error);
    }
  }, [selectedTeam?.id, setSavedClips]);

  const moveClipToFolder = useCallback(
    async (clipId: number, folderId: number | null) => {
      if (!selectedTeam?.id) return;

      try {
        await clipsAPI.updateClip(selectedTeam.id, clipId, { folderId });
        // Just remove the clip from current view - no full reload needed
        // If we're in "All Clips" and moving to a folder, or in a folder and moving elsewhere
        if (selectedFolderId !== folderId) {
          setSavedClips((prev) => prev.filter((c) => c.id !== clipId));
        }
        addToast({
          title: "Clip moved",
          description: folderId ? "Clip moved to folder" : "Clip moved to root",
          color: "success",
        });
      } catch (error: any) {
        console.error("Failed to move clip:", error);
        const errorMessage = error?.message || "Failed to move clip to folder";
        addToast({
          title: "Failed to move clip",
          description: errorMessage,
          color: "danger",
        });
      }
    },
    [selectedTeam?.id, selectedFolderId, setSavedClips]
  );

  return {
    pendingClips,
    unsavedClips,
    savedClips,
    isLoadingClips,
    isLoadingMore,
    hasMore,
    isDraggingRef,
    loadPendingClips,
    loadUnsavedClips,
    loadSavedClips,
    loadMoreClips,
    requestDeleteClip,
    confirmDeleteClip,
    cancelDeleteClip,
    isDeleteModalOpen,
    clipToDelete,
    isDeleting,
    saveClip,
    rejectClip,
    moveClipToFolder,
    refreshSavedClips,
    setSavedClips,
    setUnsavedClips,
  };
}

export function useFolders() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [folders, setFolders] = useAtom(foldersAtom);
  const [folderTree, setFolderTree] = useAtom(folderTreeAtom);
  const [selectedFolderId, setSelectedFolderId] = useAtom(selectedFolderIdAtom);
  const [folderPath, setFolderPath] = useAtom(folderPathAtom);
  const [isLoadingFolders, setIsLoadingFolders] = useAtom(isLoadingFoldersAtom);
  const setSavedClips = useSetAtom(savedClipsAtom);
  const setIsLoadingClips = useSetAtom(isLoadingClipsAtom);
  const setHasMore = useSetAtom(hasMoreClipsAtom);

  const loadFolders = useCallback(async () => {
    if (!selectedTeam?.id) return;

    setIsLoadingFolders(true);
    try {
      const [fetchedFolders, fetchedTree] = await Promise.all([
        clipsAPI.getFolders(selectedTeam.id),
        clipsAPI.getFolderTree(selectedTeam.id),
      ]);
      setFolders(fetchedFolders);
      setFolderTree(fetchedTree);
    } catch (error) {
      console.error("Failed to load folders:", error);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [selectedTeam?.id, setIsLoadingFolders, setFolders, setFolderTree]);

  const loadFolderPath = useCallback(
    async (folderId: number | null) => {
      if (!selectedTeam?.id || folderId === null) {
        setFolderPath([]);
        return;
      }

      try {
        const path = await clipsAPI.getFolderPath(selectedTeam.id, folderId);
        setFolderPath(path);
      } catch (error) {
        console.error("Failed to load folder path:", error);
        setFolderPath([]);
      }
    },
    [selectedTeam?.id, setFolderPath]
  );

  const selectFolder = useCallback(
    async (folderId: number | null, loadSavedClips: (reset: boolean) => Promise<void>) => {
      setSelectedFolderId(folderId);
      setSavedClips([]); // Clear clips immediately to prevent flash of old content
      setIsLoadingClips(true);
      await loadFolderPath(folderId);

      if (folderId !== null && selectedTeam?.id) {
        try {
          const clips = await clipsAPI.getClipsByFolder(selectedTeam.id, folderId);
          setSavedClips(clips);
          setHasMore(false);
        } catch (error) {
          console.error("Failed to load folder clips:", error);
        } finally {
          setIsLoadingClips(false);
        }
      } else {
        await loadSavedClips(true);
      }
    },
    [selectedTeam?.id, setSelectedFolderId, loadFolderPath, setIsLoadingClips, setSavedClips, setHasMore]
  );

  const createFolder = useCallback(
    async (data: { name: string; color?: string; message?: string; parentFolderId?: number | null }) => {
      if (!selectedTeam?.id) return;

      try {
        await clipsAPI.createFolder(selectedTeam.id, data);
        await loadFolders();
        addToast({
          title: "Folder created",
          description: `Folder "${data.name}" created successfully`,
          color: "success",
        });
      } catch (error: any) {
        console.error("Failed to create folder:", error);
        addToast({
          title: "Failed to create folder",
          description: error?.message || "Failed to create folder",
          color: "danger",
        });
        throw error;
      }
    },
    [selectedTeam?.id, loadFolders]
  );

  const moveFolder = useCallback(
    async (folderId: number, parentFolderId: number | null) => {
      if (!selectedTeam?.id) return;

      try {
        await clipsAPI.moveFolder(selectedTeam.id, folderId, parentFolderId);
        await loadFolders();
      } catch (error) {
        console.error("Failed to move folder:", error);
      }
    },
    [selectedTeam?.id, loadFolders]
  );

  const deleteFolder = useCallback(
    async (folderId: number) => {
      if (!selectedTeam?.id) return;
      if (!confirm("Are you sure you want to delete this folder?")) return;

      try {
        await clipsAPI.deleteFolder(selectedTeam.id, folderId);
        await loadFolders();
      } catch (error) {
        console.error("Failed to delete folder:", error);
      }
    },
    [selectedTeam?.id, loadFolders]
  );

  const getParentFolderName = useCallback(
    (parentId: number | null): string | undefined => {
      if (parentId === null) return undefined;

      const findFolder = (nodes: FolderTreeNode[]): FolderTreeNode | undefined => {
        for (const node of nodes) {
          if (node.id === parentId) return node;
          const found = findFolder(node.children);
          if (found) return found;
        }
        return undefined;
      };

      return findFolder(folderTree)?.name;
    },
    [folderTree]
  );

  const resetFolderState = useCallback(() => {
    setSelectedFolderId(null);
    setFolderPath([]);
  }, [setSelectedFolderId, setFolderPath]);

  const refreshFolderClips = useCallback(async (folderId: number) => {
    if (!selectedTeam?.id) return;
    try {
      const clips = await clipsAPI.getClipsByFolder(selectedTeam.id, folderId);
      setSavedClips(clips);
    } catch (error) {
      console.error("Failed to refresh folder clips:", error);
    }
  }, [selectedTeam?.id, setSavedClips]);

  return {
    folders,
    folderTree,
    selectedFolderId,
    folderPath,
    isLoadingFolders,
    loadFolders,
    loadFolderPath,
    selectFolder,
    createFolder,
    moveFolder,
    deleteFolder,
    getParentFolderName,
    resetFolderState,
    refreshFolderClips,
  };
}

export function useTags() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [tags, setTags] = useAtom(tagsAtom);
  const setSavedClips = useSetAtom(savedClipsAtom);
  const [selectedClip, setSelectedClip] = useAtom(selectedClipAtom);

  const loadTags = useCallback(async () => {
    if (!selectedTeam?.id) return;

    try {
      const fetchedTags = await clipsAPI.getTags(selectedTeam.id);
      setTags(fetchedTags);
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  }, [selectedTeam?.id, setTags]);

  const createTag = useCallback(
    async (name: string, color: string) => {
      if (!selectedTeam?.id) throw new Error("No team selected");

      const newTag = await clipsAPI.createTag(selectedTeam.id, { name, color });
      setTags((prev) => [newTag, ...prev]);
      return newTag;
    },
    [selectedTeam?.id, setTags]
  );

  const deleteTag = useCallback(
    async (tagId: number) => {
      if (!selectedTeam?.id) throw new Error("No team selected");

      await clipsAPI.deleteTag(selectedTeam.id, tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));

      setSavedClips((prev) =>
        prev.map((c) => ({
          ...c,
          tags: c.tags?.filter((t) => t.id !== tagId),
        }))
      );
    },
    [selectedTeam?.id, setTags, setSavedClips]
  );

  const updateClipTags = useCallback(
    async (clipId: number, tagIds: number[]) => {
      try {
        const updatedTags = await clipsAPI.setClipTags(clipId, tagIds);

        setSavedClips((prev) =>
          prev.map((c) => (c.id === clipId ? { ...c, tags: updatedTags } : c))
        );

        if (selectedClip?.id === clipId) {
          setSelectedClip((prev) => (prev ? { ...prev, tags: updatedTags } : prev));
        }
      } catch (error) {
        console.error("Failed to update clip tags:", error);
      }
    },
    [setSavedClips, selectedClip?.id, setSelectedClip]
  );

  return {
    tags,
    loadTags,
    createTag,
    deleteTag,
    updateClipTags,
  };
}

export function useDragAndDrop() {
  const [draggedClipId, setDraggedClipId] = useAtom(draggedClipIdAtom);
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const setSavedClips = useSetAtom(savedClipsAtom);
  const isDraggingRef = useRef(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent, clipId: number) => {
      isDraggingRef.current = true;
      e.dataTransfer.setData("clipId", clipId.toString());
      e.dataTransfer.effectAllowed = "move";
      setDraggedClipId(clipId);
    },
    [setDraggedClipId]
  );

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    setDraggedClipId(null);
  }, [setDraggedClipId]);

  const handleDropToSaved = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const clipIdStr = e.dataTransfer.getData("clipId");

      if (!clipIdStr || !selectedTeam?.id) return;

      const clipId = parseInt(clipIdStr);

      try {
        const updatedClip = await clipsAPI.updateClip(selectedTeam.id, clipId, {
          folderId: null,
        });
        setSavedClips((prev) => {
          if (prev.some((c) => c.id === clipId)) return prev;
          return [updatedClip, ...prev];
        });
      } catch (error) {
        console.error("Failed to move clip to saved:", error);
      }
    },
    [selectedTeam?.id, setSavedClips]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  return {
    draggedClipId,
    isDraggingRef,
    handleDragStart,
    handleDragEnd,
    handleDropToSaved,
    handleDragOver,
  };
}

export function useClipModals() {
  const [isViewModalOpen, setIsViewModalOpen] = useAtom(isViewModalOpenAtom);
  const [selectedClip, setSelectedClip] = useAtom(selectedClipAtom);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useAtom(isPreviewModalOpenAtom);
  const [selectedPreviewClip, setSelectedPreviewClip] = useAtom(selectedPreviewClipAtom);
  const [isSavingPreviewClip, setIsSavingPreviewClip] = useAtom(isSavingPreviewClipAtom);

  const openViewModal = useCallback(
    (clip: any) => {
      setSelectedClip(clip);
      setIsViewModalOpen(true);
    },
    [setSelectedClip, setIsViewModalOpen]
  );

  const closeViewModal = useCallback(() => {
    setIsViewModalOpen(false);
    setSelectedClip(null);
  }, [setIsViewModalOpen, setSelectedClip]);

  const openPreviewModal = useCallback(
    (clip: any) => {
      setSelectedPreviewClip(clip);
      setIsPreviewModalOpen(true);
    },
    [setSelectedPreviewClip, setIsPreviewModalOpen]
  );

  const closePreviewModal = useCallback(() => {
    setIsPreviewModalOpen(false);
    setSelectedPreviewClip(null);
  }, [setIsPreviewModalOpen, setSelectedPreviewClip]);

  return {
    isViewModalOpen,
    selectedClip,
    isPreviewModalOpen,
    selectedPreviewClip,
    isSavingPreviewClip,
    setIsSavingPreviewClip,
    openViewModal,
    closeViewModal,
    openPreviewModal,
    closePreviewModal,
  };
}
