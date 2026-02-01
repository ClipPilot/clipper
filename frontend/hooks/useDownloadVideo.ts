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
 * Regular clips: Direct link download (fast, no blob fetch)
 * Face-swap videos: Blob download via API (handles auth/CORS)
 */
export function useDownloadVideo() {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = useCallback(async (options: DownloadOptions) => {
    const { url, filename, isFaceSwap = false } = options;

    if (!url || isDownloading) return;

    setIsDownloading(true);
    try {
      if (isFaceSwap) {
        // Face-swap videos need blob download (handles auth/CORS)
        const blob = await faceSwapAPI.downloadVideo(url, filename);
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } else {
        // Regular clips: direct link download (faster)
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

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
