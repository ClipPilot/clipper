"use client";

import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Progress,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface Folder {
  id: number;
  name: string;
  color?: string;
}

interface Clip {
  id: number;
  folder_id?: number | null;
  message?: string;
  clip_score?: number;
  clip_metadata?: any;
  input_metadata?: any;
  prompt?: string;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  clipUrl?: string;
  sourceVideoUrl?: string;
}

interface ClipViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: Clip;
  folders?: Folder[];
  onMoveToFolder?: (clipId: number, folderId: number | null) => void;
}

export default function ClipViewModal({
  isOpen,
  onClose,
  clip,
  folders = [],
  onMoveToFolder,
}: ClipViewModalProps) {
  const [isMoving, setIsMoving] = useState(false);

  const getStatusColor = () => {
    switch (clip.status) {
      case "completed":
        return "success";
      case "failed":
        return "danger";
      case "pending":
        return "warning";
      default:
        return "default";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "success";
    if (score >= 60) return "warning";
    return "danger";
  };

  const handleDownload = async () => {
    if (!clip.clipUrl) return;

    try {
      const response = await fetch(clip.clipUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clip_${clip.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleMove = async (folderId: number | null) => {
    if (!onMoveToFolder) return;
    setIsMoving(true);
    try {
      await onMoveToFolder(clip.id, folderId);
    } finally {
      setIsMoving(false);
    }
  };

  const currentFolder = folders.find((f) => f.id === clip.folder_id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-surface-base border border-border-base",
        header: "border-b border-border-base",
        body: "py-6",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Clip Details</h2>
            <Chip color={getStatusColor()} variant="flat" size="sm">
              {clip.status}
            </Chip>
          </div>
        </ModalHeader>
        <ModalBody>
          {clip.status === "failed" && clip.error_message && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="solar:danger-circle-bold" className="text-xl text-red-500" />
                <span className="font-semibold text-red-500">Error</span>
              </div>
              <p className="text-sm text-red-400">{clip.error_message}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
            <div className="flex items-center justify-center">
              {clip.clipUrl ? (
                <div className="rounded-lg overflow-hidden bg-black w-full h-full flex items-center justify-center">
                  <video
                    src={clip.clipUrl}
                    controls
                    className="max-w-full max-h-[600px] object-contain"
                    autoPlay
                  />
                </div>
              ) : (
                <div className="rounded-lg bg-surface-elevated w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Icon icon="solar:video-frame-play-vertical-bold-duotone" className="text-6xl text-text-tertiary mb-2" />
                    <p className="text-text-secondary">Video not available</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[600px]">
              {onMoveToFolder && folders.length > 0 && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Icon icon="solar:folder-bold-duotone" className="text-accent-400" />
                    Organization
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-primary">
                      {currentFolder ? (
                        <span className="flex items-center gap-2">
                          <Icon
                            icon="solar:folder-bold-duotone"
                            style={{ color: currentFolder.color || "#3B82F6" }}
                          />
                          {currentFolder.name}
                        </span>
                      ) : (
                        "Unorganized"
                      )}
                    </span>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button
                          size="sm"
                          variant="flat"
                          isLoading={isMoving}
                          startContent={!isMoving && <Icon icon="solar:folder-send-bold" />}
                        >
                          Move to...
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Move to folder"
                        items={[
                          ...(clip.folder_id !== null
                            ? [{ id: "unorganized", name: "Unorganized", color: undefined }]
                            : []),
                          ...folders.filter((f) => f.id !== clip.folder_id).map((f) => ({
                            id: String(f.id),
                            name: f.name,
                            color: f.color,
                          })),
                        ]}
                        onAction={(key) => {
                          if (key === "unorganized") {
                            handleMove(null);
                          } else {
                            handleMove(Number(key));
                          }
                        }}
                      >
                        {(item) => (
                          <DropdownItem
                            key={item.id}
                            startContent={
                              item.id === "unorganized" ? (
                                <Icon icon="solar:inbox-bold-duotone" className="text-text-tertiary" />
                              ) : (
                                <Icon
                                  icon="solar:folder-bold-duotone"
                                  style={{ color: item.color || "#3B82F6" }}
                                />
                              )
                            }
                          >
                            {item.name}
                          </DropdownItem>
                        )}
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                </div>
              )}

              {clip.clip_score !== null && clip.clip_score !== undefined && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3">Clip Score</h3>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl font-bold text-text-primary">{clip.clip_score}</span>
                    <span className="text-text-tertiary">/100</span>
                  </div>
                  <Progress
                    value={clip.clip_score}
                    color={getScoreColor(clip.clip_score)}
                    className="h-2"
                  />
                </div>
              )}

              {clip.message && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                    <Icon icon="solar:chat-square-bold-duotone" className="text-accent-400" />
                    AI Analysis
                  </h3>
                  <p className="text-sm text-text-primary leading-relaxed">{clip.message}</p>
                </div>
              )}

              {clip.input_metadata && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Icon icon="solar:file-bold-duotone" className="text-accent-400" />
                    Source Info
                  </h3>
                  <div className="space-y-2">
                    {clip.input_metadata.originalFileName && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-text-tertiary min-w-[50px]">File:</span>
                        <p className="text-sm text-text-primary break-all">{clip.input_metadata.originalFileName}</p>
                      </div>
                    )}
                    {clip.input_metadata.fileSize && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-tertiary min-w-[50px]">Size:</span>
                        <p className="text-sm text-text-primary">
                          {(clip.input_metadata.fileSize / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {clip.clip_metadata?.parameters && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Icon icon="solar:settings-bold-duotone" className="text-accent-400" />
                    Parameters
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {clip.clip_metadata.parameters.length && (
                      <div className="p-2 rounded bg-surface-dark">
                        <p className="text-xs text-text-tertiary">Length</p>
                        <p className="text-sm text-text-primary font-medium">
                          {clip.clip_metadata.parameters.length}s
                        </p>
                      </div>
                    )}
                    {clip.clip_metadata.parameters.hookLength && (
                      <div className="p-2 rounded bg-surface-dark">
                        <p className="text-xs text-text-tertiary">Hook</p>
                        <p className="text-sm text-text-primary font-medium">
                          {clip.clip_metadata.parameters.hookLength}s
                        </p>
                      </div>
                    )}
                    {clip.clip_metadata.parameters.promptType && (
                      <div className="p-2 rounded bg-surface-dark">
                        <p className="text-xs text-text-tertiary">Type</p>
                        <p className="text-sm text-text-primary font-medium capitalize">
                          {clip.clip_metadata.parameters.promptType}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg bg-surface-elevated">
                <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                  <Icon icon="solar:calendar-bold-duotone" className="text-accent-400" />
                  Created
                </h3>
                <p className="text-sm text-text-primary">
                  {new Date(clip.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex justify-between">
          <Button variant="flat" onPress={onClose}>
            Close
          </Button>
          {clip.clipUrl && (
            <Button
              color="primary"
              startContent={<Icon icon="solar:download-bold" />}
              onPress={handleDownload}
            >
              Download
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
