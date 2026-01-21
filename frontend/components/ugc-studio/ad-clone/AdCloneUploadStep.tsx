"use client";

import { useRef, useState, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Card, CardBody, Button, Input, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  adCloneVideoAtom,
  adCloneProductImageAtom,
  adCloneProductNameAtom,
  adCloneProductDescriptionAtom,
  adCloneAdDirectionAtom,
  adCloneCanProceedAtom,
  resetAdCloneAtom,
} from "@/store/adClone";

interface AdCloneUploadStepProps {
  teamId: number;
}

export function AdCloneUploadStep({ teamId }: AdCloneUploadStepProps) {
  const [video, setVideo] = useAtom(adCloneVideoAtom);
  const [productImage, setProductImage] = useAtom(adCloneProductImageAtom);
  const [productName, setProductName] = useAtom(adCloneProductNameAtom);
  const [productDescription, setProductDescription] = useAtom(adCloneProductDescriptionAtom);
  const [adDirection, setAdDirection] = useAtom(adCloneAdDirectionAtom);
  const canProceed = useAtomValue(adCloneCanProceedAtom);
  const resetAdClone = useSetAtom(resetAdCloneAtom);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [videoDragging, setVideoDragging] = useState(false);
  const [imageDragging, setImageDragging] = useState(false);

  const handleVideoSelect = useCallback(
    (file: File) => {
      const validTypes = ["video/mp4", "video/quicktime", "video/webm"];
      if (!validTypes.includes(file.type)) return;

      if (video?.preview) URL.revokeObjectURL(video.preview);

      const preview = URL.createObjectURL(file);
      const videoEl = document.createElement("video");
      videoEl.src = preview;
      videoEl.onloadedmetadata = () => {
        const duration = videoEl.duration;
        if (duration > 180) {
          URL.revokeObjectURL(preview);
          alert("Video too long. Maximum duration is 3 minutes.");
          return;
        }
        setVideo({ file, preview, duration });
      };
    },
    [video, setVideo]
  );

  const handleImageSelect = useCallback(
    (file: File) => {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) return;

      if (productImage?.preview) URL.revokeObjectURL(productImage.preview);

      const preview = URL.createObjectURL(file);
      setProductImage({ file, preview });
    },
    [productImage, setProductImage]
  );

  const handleVideoDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setVideoDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleVideoSelect(file);
    },
    [handleVideoSelect]
  );

  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setImageDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const clearVideo = () => {
    if (video?.preview) URL.revokeObjectURL(video.preview);
    setVideo(null);
  };

  const clearImage = () => {
    if (productImage?.preview) URL.revokeObjectURL(productImage.preview);
    setProductImage(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Icon icon="solar:videocamera-record-bold-duotone" className="text-orange-400" width={22} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Reference Ad</h3>
                <p className="text-xs text-text-tertiary">Upload the ad you want to clone</p>
              </div>
            </div>

            {video ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video
                    src={video.preview}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                  />
                </div>
                <div className="flex items-center justify-between p-2 bg-surface-elevated rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{video.file.name}</p>
                    <p className="text-xs text-text-tertiary">{Math.round(video.duration)}s</p>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-surface-base text-text-secondary"
                    onPress={clearVideo}
                    startContent={<Icon icon="solar:refresh-bold" width={16} />}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer ${
                  videoDragging
                    ? "border-orange-400 bg-orange-400/10"
                    : "border-border-base hover:border-orange-400/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setVideoDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setVideoDragging(false);
                }}
                onDrop={handleVideoDrop}
                onClick={() => videoInputRef.current?.click()}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-14 h-14 bg-orange-500/10 rounded-full flex items-center justify-center">
                    <Icon icon="solar:upload-bold-duotone" className="text-2xl text-orange-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-primary">Drop your ad video here</p>
                    <p className="text-xs text-text-tertiary mt-1">MP4, MOV, WebM • Max 3 minutes</p>
                  </div>
                </div>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoSelect(file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Icon icon="solar:box-bold-duotone" className="text-cyan-400" width={22} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Product Image</h3>
                <p className="text-xs text-text-tertiary">Your product to feature in the ad</p>
              </div>
            </div>

            {productImage ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-surface-elevated aspect-square max-h-[240px] mx-auto">
                  <img
                    src={productImage.preview}
                    alt="Product"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between p-2 bg-surface-elevated rounded-lg">
                  <p className="text-sm font-medium text-text-primary truncate flex-1">{productImage.file.name}</p>
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-surface-base text-text-secondary"
                    onPress={clearImage}
                    startContent={<Icon icon="solar:refresh-bold" width={16} />}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer ${
                  imageDragging
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-border-base hover:border-cyan-400/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setImageDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setImageDragging(false);
                }}
                onDrop={handleImageDrop}
                onClick={() => imageInputRef.current?.click()}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-14 h-14 bg-cyan-500/10 rounded-full flex items-center justify-center">
                    <Icon icon="solar:gallery-add-bold-duotone" className="text-2xl text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-primary">Drop your product image</p>
                    <p className="text-xs text-text-tertiary mt-1">JPG, PNG, WebP</p>
                  </div>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelect(file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Icon icon="solar:document-text-bold-duotone" className="text-purple-400" width={22} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Product Details</h3>
              <p className="text-xs text-text-tertiary">Tell us about your product</p>
            </div>
          </div>

          <Input
            label="Product Name"
            placeholder="e.g., GlowSkin Serum"
            value={productName}
            onValueChange={setProductName}
            classNames={{
              inputWrapper: "bg-surface-elevated border-border-base",
              input: "text-text-primary",
              label: "text-text-secondary",
            }}
          />

          <Textarea
            label="Product Description"
            placeholder="Describe your product, its key features, and benefits..."
            value={productDescription}
            onValueChange={setProductDescription}
            minRows={3}
            classNames={{
              inputWrapper: "bg-surface-elevated border-border-base",
              input: "text-text-primary",
              label: "text-text-secondary",
            }}
          />

          <Textarea
            label="Ad Direction (optional)"
            placeholder="Describe the style and tone you want for your ad. E.g., 'Luxury feel with soft lighting, minimal text overlays, focus on the product texture...'"
            value={adDirection}
            onValueChange={setAdDirection}
            minRows={2}
            classNames={{
              inputWrapper: "bg-surface-elevated border-border-base",
              input: "text-text-primary",
              label: "text-text-secondary",
            }}
          />
        </CardBody>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="flat"
          className="bg-surface-base text-text-secondary"
          onPress={() => resetAdClone()}
          startContent={<Icon icon="solar:restart-bold" width={18} />}
        >
          Reset All
        </Button>
        <Button
          color="primary"
          size="lg"
          isDisabled={!canProceed}
          className="px-8"
          endContent={<Icon icon="solar:arrow-right-linear" width={18} />}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
