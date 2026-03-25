"use client";

import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button, Input, Chip, Dropdown } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Clip, Tag, clipsAPI } from "@/api/clips";
import { useAtomValue } from "jotai";
import { campaignUploadFilterAtom } from "@/store/clips";

interface ClipSearchProps {
  teamId: number;
  tags: Tag[];
  onSearchResults: (results: Clip[], isSearching: boolean, pagination: { total: number; hasMore: boolean }) => void;
  onSearchModeChange: (isSearchMode: boolean) => void;
}

export interface ClipSearchHandle {
  clearSearch: () => void;
  loadMore: () => void;
  isSearchMode: boolean;
}

const ClipSearch = forwardRef<ClipSearchHandle, ClipSearchProps>(function ClipSearch({
  teamId,
  tags,
  onSearchResults,
  onSearchModeChange,
}, ref) {
  const campaignUploads = useAtomValue(campaignUploadFilterAtom);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [searchResults, setSearchResults] = useState<Clip[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPagination, setSearchPagination] = useState({ total: 0, hasMore: false });
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isSearchMode = searchQuery.trim().length > 0 || selectedTagIds.length > 0;

  useEffect(() => {
    onSearchModeChange(isSearchMode);
  }, [isSearchMode, onSearchModeChange]);

  const performSearch = useCallback(async (query: string, tagIds: number[], reset = true) => {
    if (!query.trim() && tagIds.length === 0) {
      setSearchResults([]);
      setSearchPagination({ total: 0, hasMore: false });
      onSearchResults([], false, { total: 0, hasMore: false });
      return;
    }

    setIsSearching(true);
    try {
      const result = await clipsAPI.searchClips(teamId, {
        q: query.trim() || undefined,
        tags: tagIds.length > 0 ? tagIds : undefined,
        status: "completed",
        campaignUploads: campaignUploads !== "all" ? campaignUploads : undefined,
        limit: 20,
        offset: reset ? 0 : searchResults.length,
      });

      const newResults = reset ? result.clips : [...searchResults, ...result.clips];
      const newPagination = { total: result.pagination.total, hasMore: result.pagination.hasMore };

      setSearchResults(newResults);
      setSearchPagination(newPagination);
      onSearchResults(newResults, false, newPagination);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  }, [teamId, searchResults, onSearchResults]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value, selectedTagIds);
    }, 300);
  }, [performSearch, selectedTagIds]);

  const handleTagToggle = useCallback((tagId: number) => {
    setSelectedTagIds(prev => {
      const newTags = prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId];
      setTimeout(() => performSearch(searchQuery, newTags), 0);
      return newTags;
    });
  }, [performSearch, searchQuery]);

  const handleTagSelectionChange = useCallback((keys: Set<string> | "all") => {
    if (keys === "all") return;
    const newTagIds = Array.from(keys).map(k => parseInt(k));
    setSelectedTagIds(newTagIds);
    performSearch(searchQuery, newTagIds);
  }, [performSearch, searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSelectedTagIds([]);
    setSearchResults([]);
    setSearchPagination({ total: 0, hasMore: false });
    onSearchResults([], false, { total: 0, hasMore: false });
  }, [onSearchResults]);

  const loadMoreSearchResults = useCallback(() => {
    if (!isSearching && searchPagination.hasMore) {
      performSearch(searchQuery, selectedTagIds, false);
    }
  }, [isSearching, searchPagination.hasMore, performSearch, searchQuery, selectedTagIds]);

  useImperativeHandle(ref, () => ({
    clearSearch,
    loadMore: loadMoreSearchResults,
    isSearchMode,
  }), [clearSearch, loadMoreSearchResults, isSearchMode]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Icon
            icon={isSearching ? "svg-spinners:ring-resize" : "solar:magnifer-linear"}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-lg pointer-events-none"
          />
          <Input
            onChange={(e) => (handleSearchChange)(e.target.value)}
            placeholder="Search videos"
            value={searchQuery}
            className="w-full rounded-lg border border-border-base bg-surface-elevated pl-9 pr-9 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-400/40 focus:border-accent-400 transition-colors"
          />
          {isSearchMode && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-hover transition-colors"
            >
              <Icon icon="solar:close-circle-bold" className="text-text-tertiary text-lg" />
            </button>
          )}
        </div>
        {tags.length > 0 && (
          <Dropdown>
<Button
 variant="tertiary"
 className="bg-surface-base border border-border-base"
 >
                <Icon icon="solar:tag-bold" className="text-lg" />
                <span className="hidden sm:inline">Filter by Tags</span>
                <span className="sm:hidden">Tags</span>
                {selectedTagIds.length > 0 && (
                    <Chip size="sm" className="bg-accent-400 text-white h-5 min-w-5">
                      {selectedTagIds.length}
                    </Chip>
                  )}
</Button>
<Dropdown.Popover>

<Dropdown.Menu
              aria-label="Filter by tags"
              selectionMode="multiple"
              selectedKeys={new Set(selectedTagIds.map(String))}
              onSelectionChange={(keys) => handleTagSelectionChange(keys as Set<string>)}
              classNames={{
                base: "bg-surface-base border border-border-base",
              }}
            >
              {tags.map((tag) => (
                <Dropdown.Item key={tag.id.toString()}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
</Dropdown.Popover>
          </Dropdown>
        )}
      </div>

      {selectedTagIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTagIds.map((tagId) => {
            const tag = tags.find(t => t.id === tagId);
            if (!tag) return null;
            return (
              <Chip
 key={tagId}
 onClose={() => handleTagToggle(tagId)}
 variant="tertiary"
 >
                <div
                    className="w-2 h-2 rounded-full ml-1"
                    style={{ backgroundColor: tag.color }}
                  />
                {tag.name}
              </Chip>
            );
          })}
          <Button
 size="sm"
 variant="tertiary"
 onPress={clearSearch}
 className="text-text-tertiary h-7"
 >
            Clear all
          </Button>
        </div>
      )}

      {isSearchMode && !isSearching && (
        <p className="text-sm text-text-secondary">
          Found {searchPagination.total} clip{searchPagination.total !== 1 ? "s" : ""}
          {searchQuery && ` matching "${searchQuery}"`}
          {selectedTagIds.length > 0 && ` with ${selectedTagIds.length} tag${selectedTagIds.length !== 1 ? "s" : ""}`}
        </p>
      )}
    </div>
  );
});

export default ClipSearch;
export type { ClipSearchProps };
