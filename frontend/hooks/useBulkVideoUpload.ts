"use client";

import { useState, useCallback, useRef } from "react";
import {  } from "@heroui/react";
import { toast } from "@/lib/toast";
import { campaignAPI, type CampaignVideo } from "@/api/campaign";

export type UploadFileStatus = "queued" | "uploading" | "completing" | "done" | "error";

export interface UploadFileEntry {
  name: string;
  progress: number;
  status: UploadFileStatus;
  error?: string;
}

export interface BulkUploadState {
  files: Map<string, UploadFileEntry>;
  isActive: boolean;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
}

const MAX_CONCURRENT = 5;
const VIDEO_EXTENSIONS = new Set([
  "mp4", "mov", "avi", "mkv", "webm", "m4v", "flv", "wmv", "3gp", "ts", "mts",
]);

function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.has(ext);
}

export function useBulkVideoUpload(
  teamId: number | undefined,
  campaignId: number,
  onVideoAdded: (video: CampaignVideo) => void,
) {
  const [files, setFiles] = useState<Map<string, UploadFileEntry>>(new Map());
  const [isActive, setIsActive] = useState(false);
  const abortRef = useRef(false);

  const updateFile = (key: string, update: Partial<UploadFileEntry>) => {
    setFiles((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing) next.set(key, { ...existing, ...update });
      return next;
    });
  };

  const uploadSingleFile = useCallback(
    async (file: File, key: string) => {
      if (!teamId || abortRef.current) return;

      updateFile(key, { status: "uploading", progress: 0 });

      try {
        const { video, uploadUrl } = await campaignAPI.uploadVideo(
          teamId, campaignId, file.name, file.type || "video/mp4",
        );

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              updateFile(key, { progress: Math.round((event.loaded / event.total) * 100) });
            }
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload failed: ${xhr.status}`));
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(file);
        });

        updateFile(key, { status: "completing", progress: 100 });
        const { video: completed } = await campaignAPI.completeUpload(teamId, campaignId, video.id);
        onVideoAdded(completed);
        updateFile(key, { status: "done", progress: 100 });
      } catch (err: any) {
        updateFile(key, { status: "error", progress: 0, error: err.message });
      }
    },
    [teamId, campaignId, onVideoAdded],
  );

  const processQueue = useCallback(
    async (entries: [string, File][]) => {
      let cursor = 0;
      const worker = async () => {
        while (cursor < entries.length && !abortRef.current) {
          const idx = cursor++;
          const [key, file] = entries[idx];
          await uploadSingleFile(file, key);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENT, entries.length) }, () => worker()),
      );
    },
    [uploadSingleFile],
  );

  const startUpload = useCallback(
    (inputFiles: FileList | File[]) => {
      if (!teamId) return;
      const raw = Array.from(inputFiles);
      const allFiles = raw.filter(isVideoFile);
      if (allFiles.length === 0) {
        toast({
          title: "No video files found",
          description: `${raw.length} file${raw.length !== 1 ? "s" : ""} selected but none are supported video formats.`,
          color: "warning",
        });
        return;
      }

      abortRef.current = false;
      setIsActive(true);

      const entries: [string, File][] = allFiles.map((file, i) => [
        `${file.name}-${Date.now()}-${i}`,
        file,
      ]);

      setFiles((prev) => {
        const next = new Map(prev);
        for (const [key, file] of entries) {
          next.set(key, { name: file.name, progress: 0, status: "queued" });
        }
        return next;
      });

      processQueue(entries).then(() => setIsActive(false));
    },
    [teamId, processQueue],
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setFiles(new Map());
    setIsActive(false);
  }, []);

  const completedFiles = Array.from(files.values()).filter((f) => f.status === "done").length;
  const failedFiles = Array.from(files.values()).filter((f) => f.status === "error").length;

  return {
    files,
    isActive,
    totalFiles: files.size,
    completedFiles,
    failedFiles,
    startUpload,
    reset,
  };
}
