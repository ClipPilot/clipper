"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { Folder } from "@/api/clips";

interface FolderBreadcrumbProps {
  path: Folder[];
  onNavigate: (folderId: number | null) => void;
}

export const FolderBreadcrumb: React.FC<FolderBreadcrumbProps> = ({
  path,
  onNavigate,
}) => {
  if (path.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 mb-4 flex-wrap">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
      >
        <Icon icon="solar:home-2-bold-duotone" className="text-base" />
        <span>All Clips</span>
      </button>

      {path.map((folder, index) => (
        <React.Fragment key={folder.id}>
          <Icon
            icon="solar:alt-arrow-right-linear"
            className="text-sm text-text-tertiary flex-shrink-0"
          />
          <button
            onClick={() => onNavigate(folder.id)}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-md text-sm transition-colors
              ${index === path.length - 1
                ? "text-text-primary bg-surface-elevated"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"}
            `}
          >
            <Icon
              icon="solar:folder-bold-duotone"
              className="text-base flex-shrink-0"
              style={{ color: folder.color || "#3B82F6" }}
            />
            <span className="truncate max-w-[150px]">{folder.name}</span>
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};
