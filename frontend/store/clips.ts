"use client";

import { atom } from "jotai";
import { Clip, Folder, FolderTreeNode, Tag } from "@/api/clips";

export const pendingClipsAtom = atom<Clip[]>([]);
export const unsavedClipsAtom = atom<Clip[]>([]);
export const savedClipsAtom = atom<Clip[]>([]);

export const foldersAtom = atom<Folder[]>([]);
export const folderTreeAtom = atom<FolderTreeNode[]>([]);
export const selectedFolderIdAtom = atom<number | null>(null);
export const folderPathAtom = atom<Folder[]>([]);

export const tagsAtom = atom<Tag[]>([]);

export const isLoadingClipsAtom = atom(false);
export const isLoadingMoreAtom = atom(false);
export const isLoadingFoldersAtom = atom(false);

export const hasMoreClipsAtom = atom(true);
export const clipsOffsetAtom = atom(0);

export const activeTabAtom = atom<string>("library");
export const isSidebarCollapsedAtom = atom(false);
export const draggedClipIdAtom = atom<number | null>(null);
export const clipsViewModeAtom = atom<"grid" | "list">("grid");
export const clipsSortAtom = atom<"newest" | "oldest">("newest");
export const campaignUploadFilterAtom = atom<"all" | "only" | "hide">("all");

export const isCreateFolderOpenAtom = atom(false);
export const createFolderParentIdAtom = atom<number | null>(null);

export const isViewModalOpenAtom = atom(false);
export const selectedClipAtom = atom<Clip | null>(null);

export const isPreviewModalOpenAtom = atom(false);
export const selectedPreviewClipAtom = atom<Clip | null>(null);
export const isSavingPreviewClipAtom = atom(false);

export const isDeleteModalOpenAtom = atom(false);
export const clipToDeleteAtom = atom<{ id: number; name?: string } | null>(null);
export const isDeletingClipAtom = atom(false);

export const newClipsAtom = atom((get) => {
  const savedClips = get(savedClipsAtom);
  const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
  return savedClips.filter((clip) => new Date(clip.created_at) > twentyMinutesAgo);
});

export const processingCountAtom = atom((get) => {
  return get(pendingClipsAtom).length + get(unsavedClipsAtom).length;
});
