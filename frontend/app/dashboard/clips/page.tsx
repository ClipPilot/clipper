"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";
import { clipsAPI, Clip, Folder } from "@/api/clips";
import { ClipCard } from "@/components/clips/ClipCard";
import { ExpandableFolder } from "@/components/clips/ExpandableFolder";
import { CreateFolderModal } from "@/components/clips/CreateFolderModal";
import { ClipsToSaveSection } from "@/components/clips/ClipsToSaveSection";
import { useUsageStatsRefresh } from "@/contexts/UsageStatsContext";
import PendingClipsSection from "@/components/clips/PendingClipsSection";
import NewClipsSection from "@/components/clips/NewClipsSection";
import ClipViewModal from "@/components/clips/ClipViewModal";
import { useSocket } from "@/hooks/useSocket";

const CLIPS_PER_PAGE = 12;

export default function MyClipsPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const [pendingClips, setPendingClips] = useState<Clip[]>([]);
  const [unsavedClips, setUnsavedClips] = useState<Clip[]>([]);
  const [savedClips, setSavedClips] = useState<Clip[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoadingClips, setIsLoadingClips] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [draggedClipId, setDraggedClipId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const { triggerRefresh } = useUsageStatsRefresh();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [movedClipIds, setMovedClipIds] = useState<number[]>([]);

  const loadPendingClips = useCallback(async () => {
    if (!selectedTeam?.id) return;
    try {
      const clips = await clipsAPI.getPendingClips(selectedTeam.id);
      setPendingClips(clips);
    } catch (error) {
      console.error("Failed to load pending clips:", error);
    }
  }, [selectedTeam?.id]);

  const loadUnsavedClips = useCallback(async () => {
    if (!selectedTeam?.id) return;
    try {
      const clips = await clipsAPI.getUnsavedClips(selectedTeam.id);
      setUnsavedClips(clips);
    } catch (error) {
      console.error("Failed to load unsaved clips:", error);
    }
  }, [selectedTeam?.id]);

  const loadSavedClips = useCallback(async (reset: boolean = false) => {
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
        setSavedClips(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newClips = clips.filter(c => !existingIds.has(c.id));
          return [...prev, ...newClips];
        });
      }

      setHasMore(moreAvailable);
    } catch (error) {
      console.error("Failed to load saved clips:", error);
    } finally {
      setIsLoadingClips(false);
    }
  }, [selectedTeam?.id, offset]);

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

      setSavedClips(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newClips = clips.filter(c => !existingIds.has(c.id));
        return [...prev, ...newClips];
      });

      setOffset(newOffset);
      setHasMore(moreAvailable);
    } catch (error) {
      console.error("Failed to load more clips:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedTeam?.id, isLoadingMore, hasMore, offset]);

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoadingClips && !isDraggingRef.current) {
          loadMoreClips();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentRef);

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoadingClips, loadMoreClips]);

  const handleSocketUpdate = useCallback(() => {
    if (isDraggingRef.current) return;
    loadPendingClips();
    loadUnsavedClips();
    loadSavedClips(true);
  }, [loadPendingClips, loadUnsavedClips, loadSavedClips]);

  useSocket(selectedTeam?.id, handleSocketUpdate);

  useEffect(() => {
    if (!user) {
      const accessToken =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;
      if (!accessToken) {
        router.push("/auth");
        return;
      }
      authAPI
        .getMe()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          router.push("/auth");
        });
    }
  }, [user, router, setUser]);

  useEffect(() => {
    if (selectedTeam?.id) {
      loadPendingClips();
      loadUnsavedClips();
      loadSavedClips(true);
      loadFolders();
    }
  }, [selectedTeam?.id]);

  const loadFolders = async () => {
    if (!selectedTeam?.id) return;

    setIsLoadingFolders(true);
    try {
      const fetchedFolders = await clipsAPI.getFolders(selectedTeam.id);
      setFolders(fetchedFolders);
    } catch (error) {
      console.error("Failed to load folders:", error);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleCreateFolder = async (data: {
    name: string;
    color?: string;
    message?: string;
  }) => {
    if (!selectedTeam?.id) return;

    try {
      await clipsAPI.createFolder(selectedTeam.id, data);
      await loadFolders();
    } catch (error) {
      console.error("Failed to create folder:", error);
      throw error;
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    if (!selectedTeam?.id) return;
    if (!confirm("Are you sure you want to delete this folder?")) return;

    try {
      await clipsAPI.deleteFolder(selectedTeam.id, folderId);
      await loadFolders();
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  };

  const handleDeleteClip = async (clipId: number) => {
    if (!selectedTeam?.id) return;
    if (!confirm("Are you sure you want to delete this clip?")) return;

    try {
      await clipsAPI.deleteClip(selectedTeam.id, clipId);
      setPendingClips(prev => prev.filter(c => c.id !== clipId));
      setUnsavedClips(prev => prev.filter(c => c.id !== clipId));
      setSavedClips(prev => prev.filter(c => c.id !== clipId));
      triggerRefresh();
    } catch (error) {
      console.error("Failed to delete clip:", error);
    }
  };

  const handleClipSaved = (clipId: number) => {
    setUnsavedClips(prev => prev.filter(c => c.id !== clipId));
    loadSavedClips(true);
  };

  const handleRejectClip = async (clipId: number) => {
    if (!selectedTeam?.id) return;

    try {
      await clipsAPI.deleteClip(selectedTeam.id, clipId);
      setUnsavedClips(prev => prev.filter(c => c.id !== clipId));
    } catch (error) {
      console.error("Failed to reject clip:", error);
    }
  };

  const handleDragStart = (e: React.DragEvent, clipId: number) => {
    isDraggingRef.current = true;
    e.dataTransfer.setData("clipId", clipId.toString());
    e.dataTransfer.effectAllowed = "move";
    setDraggedClipId(clipId);
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    setDraggedClipId(null);
  };

  const handleDrop = async (folderId: number, clipId: number) => {
    if (!selectedTeam?.id) return;

    try {
      await clipsAPI.updateClip(selectedTeam.id, clipId, { folderId });
      setSavedClips(prev => prev.filter(c => c.id !== clipId));
      setMovedClipIds(prev => [...prev, clipId]);
    } catch (error) {
      console.error("Failed to move clip to folder:", error);
    }
  };

  const handleDropToSaved = async (e: React.DragEvent) => {
    e.preventDefault();
    const clipIdStr = e.dataTransfer.getData("clipId");

    if (!clipIdStr || !selectedTeam?.id) return;

    const clipId = parseInt(clipIdStr);

    try {
      const updatedClip = await clipsAPI.updateClip(selectedTeam.id, clipId, { folderId: null });
      setSavedClips(prev => {
        if (prev.some(c => c.id === clipId)) return prev;
        return [updatedClip, ...prev];
      });
    } catch (error) {
      console.error("Failed to move clip to saved:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleViewClip = (clip: Clip) => {
    setSelectedClip(clip);
    setIsViewModalOpen(true);
  };

  const handleEditClip = (clip: Clip) => {
    router.push(`/dashboard/clips/${clip.id}/edit`);
  };

  const handleMoveClip = async (clipId: number, folderId: number | null) => {
    if (!selectedTeam?.id) return;

    try {
      const updatedClip = await clipsAPI.updateClip(selectedTeam.id, clipId, { folderId });

      if (folderId === null) {
        setSavedClips(prev => {
          if (prev.some(c => c.id === clipId)) return prev;
          return [updatedClip, ...prev];
        });
      } else {
        setSavedClips(prev => prev.filter(c => c.id !== clipId));
        setMovedClipIds(prev => [...prev, clipId]);
      }

      setIsViewModalOpen(false);
      setSelectedClip(null);
    } catch (error) {
      console.error("Failed to move clip:", error);
    }
  };

  const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

  const newClips = savedClips.filter(clip =>
    new Date(clip.created_at) > twentyMinutesAgo
  );

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-dark">
        <div className="flex flex-col items-center gap-4">
          <Icon
            icon="solar:loading-circle-bold"
            className="text-4xl animate-spin text-accent-400"
          />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              My Clips
            </h1>
            <p className="text-text-secondary">
              Organize your video clips into folders
            </p>
          </div>
          <Button
            onClick={() => setIsCreateFolderOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-400 text-white rounded-lg hover:bg-accent-500 transition-colors"
          >
            <Icon icon="solar:add-circle-bold" className="text-xl" />
            <span>New Folder</span>
          </Button>
        </div>

        {isLoadingFolders ? (
          <div className="flex items-center justify-center py-12">
            <Icon
              icon="solar:loading-circle-bold"
              className="text-4xl animate-spin text-accent-400"
            />
          </div>
        ) : folders.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <Icon icon="solar:folder-bold-duotone" className="text-2xl text-accent-400" />
              Folders
            </h2>
            <div className="bg-surface-base border border-border-base rounded-lg p-2">
              {folders.map((folder) => (
                <ExpandableFolder
                  key={folder.id}
                  folder={folder}
                  teamId={selectedTeam!.id}
                  movedClipIds={movedClipIds}
                  onDelete={handleDeleteFolder}
                  onDrop={handleDrop}
                  onClipDelete={handleDeleteClip}
                  onClipView={handleViewClip}
                  onClipEdit={handleEditClip}
                  draggedClipId={draggedClipId}
                  onClipDragStart={handleDragStart}
                  onClipDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </div>
        ) : null}

        <PendingClipsSection
          clips={pendingClips}
          onClipClick={(clip: any) => handleViewClip(clip)}
        />

        <ClipsToSaveSection
          clips={unsavedClips}
          teamId={selectedTeam!.id}
          onClipSaved={handleClipSaved}
          onClipRejected={handleRejectClip}
          onUsageUpdated={triggerRefresh}
        />

        <NewClipsSection
          clips={newClips}
          onDelete={handleDeleteClip}
          onClipClick={(clip: any) => handleViewClip(clip)}
          onEditClick={(clip: any) => handleEditClip(clip)}
          draggedClipId={draggedClipId}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />

        <div
          onDrop={handleDropToSaved}
          onDragOver={handleDragOver}
          className="min-h-[200px]"
        >
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Icon icon="solar:video-library-bold-duotone" className="text-2xl text-accent-400" />
            Saved Clips
          </h2>
          {isLoadingClips ? (
            <div className="flex items-center justify-center py-12">
              <Icon
                icon="solar:loading-circle-bold"
                className="text-4xl animate-spin text-accent-400"
              />
            </div>
          ) : savedClips.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedClips.map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    onDelete={handleDeleteClip}
                    onView={() => handleViewClip(clip)}
                    onEdit={() => handleEditClip(clip)}
                    isDragging={draggedClipId === clip.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>

              <div ref={loadMoreRef} className="flex justify-center py-8">
                {isLoadingMore && (
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Icon
                      icon="solar:loading-circle-bold"
                      className="text-2xl animate-spin text-accent-400"
                    />
                    <span>Loading more clips...</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Card className="bg-surface-base border border-border-base">
              <CardBody className="flex flex-col items-center justify-center py-16">
                <Icon
                  icon="solar:video-frame-play-vertical-bold-duotone"
                  className="text-6xl text-text-tertiary mb-4"
                />
                <p className="text-text-secondary text-center mb-2 text-lg">
                  No saved clips yet
                </p>
                <p className="text-text-tertiary text-center text-sm max-w-md">
                  Generate clips and save the ones you like to see them here
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreate={handleCreateFolder}
      />

      {selectedClip && (
        <ClipViewModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedClip(null);
          }}
          clip={selectedClip}
          folders={folders}
          onMoveToFolder={handleMoveClip}
        />
      )}
    </div>
  );
}
