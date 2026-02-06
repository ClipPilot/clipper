"use client";

import { useState, useCallback } from "react";
import { addToast } from "@heroui/react";
import { faceSwapAPI } from "@/api/ugc/faceSwap";

interface DownloadOptions {
  url: string;
  filename: string;
  isFaceSwap?: boolean;
}

/**
 * Hook for downloading videos with consistent error handling and loading state.
 *
 * Downloads video as blob and triggers save dialog.
 * This works for all video sources including S3 presigned URLs.
 */
export function useDownloadVideo() {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = useCallback(async (options: DownloadOptions) => {
    const { url, filename, isFaceSwap = false } = options;

    if (!url || isDownloading) return;

    setIsDownloading(true);
    try {
      let blob: Blob;

      if (isFaceSwap) {
        // Face-swap videos: use API endpoint (handles auth)
        blob = await faceSwapAPI.downloadVideo(url, filename);
      } else {
        // All other videos: fetch as blob directly
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.status}`);
        }
        blob = await response.blob();
      }

      // Create blob URL and trigger download
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      return true;
    } catch (error) {
      console.error("Failed to download video:", error);
      addToast({
        title: "Download failed",
        description: "Failed to download the video. Please try again.",
        color: "danger",
      });
      return false;
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  return { isDownloading, download };
}
