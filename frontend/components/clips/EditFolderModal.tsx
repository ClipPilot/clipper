"use client";

import React, { useState, useEffect } from "react";
import { Modal,
  Button,
  Input,
  TextArea, TextField, Label, FieldError} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { Folder } from "@/api/clips";

interface EditFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder | null;
  onUpdate: (folderId: number, updates: { name?: string; color?: string; message?: string }) => Promise<void>;
}

const FOLDER_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#6366F1",
];

export const EditFolderModal: React.FC<EditFolderModalProps> = ({
  isOpen,
  onClose,
  folder,
  onUpdate,
}) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setColor(folder.color || FOLDER_COLORS[0]);
      setMessage(folder.message || "");
    }
  }, [folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folder || !name.trim()) return;

    setIsLoading(true);
    try {
      await onUpdate(folder.id, {
        name: name.trim(),
        color,
        message: message || undefined,
      });
      onClose();
    } catch {
      // toast handled by hook
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
                <Icon icon="solar:folder-bold-duotone" className="text-2xl" style={{ color }} />
                <h3 className="text-xl font-bold text-text-primary">
                  Edit Folder
                </h3>
              </div>
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
 onChange={(e) => setMessage(e.target.value)}
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
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </Modal.Footer>
          </form>
</Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
};
