"use client";

import React from "react";
import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface UploadSectionProps {
  selectedFile: File | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  selectedFile,
  onFileSelect,
  fileInputRef,
}) => {
  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-20 h-20 bg-accent-400/10 rounded-full flex items-center justify-center">
            <Icon icon="solar:videocamera-record-bold-duotone" className="text-4xl text-accent-400" />
          </div>
          
          <div className="text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">
              Upload Your Video
            </h3>
            <p className="text-sm text-text-secondary">
              Choose a video file to create AI-powered clips
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={onFileSelect}
            className="hidden"
            id="video-upload"
          />

          <Button
            as="label"
            htmlFor="video-upload"
            size="lg"
            color="primary"
            startContent={<Icon icon="solar:upload-bold" className="text-xl" />}
            className="cursor-pointer px-8"
          >
            Choose Video File
          </Button>

          {selectedFile && (
            <div className="flex items-center gap-3 p-4 bg-accent-400/5 border border-accent-400/20 rounded-lg">
              <Icon icon="solar:file-check-bold" className="text-2xl text-accent-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{selectedFile.name}</p>
                <p className="text-xs text-text-secondary">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-text-tertiary">
            <Icon icon="solar:info-circle-outline" className="text-base mt-0.5" />
            <div>
              <p>Max size: 1.5GB</p>
              <p>Max duration: 3 hours</p>
              <p>Formats: MP4, MOV, AVI, MKV, WebM</p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

