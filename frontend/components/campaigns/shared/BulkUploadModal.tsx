"use client";

import { useRef } from "react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Progress,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { UploadFileEntry } from "@/hooks/useBulkVideoUpload";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: Map<string, UploadFileEntry>;
  isActive: boolean;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  onStartUpload: (files: FileList | File[]) => void;
  onReset: () => void;
}

function statusIcon(status: UploadFileEntry["status"]) {
  switch (status) {
    case "done":
      return <Icon icon="solar:check-circle-bold" className="text-success-500 flex-shrink-0" width={16} />;
    case "error":
      return <Icon icon="solar:close-circle-bold" className="text-danger-500 flex-shrink-0" width={16} />;
    case "uploading":
    case "completing":
      return <Icon icon="solar:upload-bold-duotone" className="text-accent-400 flex-shrink-0 animate-pulse" width={16} />;
    default:
      return <Icon icon="solar:clock-circle-bold-duotone" className="text-text-tertiary flex-shrink-0" width={16} />;
  }
}

function statusLabel(entry: UploadFileEntry) {
  switch (entry.status) {
    case "queued": return "Queued";
    case "uploading": return `${entry.progress}%`;
    case "completing": return "Processing...";
    case "done": return "Done";
    case "error": return "Failed";
  }
}

export function BulkUploadModal({
  isOpen,
  onClose,
  files,
  isActive,
  totalFiles,
  completedFiles,
  failedFiles,
  onStartUpload,
  onReset,
}: BulkUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const entries = Array.from(files.entries());
  const overallProgress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
  const isDone = !isActive && totalFiles > 0;
  const inProgressCount = entries.filter(([, f]) => f.status === "uploading" || f.status === "completing").length;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    e.target.value = "";
    onStartUpload(fileList);
  };

  const handleClose = () => {
    if (!isActive) {
      onReset();
      onClose();
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        isDismissable={!isActive}
        size="2xl"
        scrollBehavior="inside"
        classNames={{ base: "bg-surface-base border border-border-base" }}
      >
        <ModalContent>
          <ModalHeader className="border-b border-border-base">
            <div className="flex items-center gap-2">
              <Icon icon="solar:upload-bold-duotone" className="text-accent-400" width={22} />
              <span className="text-text-primary">
                {isDone ? "Upload Complete" : isActive ? "Uploading Videos..." : "Upload Videos"}
              </span>
            </div>
          </ModalHeader>

          <ModalBody className="py-4 gap-4">
            {totalFiles === 0 ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Icon icon="solar:cloud-upload-bold-duotone" className="text-text-tertiary" width={48} />
                <p className="text-sm text-text-secondary text-center">
                  Select video files or an entire folder to bulk upload.
                  <br />
                  <span className="text-text-tertiary text-xs">
                    Folders are scanned recursively for all video files.
                  </span>
                </p>
                <div className="flex gap-3">
                  <Button
                    color="primary"
                    onPress={() => fileInputRef.current?.click()}
                    startContent={<Icon icon="solar:file-bold-duotone" width={16} />}
                  >
                    Select Files
                  </Button>
                  <Button
                    variant="flat"
                    className="bg-surface-elevated text-text-secondary"
                    onPress={() => folderInputRef.current?.click()}
                    startContent={<Icon icon="solar:folder-bold-duotone" width={16} />}
                  >
                    Select Folder
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">
                      {isActive
                        ? `Uploading ${inProgressCount} · ${completedFiles}/${totalFiles} done`
                        : `${completedFiles} uploaded${failedFiles > 0 ? ` · ${failedFiles} failed` : ""}`}
                    </span>
                    <span className="font-semibold text-text-primary">{overallProgress}%</span>
                  </div>
                  <Progress
                    value={overallProgress}
                    color={isDone && failedFiles === 0 ? "success" : isDone ? "warning" : "primary"}
                    size="md"
                    classNames={{ base: "w-full" }}
                  />
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
                  {entries.map(([key, item]) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-elevated/50"
                    >
                      {statusIcon(item.status)}
                      <span className="text-xs text-text-primary truncate flex-1 min-w-0">
                        {item.name}
                      </span>
                      <span className="text-xs text-text-secondary flex-shrink-0 w-20 text-right">
                        {statusLabel(item)}
                      </span>
                      {item.status === "uploading" && (
                        <Progress
                          value={item.progress}
                          size="sm"
                          color="primary"
                          classNames={{ base: "w-16 flex-shrink-0" }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </ModalBody>

          <ModalFooter className="border-t border-border-base">
            {isDone ? (
              <Button className="bg-accent-400 text-white" onPress={handleClose}>
                Done
              </Button>
            ) : isActive ? (
              <span className="text-xs text-text-tertiary">
                Do not close this tab while uploading
              </span>
            ) : totalFiles > 0 ? (
              <Button variant="flat" className="bg-surface-elevated text-text-secondary" onPress={handleClose}>
                Cancel
              </Button>
            ) : (
              <Button variant="flat" className="bg-surface-elevated text-text-secondary" onPress={handleClose}>
                Cancel
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in React types
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFiles}
      />
    </>
  );
}
