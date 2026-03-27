"use client";

import React, { useState } from "react";
import { Modal,
  Button,
  Input,
  TextArea, TextField, Label, FieldError} from "@heroui/react";
import { Icon } from "@iconify/react";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; color?: string; message?: string; parentFolderId?: number | null }) => Promise<void>;
  parentFolderId?: number | null;
  parentFolderName?: string;
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
  parentFolderId,
  parentFolderName,
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
      await onCreate({
        name,
        color,
        message: message || undefined,
        parentFolderId: parentFolderId || null,
      });
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
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}><Modal.Container><Modal.Dialog className="sm:max-w-md bg-surface-base border border-border-accent">
<form onSubmit={handleSubmit}>
            <Modal.Header>
              <div className="flex gap-2 items-center">
                <Icon icon="solar:folder-bold-duotone" className="text-2xl text-accent-400" />
                <h3 className="text-xl font-bold text-text-primary">
                  Create New Folder
                </h3>
              </div>
              {parentFolderName && (
                <p className="text-sm text-text-secondary mt-1">
                  Creating inside: <span className="text-accent-400">{parentFolderName}</span>
                </p>
              )}
            </Modal.Header>
            
            <Modal.Body className="py-6 space-y-4">
                            <TextField isRequired>
                <Label>Folder Name</Label>
                <Input onChange={(e) => (setName)(e.target.value)}
 placeholder="e.g., Product Demos, Social Media Clips"
 value={name}
 />
                <FieldError />
              </TextField>

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

                            <TextField>
                <Label>Description (Optional)</Label>
                <TextArea
 placeholder="Add a for this folder..."
 value={message}
 onValueChange={setMessage}
 rows={3}
 />
                <FieldError />
              </TextField>
            </Modal.Body>
            
            <Modal.Footer>
              <Button
 variant="outline"
 onPress={onClose}
 >
                Cancel
              </Button>
              <Button variant="primary"
 type="submit"
 isDisabled={!name.trim() || isLoading}
 isPending={isLoading}
 >
                {isLoading ? "Creating..." : "Create Folder"}
              </Button>
            </Modal.Footer>
          </form>
</Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
};

