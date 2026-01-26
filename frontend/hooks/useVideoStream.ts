"use client";

import { useEffect, useState } from "react";
import { apiFetch, tokenManager } from "@/lib/apiClient";
import API_URL from "@/config/constants";
import {
  configureVideoProxy,
  isVideoProxyReady,
  getVideoProxyUrl,
} from "@/lib/videoProxy";

export function useVideoStream({
  isOpen,
  clipId,
  teamId,
  clipUrl,
}: {
  isOpen: boolean;
  clipId: number;
  teamId?: number;
  clipUrl?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !clipUrl || !teamId) {
      setBlobUrl(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const streamPath = `clip-video/teams/${teamId}/clips/${clipId}/stream`;

    const load = async () => {
      setIsLoading(true);
      setBlobUrl(null);

      // Service Worker proxy: browser handles native video streaming
      if (isVideoProxyReady()) {
        const token = tokenManager.getAccessToken();
        if (token && API_URL) {
          const configured = await configureVideoProxy(token, API_URL);
          if (configured && !cancelled) {
            setBlobUrl(getVideoProxyUrl(streamPath));
            setIsLoading(false);
            return;
          }
        }
      }

      // Fallback: full blob download (when SW unavailable)
      try {
        const res = await apiFetch(`${API_URL}/${streamPath}`);
        if (!res.ok || cancelled) {
          if (!cancelled) setIsLoading(false);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load video:", err);
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, clipId, clipUrl, teamId]);

  return { blobUrl, isLoading };
}
