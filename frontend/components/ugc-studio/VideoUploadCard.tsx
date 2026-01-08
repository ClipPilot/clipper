"use client";

import { useRef, useState, useCallback } from "react";
import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import { MultiSegmentTrimmer, VideoSegment } from "./MultiSegmentTrimmer";
import { UploadedFile } from "./types";

interface VideoUploadCardProps {
  video: UploadedFile | null;
  videoDuration: number;
  segments: VideoSegment[];
  onVideoChange: (video: UploadedFile | null, duration: number) => void;
  onSegmentsChange: (segments: VideoSegment[]) => void;
}

export function VideoUploadCard({
  video,
  videoDuration,
  segments,
  onVideoChange,
  onSegmentsChange,
}: VideoUploadCardProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleVideoSelect = useCallback(
    async (file: File) => {
      const validTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
      if (!validTypes.includes(file.type)) return;

      if (video?.preview) URL.revokeObjectURL(video.preview);

      const preview = URL.createObjectURL(file);
      const videoEl = document.createElement("video");
      videoEl.src = preview;
      videoEl.onloadedmetadata = () => {
        const dur = videoEl.duration;
        const MAX_UPLOAD_DURATION = 300;
        if (dur > MAX_UPLOAD_DURATION) {
          URL.revokeObjectURL(preview);
          alert(`Video too long. Maximum upload duration is 5 minutes.`);
          return;
        }
        const newVideo = { file, preview };
        onVideoChange(newVideo, dur);
        const initialEnd = Math.min(dur, 50);
        onSegmentsChange([{ id: crypto.randomUUID(), start: 0, end: initialEnd }]);
      };
    },
    [video, onVideoChange, onSegmentsChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleVideoSelect(file);
    },
    [handleVideoSelect]
  );

  const handleClear = () => {
    if (video?.preview) URL.revokeObjectURL(video.preview);
    onVideoChange(null, 0);
    onSegmentsChange([]);
  };

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
            <Icon icon="solar:videocamera-record-bold-duotone" className="text-accent-400" width={22} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-text-primary">Video & Trim</h3>
            <p className="text-xs text-text-tertiary">Upload video and select clips (max 50s total)</p>
          </div>
          {video && (
            <Button
              size="sm"
              variant="flat"
              className="bg-surface-elevated text-text-secondary"
              onPress={handleClear}
              startContent={<Icon icon="solar:refresh-bold" width={16} />}
            >
              Change Video
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody className="pt-4">
        {video ? (
          <MultiSegmentTrimmer
            videoSrc={video.preview}
            videoFile={video.file}
            duration={videoDuration}
            segments={segments}
            onSegmentsChange={onSegmentsChange}
            maxTotalDuration={50}
            maxSegments={3}
          />
        ) : (
          <div
            className={`border-2 border-dashed rounded-xl p-12 transition-colors ${
              isDragging
                ? "border-accent-400 bg-accent-400/10"
                : "border-border-base hover:border-accent-400/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-accent-400/10 rounded-full flex items-center justify-center">
                <Icon icon="solar:upload-bold-duotone" className="text-3xl text-accent-400" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-text-primary">Drag & drop your video</p>
                <p className="text-sm text-text-tertiary mt-1">or click to browse files</p>
              </div>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVideoSelect(file);
                  e.target.value = "";
                }}
              />
              <Button
                size="md"
                variant="flat"
                color="primary"
                onPress={() => videoInputRef.current?.click()}
                startContent={<Icon icon="solar:folder-open-bold" />}
              >
                Browse Files
              </Button>
              <p className="text-xs text-text-muted">MP4, MOV, WebM supported</p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
