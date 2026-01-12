"use client";

import { useState, useRef, useCallback } from "react";
import { Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import type { SupportingImage } from "./types";

interface SupportingImageUploaderProps {
  teamId: number;
  maxImages?: number;
  images: SupportingImage[];
  onImagesChange: (images: SupportingImage[]) => void;
}

export function SupportingImageUploader({
  teamId,
  maxImages = 3,
  images,
  onImagesChange,
}: SupportingImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: File[]) => {
    const remainingSlots = maxImages - images.length;
    const filesToUpload = files.slice(0, remainingSlots);

    if (filesToUpload.length === 0) return;

    setUploading(true);
    try {
      const uploadedImages: SupportingImage[] = [];

      for (const file of filesToUpload) {
        const result = await sceneBuilderAPI.uploadSupportingImage(teamId, file);
        uploadedImages.push({ ...result, file });
      }

      onImagesChange([...images, ...uploadedImages]);
    } catch (error) {
      console.error("Failed to upload supporting images:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) {
        handleUpload(files);
      }
    },
    [images]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleUpload(files);
    }
    e.target.value = "";
  };

  const handleRemove = (index: number) => {
    const imageToRemove = images[index];
    if (imageToRemove?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {images.map((image, index) => (
          <Card
            key={image.key}
            className="w-14 h-14 bg-surface-elevated border border-border-base relative group overflow-hidden shrink-0"
          >
            <img
              src={image.url}
              alt={`Supporting ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => handleRemove(index)}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon icon="solar:close-circle-bold" className="text-white" width={10} />
            </button>
          </Card>
        ))}

        {images.length < maxImages && (
          <div
            className={`w-14 h-14 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 ${
              isDragging
                ? "border-accent-400 bg-accent-400/10 scale-105"
                : "border-border-base hover:border-accent-400/50 bg-surface-elevated/50"
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
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            {uploading ? (
              <Icon
                icon="solar:cloud-upload-bold-duotone"
                className="text-accent-400 animate-bounce"
                width={20}
              />
            ) : (
              <Icon icon="solar:add-circle-bold" className="text-text-muted" width={20} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
