"use client";

import React, { useState } from "react";
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Button,
  Input,
  Textarea
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; color?: string; message?: string }) => Promise<void>;
}

const FOLDER_COLORS = [
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#EF4444", // Red
  "#F59E0B", // Amber
  "#10B981", // Green
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
];

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      await onCreate({ name, color, message: message || undefined });
      setName("");
      setColor(FOLDER_COLORS[0]);
      setMessage("");
      onClose();
    } catch (error) {
      console.error("Failed to create folder:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent className="bg-surface-base border border-border-accent">
        {(onClose) => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="flex gap-2 items-center border-b border-border-base">
              <Icon icon="solar:folder-bold-duotone" className="text-2xl text-accent-400" />
              <h3 className="text-xl font-bold text-text-primary">
                Create New Folder
              </h3>
            </ModalHeader>
            
            <ModalBody className="py-6 space-y-4">
              <Input
                label="Folder Name"
                placeholder="e.g., Product Demos, Social Media Clips"
                value={name}
                onValueChange={setName}
                isRequired
                classNames={{
                  label: "text-sm font-medium text-text-primary",
                  input: "text-text-primary",
                  inputWrapper: "bg-surface-elevated border-border-base",
                }}
              />

              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">
                  Folder Color
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {FOLDER_COLORS.map((colorOption) => (
                    <button
                      key={colorOption}
                      type="button"
                      onClick={() => setColor(colorOption)}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        color === colorOption
                          ? "ring-2 ring-accent-400 ring-offset-2 ring-offset-surface-base scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: colorOption }}
                    />
                  ))}
                </div>
              </div>

              <Textarea
                label="Description (Optional)"
                placeholder="Add a description for this folder..."
                value={message}
                onValueChange={setMessage}
                minRows={3}
                classNames={{
                  label: "text-sm font-medium text-text-primary",
                  input: "text-text-primary resize-none",
                  inputWrapper: "bg-surface-elevated border-border-base",
                }}
              />
            </ModalBody>
            
            <ModalFooter className="border-t border-border-base">
              <Button
                color="default"
                variant="bordered"
                onPress={onClose}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                type="submit"
                isDisabled={!name.trim() || isLoading}
                isLoading={isLoading}
              >
                {isLoading ? "Creating..." : "Create Folder"}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};

