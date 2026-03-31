"use client";

import { useRef, useState } from "react";
import { Button, Modal, Spinner } from "@heroui/react";
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

function StatusDot({ status }: { status: UploadFileEntry["status"] }) {
  if (status === "done") return <Icon icon="solar:check-circle-bold" className="text-green-500 flex-shrink-0" width={16} />;
  if (status === "error") return <Icon icon="solar:close-circle-bold" className="text-red-500 flex-shrink-0" width={16} />;
  if (status === "uploading" || status === "completing") return <Icon icon="solar:upload-bold-duotone" className="text-accent-400 flex-shrink-0 animate-pulse" width={16} />;
  return <Icon icon="solar:clock-circle-bold-duotone" className="text-text-tertiary flex-shrink-0" width={16} />;
}

function statusText(entry: UploadFileEntry) {
  switch (entry.status) {
    case "queued": return "Queued";
    case "uploading": return `${entry.progress}%`;
    case "completing": return "Processing...";
    case "done": return "Done";
    case "error": return "Failed";
  }
}

export function BulkUploadModal({
  isOpen, onClose, files, isActive, totalFiles, completedFiles, failedFiles, onStartUpload, onReset,
}: BulkUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [pendingFileCount, setPendingFileCount] = useState(0);

  const entries = Array.from(files.entries());
  const overallProgress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
  const isDone = !isActive && totalFiles > 0 && pendingFileCount === 0;
  const inProgressCount = entries.filter(([, f]) => f.status === "uploading" || f.status === "completing").length;
  const showProgress = totalFiles > 0 || pendingFileCount > 0;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const cloned = Array.from(fileList);
    e.target.value = "";
    setPendingFileCount(cloned.length);
    onStartUpload(cloned);
    requestAnimationFrame(() => setPendingFileCount(0));
  };

  const handleClose = () => {
    if (!isActive) { onReset(); setPendingFileCount(0); onClose(); }
  };

  return (
    <>
      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose} isDismissable={!isActive}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-lg">
              <Modal.CloseTrigger />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDone ? "bg-green-500/15" : "bg-accent-400/15"}`}>
                    <Icon icon={isDone ? "solar:check-circle-bold-duotone" : "solar:upload-bold-duotone"} className={isDone ? "text-green-500" : "text-accent-400"} width={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">
                      {isDone ? "Upload Complete" : isActive ? "Uploading Videos..." : "Upload Videos"}
                    </h3>
                    {isActive && (
                      <p className="text-xs text-text-tertiary">Do not close this tab while uploading</p>
                    )}
                  </div>
                </div>

                {!showProgress ? (
                  <div className="flex flex-col items-center gap-4 py-8 rounded-xl border-2 border-dashed border-border-base">
                    <Icon icon="solar:cloud-upload-bold-duotone" className="text-text-tertiary" width={48} />
                    <p className="text-sm text-text-secondary text-center">Select video files or an entire folder to upload.</p>
                    <div className="flex gap-3">
                      <Button variant="primary" className="bg-accent-400 text-white" onPress={() => fileInputRef.current?.click()}>
                        <Icon icon="solar:file-bold-duotone" width={16} />
                        Select Files
                      </Button>
                      <Button variant="secondary" onPress={() => folderInputRef.current?.click()}>
                        <Icon icon="solar:folder-bold-duotone" width={16} />
                        Select Folder
                      </Button>
                    </div>
                  </div>
                ) : totalFiles === 0 && pendingFileCount > 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Spinner size="lg" color="accent" />
                    <p className="text-sm text-text-secondary">Preparing {pendingFileCount} file{pendingFileCount !== 1 ? "s" : ""}...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">
                          {isActive
                            ? `Uploading ${inProgressCount} · ${completedFiles}/${totalFiles} done`
                            : `${completedFiles} uploaded${failedFiles > 0 ? ` · ${failedFiles} failed` : ""}`}
                        </span>
                        <span className="font-semibold text-text-primary">{overallProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isDone ? "bg-green-500" : "bg-accent-400"}`}
                          style={{ width: `${overallProgress}%` }}
                        />
                      </div>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                      {entries.map(([key, item]) => (
                        <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03]">
                          <StatusDot status={item.status} />
                          <span className="text-sm text-text-primary truncate flex-1 min-w-0">{item.name}</span>
                          <span className={`text-xs font-medium flex-shrink-0 ${
                            item.status === "done" ? "text-green-500"
                            : item.status === "error" ? "text-red-400"
                            : item.status === "uploading" || item.status === "completing" ? "text-accent-400"
                            : "text-text-tertiary"
                          }`}>
                            {statusText(item)}
                          </span>
                          {item.status === "uploading" && (
                            <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex-shrink-0">
                              <div className="h-full rounded-full bg-accent-400 transition-all duration-200" style={{ width: `${item.progress}%` }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(isDone || !isActive) && (
                <div className="px-6 pb-6 flex justify-end">
                  {isDone ? (
                    <Button className="bg-green-500 text-white" onPress={handleClose}>
                      <Icon icon="solar:check-circle-bold" width={16} />
                      Done
                    </Button>
                  ) : (
                    <Button variant="secondary" onPress={handleClose}>Cancel</Button>
                  )}
                </div>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <input ref={fileInputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleFiles} />
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
