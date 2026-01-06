"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardBody, Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { clipsAPI } from "@/api/clips";
import { BrandLogo } from "@/components/brand-logo";
import API_URL from "@/config/constants";

interface SharedClip {
  id: number;
  title?: string;
  message?: string;
  clipUrl: string;
  created_at: string;
}

export default function SharedClipPage() {
  const params = useParams();
  const shareToken = params.shareToken as string;

  const [clip, setClip] = useState<SharedClip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClip = async () => {
      try {
        const clipData = await clipsAPI.getSharedClip(shareToken);
        setClip(clipData);
      } catch {
        setError("This clip is no longer available or the link has expired.");
      } finally {
        setIsLoading(false);
      }
    };

    if (shareToken) {
      fetchClip();
    }
  }, [shareToken]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!clip?.clipUrl || isDownloading) return;

    // Only use download-fixed-public for ComfyUI outputs (UGC videos)
    const isComfyOutput = clip.clipUrl.includes("comfy-outputs");

    setIsDownloading(true);
    try {
      const filename = `${clip.title || `clip_${clip.id}`}.mp4`.replace(/[^a-zA-Z0-9._-]/g, "_");
      let response: Response;

      if (isComfyOutput) {
        const downloadUrl = `${API_URL}/face-swap/download-fixed-public?url=${encodeURIComponent(clip.clipUrl)}&filename=${encodeURIComponent(filename)}`;
        response = await fetch(downloadUrl);
        if (!response.ok) throw new Error("Download failed");
      } else {
        response = await fetch(clip.clipUrl);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" color="primary" />
          <p className="text-text-secondary">Loading clip...</p>
        </div>
      </div>
    );
  }

  if (error || !clip) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center p-4">
        <Card className="bg-surface-base border border-border-base max-w-md w-full">
          <CardBody className="flex flex-col items-center justify-center py-12">
            <Icon
              icon="solar:video-frame-play-vertical-bold-duotone"
              className="text-6xl text-text-tertiary mb-4"
            />
            <p className="text-text-primary text-center mb-2 text-lg font-semibold">
              Clip Not Found
            </p>
            <p className="text-text-tertiary text-center text-sm">
              {error || "This clip is no longer available."}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex items-center justify-center">
                <div className="rounded-lg overflow-hidden bg-black w-full flex items-center justify-center">
                  <video
                    src={clip.clipUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full max-h-[500px] object-contain"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {clip.title && (
                  <div>
                    <h1 className="text-xl font-bold text-text-primary">
                      {clip.title}
                    </h1>
                  </div>
                )}

                {clip.message && (
                  <div className="p-4 rounded-lg bg-surface-elevated">
                    <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                      <Icon
                        icon="solar:chat-square-bold-duotone"
                        className="text-accent-400"
                      />
                      AI Analysis
                    </h3>
                    <p className="text-sm text-text-primary leading-relaxed">
                      {clip.message}
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                    <Icon
                      icon="solar:calendar-bold-duotone"
                      className="text-accent-400"
                    />
                    Created
                  </h3>
                  <p className="text-sm text-text-primary">
                    {new Date(clip.created_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    fullWidth
                    color="primary"
                    size="lg"
                    isLoading={isDownloading}
                    startContent={!isDownloading && <Icon icon="solar:download-bold" />}
                    onPress={handleDownload}
                  >
                    {isDownloading ? "Preparing, just a moment..." : "Download Clip"}
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="mt-8 flex flex-col items-center gap-2">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <BrandLogo size={32} />
            <span className="text-lg font-semibold text-text-primary">Cuttr</span>
          </a>
          <p className="text-text-tertiary text-xs">
            Create viral clips with AI
          </p>
        </div>
      </div>
    </div>
  );
}
