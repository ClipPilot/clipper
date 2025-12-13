"use client";

import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface Clip {
  id: number;
  message?: string;
  clip_score?: number;
  clip_metadata?: any;
  input_metadata?: any;
  prompt?: string;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

interface ClipViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: Clip;
}

export default function ClipViewModal({ isOpen, onClose, clip }: ClipViewModalProps) {
  const getStatusColor = () => {
    switch (clip.status) {
      case "completed":
        return "success";
      case "failed":
        return "danger";
      case "pending":
      case "processing":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-surface-base border border-border-base",
        header: "border-b border-border-base",
        body: "py-6",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Clip Details</h2>
            <Chip color={getStatusColor()} variant="flat" size="sm">
              {clip.status}
            </Chip>
          </div>
        </ModalHeader>
        <ModalBody>
          {clip.status === "failed" && clip.error_message && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="solar:danger-circle-bold" className="text-xl text-red-500" />
                <span className="font-semibold text-red-500">Error</span>
              </div>
              <p className="text-sm text-red-400">{clip.error_message}</p>
            </div>
          )}

          <div className="space-y-4">
            {clip.message && (
              <div>
                <h3 className="text-sm font-semibold text-text-secondary mb-2">Message</h3>
                <p className="text-text-primary">{clip.message}</p>
              </div>
            )}

            {clip.clip_score !== null && clip.clip_score !== undefined && (
              <div>
                <h3 className="text-sm font-semibold text-text-secondary mb-2">Clip Score</h3>
                <div className="flex items-center gap-2">
                  <Chip color="primary" variant="flat">
                    {clip.clip_score}/100
                  </Chip>
                </div>
              </div>
            )}

            {clip.prompt && (
              <div>
                <h3 className="text-sm font-semibold text-text-secondary mb-2">Prompt</h3>
                <p className="text-text-primary text-sm">{clip.prompt}</p>
              </div>
            )}

            {clip.clip_metadata && (
              <div>
                <h3 className="text-sm font-semibold text-text-secondary mb-2">Parameters</h3>
                <div className="grid grid-cols-2 gap-3">
                  {clip.clip_metadata.parameters?.length && (
                    <div className="p-3 rounded-lg bg-surface-elevated">
                      <p className="text-xs text-text-tertiary mb-1">Length</p>
                      <p className="text-sm text-text-primary font-medium">
                        {clip.clip_metadata.parameters.length}s
                      </p>
                    </div>
                  )}
                  {clip.clip_metadata.parameters?.hookLength && (
                    <div className="p-3 rounded-lg bg-surface-elevated">
                      <p className="text-xs text-text-tertiary mb-1">Hook Length</p>
                      <p className="text-sm text-text-primary font-medium">
                        {clip.clip_metadata.parameters.hookLength}s
                      </p>
                    </div>
                  )}
                  {clip.clip_metadata.parameters?.promptType && (
                    <div className="p-3 rounded-lg bg-surface-elevated">
                      <p className="text-xs text-text-tertiary mb-1">Type</p>
                      <p className="text-sm text-text-primary font-medium capitalize">
                        {clip.clip_metadata.parameters.promptType}
                      </p>
                    </div>
                  )}
                  {clip.clip_metadata.parameters?.textPosition && (
                    <div className="p-3 rounded-lg bg-surface-elevated">
                      <p className="text-xs text-text-tertiary mb-1">Text Position</p>
                      <p className="text-sm text-text-primary font-medium capitalize">
                        {clip.clip_metadata.parameters.textPosition}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {clip.input_metadata && (
              <div>
                <h3 className="text-sm font-semibold text-text-secondary mb-2">Source Video</h3>
                <div className="space-y-2">
                  {clip.input_metadata.originalFileName && (
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:file-bold-duotone" className="text-text-tertiary" />
                      <p className="text-sm text-text-primary">{clip.input_metadata.originalFileName}</p>
                    </div>
                  )}
                  {clip.input_metadata.fileSize && (
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:database-bold-duotone" className="text-text-tertiary" />
                      <p className="text-sm text-text-primary">
                        {(clip.input_metadata.fileSize / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-2">Timestamps</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:calendar-add-bold-duotone" className="text-text-tertiary" />
                  <p className="text-sm text-text-primary">
                    Created: {new Date(clip.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:calendar-mark-bold-duotone" className="text-text-tertiary" />
                  <p className="text-sm text-text-primary">
                    Updated: {new Date(clip.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
