"use client";

import React, { useEffect, useRef, useCallback, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import {
  activeTabAtom,
  isSidebarCollapsedAtom,
  isCreateFolderOpenAtom,
  createFolderParentIdAtom,
  newClipsAtom,
  processingCountAtom,
  isLoadingClipsAtom,
  isLoadingMoreAtom,
  hasMoreClipsAtom,
  selectedFolderIdAtom,
  clipsViewModeAtom,
} from "@/store/clips";
import { Button, Card, CardBody, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";
import { Clip, clipsAPI } from "@/api/clips";
import { ClipCard } from "@/components/clips/ClipCard";
import { SubfolderCard } from "@/components/clips/SubfolderCard";
import { CreateFolderModal } from "@/components/clips/CreateFolderModal";
import { FolderTree } from "@/components/clips/FolderTree";
import { FolderBreadcrumb } from "@/components/clips/FolderBreadcrumb";
import { FolderTreeNode } from "@/api/clips";
import { ClipsToSaveSection } from "@/components/clips/ClipsToSaveSection";
import { useUsageStatsRefresh } from "@/contexts/UsageStatsContext";
import PendingClipsSection from "@/components/clips/PendingClipsSection";
import NewClipsSection from "@/components/clips/NewClipsSection";
import ClipSearch, { ClipSearchHandle } from "@/components/clips/ClipSearch";
import ClipViewModal from "@/components/clips/ClipViewModal";
import PreviewClipViewModal from "@/components/clips/PreviewClipViewModal";
import { useSocket } from "@/hooks/useSocket";
import {
  useClipsData,
  useFolders,
  useTags,
  useDragAndDrop,
  useClipModals,
} from "@/hooks/useClips";

function MyClipsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useAtom(userAtom);
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const { triggerRefresh } = useUsageStatsRefresh();
  const [mounted, setMounted] = useState(false);

  // Ensure hydration consistency - only render dynamic content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useAtom(activeTabAtom);

  // Handle tab query param
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "processing" || tabParam === "library") {
      setActiveTab(tabParam);
    }
  }, [searchParams, setActiveTab]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useAtom(isSidebarCollapsedAtom);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useAtom(isCreateFolderOpenAtom);
  const [createFolderParentId, setCreateFolderParentId] = useAtom(createFolderParentIdAtom);

  const newClips = useAtomValue(newClipsAtom);
  const processingCount = useAtomValue(processingCountAtom);
  const isLoadingClips = useAtomValue(isLoadingClipsAtom);
  const isLoadingMore = useAtomValue(isLoadingMoreAtom);
  const hasMore = useAtomValue(hasMoreClipsAtom);
  const selectedFolderId = useAtomValue(selectedFolderIdAtom);
  const [viewMode, setViewMode] = useAtom(clipsViewModeAtom);

  const {
    pendingClips,
    unsavedClips,
    savedClips,
    isDraggingRef,
    loadPendingClips,
    loadUnsavedClips,
    loadSavedClips,
    loadMoreClips,
    deleteClip,
    saveClip,
    rejectClip,
    moveClipToFolder,
    setUnsavedClips,
  } = useClipsData();

  const {
    folders,
    folderTree,
    folderPath,
    loadFolders,
    selectFolder,
    createFolder,
    moveFolder,
    deleteFolder,
    getParentFolderName,
    resetFolderState,
    refreshFolderClips,
  } = useFolders();

  const { tags, loadTags, createTag, deleteTag, updateClipTags } = useTags();

  // Search state - managed by ClipSearch component via callbacks
  const [searchResults, setSearchResults] = useState<Clip[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPagination, setSearchPagination] = useState({ total: 0, hasMore: false });
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isMobileFolderOpen, setIsMobileFolderOpen] = useState(false);
  const clipSearchRef = useRef<ClipSearchHandle>(null);

  // Callbacks for ClipSearch component
  const handleSearchResults = useCallback((
    results: Clip[],
    searching: boolean,
    pagination: { total: number; hasMore: boolean }
  ) => {
    setSearchResults(results);
    setIsSearching(searching);
    setSearchPagination(pagination);
  }, []);

  const handleSearchModeChange = useCallback((mode: boolean) => {
    setIsSearchMode(mode);
  }, []);

  const {
    handleDropToSaved,
    handleDragOver,
  } = useDragAndDrop();

  const {
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
  } = useClipModals();

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const lastSocketUpdateRef = useRef<number>(0);
  const socketUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSocketUpdate = useCallback(() => {
    if (isDraggingRef.current) return;

    const now = Date.now();
    if (now - lastSocketUpdateRef.current < 2000) return;

    if (socketUpdateTimeoutRef.current) {
      clearTimeout(socketUpdateTimeoutRef.current);
    }

    socketUpdateTimeoutRef.current = setTimeout(() => {
      lastSocketUpdateRef.current = Date.now();
      loadPendingClips();
      loadUnsavedClips();
      // Refresh clips based on current view - folder-specific or all clips
      if (selectedFolderId !== null) {
        refreshFolderClips(selectedFolderId);
      } else {
        loadSavedClips(true);
      }
    }, 500);
  }, [loadPendingClips, loadUnsavedClips, loadSavedClips, isDraggingRef, selectedFolderId, refreshFolderClips]);

  useSocket(selectedTeam?.id, handleSocketUpdate);

  useEffect(() => {
    return () => {
      if (socketUpdateTimeoutRef.current) {
        clearTimeout(socketUpdateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !isLoadingClips &&
          !isDraggingRef.current
        ) {
          loadMoreClips();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoadingClips, loadMoreClips, isDraggingRef]);

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
        .then((userData) => setUser(userData))
        .catch(() => router.push("/auth"));
    }
  }, [user, router, setUser]);

  useEffect(() => {
    if (selectedTeam?.id) {
      resetFolderState();
      loadPendingClips();
      loadUnsavedClips();
      loadSavedClips(true);
      loadFolders();
      loadTags();
    }
  }, [selectedTeam?.id]);

  const handleSelectFolder = useCallback(
    async (folderId: number | null) => {
      await selectFolder(folderId, loadSavedClips);
    },
    [selectFolder, loadSavedClips]
  );

  const handleCreateFolder = async (data: {
    name: string;
    color?: string;
    message?: string;
    parentFolderId?: number | null;
  }) => {
    await createFolder(data);
    setCreateFolderParentId(null);
  };

  const handleOpenCreateFolder = (parentFolderId?: number | null) => {
    // Scale and Enterprise plans have folder management
    if (selectedTeam?.plan !== "scale" && selectedTeam?.plan !== "enterprise") {
      return;
    }
    setCreateFolderParentId(parentFolderId || null);
    setIsCreateFolderOpen(true);
  };

  const handleClipSaved = (clipId: number) => {
    setUnsavedClips((prev) => prev.filter((c) => c.id !== clipId));
    loadSavedClips(true);
  };

  const handleSavePreviewClip = async (clipId: number) => {
    setIsSavingPreviewClip(true);
    try {
      await saveClip(clipId, triggerRefresh);
    } finally {
      setIsSavingPreviewClip(false);
    }
  };

  const handleMoveClip = async (clipId: number, folderId: number | null) => {
    await moveClipToFolder(clipId, folderId);
    closeViewModal();
  };

  const handleEditClip = (clip: Clip) => {
    router.push(`/dashboard/clips/${clip.id}/edit`);
  };

  const handleGenerateShareLink = async (clipId: number) => {
    if (!selectedTeam?.id) throw new Error("No team selected");
    return await clipsAPI.generateShareLink(selectedTeam.id, clipId);
  };

  const handleRemoveShareLink = async (clipId: number) => {
    if (!selectedTeam?.id) throw new Error("No team selected");
    await clipsAPI.removeShareLink(selectedTeam.id, clipId);
  };

  const handleUpdateTitle = async (clipId: number, title: string) => {
    if (!selectedTeam?.id) throw new Error("No team selected");
    await clipsAPI.updateClip(selectedTeam.id, clipId, { title });
    // Refresh clips to update the title in the list
    if (selectedFolderId !== null) {
      await refreshFolderClips(selectedFolderId);
    } else {
      await loadSavedClips(true);
    }
  };

  // Get subfolders for the currently selected folder
  const getSubfolders = useCallback((folderId: number | null): FolderTreeNode[] => {
    if (folderId === null) {
      // At root level, show top-level folders
      return folderTree;
    }
    // Find the selected folder and return its children
    const findFolder = (nodes: FolderTreeNode[]): FolderTreeNode | null => {
      for (const node of nodes) {
        if (node.id === folderId) return node;
        const found = findFolder(node.children);
        if (found) return found;
      }
      return null;
    };
    const folder = findFolder(folderTree);
    return folder?.children || [];
  }, [folderTree]);

  const currentSubfolders = getSubfolders(selectedFolderId);

  if (!mounted || !user) {
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
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">My Clips</h1>
        </div>

        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          classNames={{
            tabList: "bg-surface-base border border-border-base rounded-lg p-1 gap-1 w-full max-w-md",
            cursor: "bg-accent-400",
            tab: "px-3 sm:px-4 py-2 data-[selected=true]:text-white flex-1 min-w-0",
            tabContent: "group-data-[selected=true]:text-white truncate",
          }}
          className="mb-4 sm:mb-6"
        >
          <Tab
            key="processing"
            title={
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0">
                <Icon icon="solar:hourglass-bold-duotone" className="text-base sm:text-lg flex-shrink-0" />
                <span className="text-xs sm:text-sm truncate">Processing</span>
                {processingCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] sm:text-xs rounded-full bg-warning-500/20 text-warning-500 flex-shrink-0">
                    {processingCount}
                  </span>
                )}
              </div>
            }
          />
          <Tab
            key="library"
            title={
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0">
                <Icon icon="solar:library-bold-duotone" className="text-base sm:text-lg flex-shrink-0" />
                <span className="text-xs sm:text-sm truncate">Library</span>
              </div>
            }
          />
        </Tabs>

        {activeTab === "processing" && (
          <div className="space-y-6">
            <PendingClipsSection
              clips={pendingClips}
              onClipClick={(clip: any) => openViewModal(clip)}
            />

            <ClipsToSaveSection
              clips={unsavedClips}
              teamId={selectedTeam!.id}
              onClipSaved={handleClipSaved}
              onClipRejected={rejectClip}
              onClipView={openPreviewModal}
              onUsageUpdated={triggerRefresh}
            />

            {pendingClips.length === 0 && unsavedClips.length === 0 && (
              <Card className="bg-surface-base border border-border-base">
                <CardBody className="flex flex-col items-center justify-center py-16">
                  <Icon
                    icon="solar:check-circle-bold-duotone"
                    className="text-6xl text-success-500 mb-4"
                  />
                  <p className="text-text-secondary text-center mb-2 text-lg">
                    All caught up!
                  </p>
                  <p className="text-text-tertiary text-center text-sm max-w-md">
                    No clips are currently processing. Upload a video to generate new clips.
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        )}

        {activeTab === "library" && (
          <div className="space-y-4">
            {/* Search Component */}
            {selectedTeam && (
              <ClipSearch
                ref={clipSearchRef}
                teamId={selectedTeam.id}
                tags={tags}
                onSearchResults={handleSearchResults}
                onSearchModeChange={handleSearchModeChange}
              />
            )}

          {/* Mobile folder toggle button */}
          {!isSearchMode && (selectedTeam?.plan === "scale" || selectedTeam?.plan === "enterprise" || folderTree.length > 0) && (
            <div className="lg:hidden">
              <Button
                className="w-full bg-surface-base border border-border-base justify-between"
                variant="flat"
                onPress={() => setIsMobileFolderOpen(!isMobileFolderOpen)}
                startContent={<Icon icon="solar:folder-bold-duotone" className="text-accent-400" width={18} />}
                endContent={<Icon icon={isMobileFolderOpen ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={16} />}
              >
                <span className="flex-1 text-left text-text-primary">
                  {selectedFolderId === null ? "All Folders" : folderPath[folderPath.length - 1]?.name || "Folder"}
                </span>
              </Button>

              {/* Mobile folder tree dropdown */}
              {isMobileFolderOpen && (
                <div className="mt-2 bg-surface-base border border-border-base rounded-lg p-3 max-h-64 overflow-y-auto">
                  <FolderTree
                    folders={folderTree}
                    selectedFolderId={selectedFolderId}
                    isCollapsed={false}
                    isReadOnly={selectedTeam?.plan !== "scale" && selectedTeam?.plan !== "enterprise"}
                    onSelectFolder={(folderId) => {
                      handleSelectFolder(folderId);
                      setIsMobileFolderOpen(false);
                    }}
                    onToggleCollapse={() => {}}
                    onMoveClip={moveClipToFolder}
                    onMoveFolder={moveFolder}
                    onCreateFolder={handleOpenCreateFolder}
                    onDeleteFolder={deleteFolder}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Folder tree - hidden on mobile, shown on lg+ */}
            {!isSearchMode && (selectedTeam?.plan === "scale" || selectedTeam?.plan === "enterprise" || folderTree.length > 0) && (
              <div className="hidden lg:block">
                <FolderTree
                  folders={folderTree}
                  selectedFolderId={selectedFolderId}
                  isCollapsed={isSidebarCollapsed}
                  isReadOnly={selectedTeam?.plan !== "scale" && selectedTeam?.plan !== "enterprise"}
                  onSelectFolder={handleSelectFolder}
                  onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  onMoveClip={moveClipToFolder}
                  onMoveFolder={moveFolder}
                  onCreateFolder={handleOpenCreateFolder}
                  onDeleteFolder={deleteFolder}
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Show folder navigation only when not searching */}
              {!isSearchMode && selectedFolderId !== null && (
                <>
                  <FolderBreadcrumb path={folderPath} onNavigate={handleSelectFolder} />
                  {folderPath.length > 0 && folderPath[folderPath.length - 1]?.message && (
                    <p className="text-sm text-text-secondary mb-4 px-1">
                      {folderPath[folderPath.length - 1].message}
                    </p>
                  )}
                </>
              )}

              {/* Show new clips section only when not searching */}
              {!isSearchMode && selectedFolderId === null && (
                <NewClipsSection
                  clips={newClips}
                  onDelete={(clipId) => deleteClip(clipId, triggerRefresh)}
                  onClipClick={(clip: any) => openViewModal(clip)}
                  onEditClick={(clip: any) => handleEditClip(clip)}
                  selectedClipId={isViewModalOpen ? selectedClip?.id : null}
                />
              )}

              <div
                onDrop={!isSearchMode ? handleDropToSaved : undefined}
                onDragOver={!isSearchMode ? handleDragOver : undefined}
                className="min-h-[200px]"
              >
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="text-base sm:text-xl font-bold text-text-primary flex items-center gap-2 min-w-0">
                    <Icon
                      icon={isSearchMode ? "solar:magnifer-bold-duotone" : "solar:video-library-bold-duotone"}
                      className="text-xl sm:text-2xl text-accent-400 flex-shrink-0"
                    />
                    <span className="truncate">
                      {isSearchMode ? "Search Results" : selectedFolderId === null ? "All Clips" : folderPath[folderPath.length - 1]?.name || "Clips"}
                    </span>
                  </h2>
                  <div className="flex items-center gap-1 bg-surface-base border border-border-base rounded-lg p-1 flex-shrink-0">
                    <Button
                      isIconOnly
                      size="sm"
                      variant={viewMode === "grid" ? "solid" : "light"}
                      className={viewMode === "grid" ? "bg-accent-400" : ""}
                      onPress={() => setViewMode("grid")}
                    >
                      <Icon icon="solar:widget-bold" className="text-lg" />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant={viewMode === "list" ? "solid" : "light"}
                      className={viewMode === "list" ? "bg-accent-400" : ""}
                      onPress={() => setViewMode("list")}
                    >
                      <Icon icon="solar:list-bold" className="text-lg" />
                    </Button>
                  </div>
                </div>

                {/* Search Results Display */}
                {isSearchMode ? (
                  isSearching && searchResults.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <Icon
                        icon="solar:loading-circle-bold"
                        className="text-4xl animate-spin text-accent-400"
                      />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-2"}>
                        {searchResults.map((clip) => (
                          <ClipCard
                            key={clip.id}
                            clip={clip}
                            viewMode={viewMode}
                            onDelete={(clipId) => {
                              deleteClip(clipId, triggerRefresh);
                              setSearchResults(prev => prev.filter(c => c.id !== clipId));
                            }}
                            onView={() => openViewModal(clip)}
                            onEdit={() => handleEditClip(clip)}
                            isSelected={isViewModalOpen && selectedClip?.id === clip.id}
                          />
                        ))}
                      </div>
                      {searchPagination.hasMore && (
                        <div className="flex justify-center py-8">
                          <Button
                            variant="flat"
                            onPress={() => clipSearchRef.current?.loadMore()}
                            isLoading={isSearching}
                            className="bg-surface-base border border-border-base"
                          >
                            Load more results
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <Card className="bg-surface-base border border-border-base">
                      <CardBody className="flex flex-col items-center justify-center py-16">
                        <Icon
                          icon="solar:magnifer-zoom-out-bold-duotone"
                          className="text-6xl text-text-tertiary mb-4"
                        />
                        <p className="text-text-secondary text-center mb-2 text-lg">
                          No clips found
                        </p>
                        <p className="text-text-tertiary text-center text-sm max-w-md">
                          Try adjusting your search terms or removing some filters
                        </p>
                      </CardBody>
                    </Card>
                  )
                ) : isLoadingClips ? (
                  <div className="flex items-center justify-center py-12">
                    <Icon
                      icon="solar:loading-circle-bold"
                      className="text-4xl animate-spin text-accent-400"
                    />
                  </div>
                ) : (currentSubfolders.length > 0 || savedClips.length > 0) ? (
                  <>
                    <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-2"}>
                      {currentSubfolders.map((subfolder) => (
                        <SubfolderCard
                          key={`folder-${subfolder.id}`}
                          folder={subfolder}
                          viewMode={viewMode}
                          onOpen={handleSelectFolder}
                          onDelete={selectedTeam?.plan === "scale" || selectedTeam?.plan === "enterprise" ? deleteFolder : undefined}
                          onDropClip={selectedTeam?.plan === "scale" || selectedTeam?.plan === "enterprise" ? moveClipToFolder : undefined}
                        />
                      ))}
                      {savedClips.map((clip) => (
                        <ClipCard
                          key={clip.id}
                          clip={clip}
                          viewMode={viewMode}
                          onDelete={(clipId) => deleteClip(clipId, triggerRefresh)}
                          onView={() => openViewModal(clip)}
                          onEdit={() => handleEditClip(clip)}
                          isSelected={isViewModalOpen && selectedClip?.id === clip.id}
                        />
                      ))}
                    </div>

                    {selectedFolderId === null && (
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
                    )}
                  </>
                ) : (
                  <Card className="bg-surface-base border border-border-base">
                    <CardBody className="flex flex-col items-center justify-center py-16">
                      <Icon
                        icon={selectedFolderId === null ? "solar:video-frame-play-vertical-bold-duotone" : "solar:inbox-outline"}
                        className="text-6xl text-text-tertiary mb-4"
                      />
                      <p className="text-text-secondary text-center mb-2 text-lg">
                        {selectedFolderId === null ? "No saved clips yet" : "This folder is empty"}
                      </p>
                      <p className="text-text-tertiary text-center text-sm max-w-md">
                        {selectedFolderId === null
                          ? "Generate clips and save the ones you like to see them here"
                          : "Drag clips here to organize them"}
                      </p>
                    </CardBody>
                  </Card>
                )}
              </div>
            </div>
          </div>
          </div>
        )}
      </div>

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => {
          setIsCreateFolderOpen(false);
          setCreateFolderParentId(null);
        }}
        onCreate={handleCreateFolder}
        parentFolderId={createFolderParentId}
        parentFolderName={getParentFolderName(createFolderParentId)}
      />

      {selectedClip && (
        <ClipViewModal
          isOpen={isViewModalOpen}
          onClose={closeViewModal}
          clip={selectedClip}
          folders={folders}
          availableTags={tags}
          onMoveToFolder={handleMoveClip}
          onTagsChange={updateClipTags}
          onCreateTag={createTag}
          onDeleteTag={deleteTag}
          onGenerateShareLink={handleGenerateShareLink}
          onRemoveShareLink={handleRemoveShareLink}
          onUpdateTitle={handleUpdateTitle}
        />
      )}

      {selectedPreviewClip && (
        <PreviewClipViewModal
          isOpen={isPreviewModalOpen}
          onClose={closePreviewModal}
          clip={selectedPreviewClip}
          onSave={handleSavePreviewClip}
          onReject={rejectClip}
          isSaving={isSavingPreviewClip}
        />
      )}
    </div>
  );
}

export default function MyClipsClient() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-surface-dark"><div className="animate-spin text-4xl">⏳</div></div>}>
      <MyClipsPageContent />
    </Suspense>
  );
}
