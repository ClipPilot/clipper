"use client";

import React, { useState } from "react";
import { Card, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Folder, Clip } from "@/api/clips";
import { ClipCard } from "./ClipCard";

interface FolderCardProps {
  folder: Folder;
  clips: Clip[];
  onDelete?: (folderId: number) => void;
  onDrop?: (folderId: number, clipId: number) => void;
  onClipDelete?: (clipId: number) => void;
  onDownload?: (folderId: number) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  clips,
  onDelete,
  onDrop,
  onClipDelete,
  onDownload,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const clipId = e.dataTransfer.getData("clipId");
    if (clipId && onDrop) {
      onDrop(folder.id, parseInt(clipId));
    }
  };

  return (
    <Card 
 className={`bg-surface-base border-2 transition-all ${
 isDragOver 
 ? "border-accent-400 bg-accent-400/5" 
 : "border-border-accent hover:border-accent-400/50"
 }`}
 onDragOver={handleDragOver}
 onDragLeave={handleDragLeave}
 onDrop={handleDrop}
 >
      <Card.Header className="flex items-center justify-between p-4 border-b border-border-base">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: folder.color || "#3B82F6" + "20" }}
          >
            <Icon 
              icon="solar:folder-bold-duotone" 
              className="text-2xl"
              style={{ color: folder.color || "#3B82F6" }}
            />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">{folder.name}</h3>
            <p className="text-xs text-text-tertiary">{clips.length} clips</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onDownload && clips.length > 0 && (
            <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 onPress={() => onDownload(folder.id)}
 >
              <Icon icon="solar:download-minimalistic-outline" className="text-lg" />
            </Button>
          )}
          {onDelete && (
            <Button
 isIconOnly
 size="sm"
 variant="danger-soft"
 onPress={() => onDelete(folder.id)}
 >
              <Icon icon="solar:trash-bin-outline" className="text-lg" />
            </Button>
          )}
        </div>
      </Card.Header>
      
      <Card.Content className="p-4">
        {folder.message && (
          <p className="text-sm text-text-secondary mb-4">{folder.message}</p>
        )}
        
        {clips.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} onDelete={onClipDelete} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border-base rounded-lg">
            <Icon icon="solar:inbox-bold-duotone" className="text-5xl text-text-tertiary mb-3" />
            <p className="text-sm text-text-secondary text-center">
              Drag and drop clips here
            </p>
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

