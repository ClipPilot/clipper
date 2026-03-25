"use client";

import { useState, useRef, useCallback } from "react";
import { Button, Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import { actorsAPI } from "@/api/actors";

interface ReferenceImage {
  key: string;
  previewUrl: string;
}

interface ReferencesStepProps {
  teamId: number;
  referenceImages: ReferenceImage[];
  onReferenceImagesChange: (images: ReferenceImage[]) => void;
}

const MAX_REFERENCES = 3;

export function ReferencesStep({
  teamId,
  referenceImages,
  onReferenceImagesChange,
}: ReferencesStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: File[]) => {
    const remainingSlots = MAX_REFERENCES - referenceImages.length;
    const filesToUpload = files.slice(0, remainingSlots);

    if (filesToUpload.length === 0) return;

    setUploading(true);
    try {
      const uploadedImages: ReferenceImage[] = [];

      for (const file of filesToUpload) {
        const { uploadUrl, s3Key } = await actorsAPI.getPresignedUploadUrl(teamId, file.name);

        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        const previewUrl = URL.createObjectURL(file);
        uploadedImages.push({ key: s3Key, previewUrl });
      }

      onReferenceImagesChange([...referenceImages, ...uploadedImages]);
    } catch (error) {
      console.error("Failed to upload reference images:", error);
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
    [referenceImages]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleUpload(files);
    }
    e.target.value = "";
  };

  const handleRemove = (index: number) => {
    const imageToRemove = referenceImages[index];
    if (imageToRemove?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(imageToRemove.previewUrl);
    }
    onReferenceImagesChange(referenceImages.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-accent-400/20 flex items-center justify-center mx-auto mb-4">
          <Icon icon="solar:gallery-bold-duotone" className="text-accent-400" width={28} />
        </div>
        <h3 className="text-xl font-semibold text-text-accent mb-2">Reference Images</h3>
        <p className="text-text-secondary text-sm">
          Optional: Add product photos or style references to guide the generation
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {referenceImages.map((image, index) => (
          <Card
            key={image.key}
            className="aspect-square bg-surface-elevated border border-border-base relative group overflow-hidden"
          >
            <img
              src={image.previewUrl}
              alt={`Reference ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => handleRemove(index)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon icon="solar:trash-bin-2-bold" className="text-white" width={14} />
            </button>
          </Card>
        ))}

        {referenceImages.length < MAX_REFERENCES && (
          <div
            className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragging
                ? "border-accent-400 bg-accent-400/10"
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
                  width={32}
                />
                <span className="text-xs text-text-secondary mt-2">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Icon icon="solar:add-circle-bold" className="text-text-muted" width={32} />
                <span className="text-xs text-text-secondary mt-2">Add Image</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-surface-elevated rounded-xl p-4 border border-border-base">
        <div className="flex items-start gap-3">
          <Icon icon="solar:lightbulb-bold-duotone" className="text-amber-400 mt-0.5" width={20} />
          <div>
            <p className="text-sm font-medium text-text-accent mb-1">Tips for great results</p>
            <ul className="text-xs text-text-secondary space-y-1">
              <li>• Upload product images you want the actor to hold or showcase</li>
              <li>• Add brand mood board images to influence the style</li>
              <li>• Include example poses or compositions you like</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
