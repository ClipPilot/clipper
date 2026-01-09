"use client";

import { useState, useRef, useCallback } from "react";
import { Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ugcScriptAPI } from "@/api/ugc";
import type { ProductImage } from "./types";

interface ProductImageUploaderProps {
  teamId: number;
  maxImages?: number;
  images: ProductImage[];
  onImagesChange: (images: ProductImage[]) => void;
}

export function ProductImageUploader({
  teamId,
  maxImages = 5,
  images,
  onImagesChange,
}: ProductImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: File[]) => {
    const remainingSlots = maxImages - images.length;
    const filesToUpload = files.slice(0, remainingSlots);

    if (filesToUpload.length === 0) return;

    setUploading(true);
    try {
      const uploadedImages: ProductImage[] = [];

      for (const file of filesToUpload) {
        const result = await ugcScriptAPI.uploadImage(teamId, file);
        uploadedImages.push({ ...result, file });
      }

      onImagesChange([...images, ...uploadedImages]);
    } catch (error) {
      console.error("Failed to upload product images:", error);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-text-secondary">
          Product Images ({images.length}/{maxImages})
        </h4>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {images.map((image, index) => (
          <Card
            key={image.key}
            className="aspect-square bg-surface-elevated border border-border-base relative group overflow-hidden"
          >
            <img
              src={image.url}
              alt={`Product ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => handleRemove(index)}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon icon="solar:trash-bin-2-bold" className="text-white" width={12} />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <span className="text-xs text-white font-medium">#{index + 1}</span>
            </div>
          </Card>
        ))}

        {images.length < maxImages && (
          <div
            className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
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
              <div className="flex flex-col items-center">
                <Icon
                  icon="solar:cloud-upload-bold-duotone"
                  className="text-accent-400 animate-bounce"
                  width={28}
                />
                <span className="text-[10px] text-text-secondary mt-1">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Icon icon="solar:add-circle-bold" className="text-text-muted" width={28} />
                <span className="text-[10px] text-text-secondary mt-1">Add</span>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
