"use client";

import React, { useEffect, useState } from "react";
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
import { useUsageStatsRefresh } from "@/contexts/UsageStatsContext";

export default function MyClipsPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const [clips, setClips] = useState<Clip[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderClips, setFolderClips] = useState<Record<number, Clip[]>>({});
  const [isLoadingClips, setIsLoadingClips] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [draggedClipId, setDraggedClipId] = useState<number | null>(null);
  const { triggerRefresh } = useUsageStatsRefresh();

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
      loadClips();
      loadFolders();
    }
  }, [selectedTeam?.id]);

  const loadClips = async () => {
    if (!selectedTeam?.id) return;

    setIsLoadingClips(true);
    try {
      const fetchedClips = await clipsAPI.getClips(selectedTeam.id);
      setClips(fetchedClips);

      // Group clips by folder_id
      const groupedClips: Record<number, Clip[]> = {};
      fetchedClips.forEach(clip => {
        if (clip.folder_id) {
          if (!groupedClips[clip.folder_id]) {
            groupedClips[clip.folder_id] = [];
          }
          groupedClips[clip.folder_id].push(clip);
        }
      });
      setFolderClips(groupedClips);
    } catch (error) {
      console.error("Failed to load clips:", error);
    } finally {
      setIsLoadingClips(false);
    }
  };

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
      await loadClips();
      // Trigger usage stats refresh after deleting clip
      triggerRefresh();
    } catch (error) {
      console.error("Failed to delete clip:", error);
    }
  };

  const handleDragStart = (e: React.DragEvent, clipId: number) => {
    e.dataTransfer.setData("clipId", clipId.toString());
    e.dataTransfer.effectAllowed = "move";
    setDraggedClipId(clipId);
  };

  const handleDrop = async (folderId: number, clipId: number) => {
    if (!selectedTeam?.id) return;

    try {
      await clipsAPI.updateClip(selectedTeam.id, clipId, { folderId });
      await loadClips();
    } catch (error) {
      console.error("Failed to move clip to folder:", error);
    } finally {
      setDraggedClipId(null);
    }
  };

  const handleDropToUnorganized = async (e: React.DragEvent) => {
    e.preventDefault();
    const clipId = e.dataTransfer.getData("clipId");

    if (!clipId || !selectedTeam?.id) return;

    try {
      await clipsAPI.updateClip(selectedTeam.id, parseInt(clipId), { folderId: null });
      await loadClips();
    } catch (error) {
      console.error("Failed to move clip to unorganized:", error);
    } finally {
      setDraggedClipId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const unorganizedClips = clips.filter(clip => !clip.folder_id);

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
        {/* Header */}
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

        {/* Folders */}
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
                  clips={folderClips[folder.id] || []}
                  onDelete={handleDeleteFolder}
                  onDrop={handleDrop}
                  onClipDelete={handleDeleteClip}
                  draggedClipId={draggedClipId}
                  onClipDragStart={handleDragStart}
                  onClipDragEnd={() => setDraggedClipId(null)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Unorganized Clips */}
        <div
          onDrop={handleDropToUnorganized}
          onDragOver={handleDragOver}
          className="min-h-[200px]"
        >
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Icon icon="solar:video-library-bold-duotone" className="text-2xl text-accent-400" />
            Unorganized Clips {unorganizedClips.length > 0 && `(${unorganizedClips.length})`}
          </h2>
          {isLoadingClips ? (
            <div className="flex items-center justify-center py-12">
              <Icon
                icon="solar:loading-circle-bold"
                className="text-4xl animate-spin text-accent-400"
              />
            </div>
          ) : unorganizedClips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unorganizedClips.map((clip) => (
                <div
                  key={clip.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, clip.id)}
                  onDragEnd={() => setDraggedClipId(null)}
                >
                  <ClipCard
                    clip={clip}
                    onDelete={handleDeleteClip}
                    isDragging={draggedClipId === clip.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Card className="bg-surface-base border border-border-base">
              <CardBody className="flex flex-col items-center justify-center py-16">
                <Icon
                  icon="solar:video-frame-play-vertical-bold-duotone"
                  className="text-6xl text-text-tertiary mb-4"
                />
                <p className="text-text-secondary text-center mb-2 text-lg">
                  No clips yet
                </p>
                <p className="text-text-tertiary text-center text-sm max-w-md">
                  Start by uploading a video and generating your first clip
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreate={handleCreateFolder}
      />
    </div>
  );
}

