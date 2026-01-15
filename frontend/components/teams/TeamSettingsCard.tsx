"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Avatar,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { teamAPI, Team } from "@/api/team";

interface TeamSettingsCardProps {
  team: Team;
  onTeamUpdated: () => void;
  onTeamDeleted: () => void;
}

export default function TeamSettingsCard({
  team,
  onTeamUpdated,
  onTeamDeleted,
}: TeamSettingsCardProps) {
  const [teamName, setTeamName] = useState(team.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleRename = async () => {
    if (!teamName.trim() || teamName === team.name) return;

    setIsRenaming(true);
    try {
      await teamAPI.updateTeamName(team.id, teamName.trim());
      onTeamUpdated();
    } catch (err) {
      console.error("Failed to rename team:", err);
      setTeamName(team.name);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      console.error("Invalid file type");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.error("File too large");
      return;
    }

    setIsUploadingLogo(true);
    try {
      await teamAPI.uploadTeamLogo(team.id, file);
      onTeamUpdated();
    } catch (err) {
      console.error("Failed to upload logo:", err);
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    setIsRemovingLogo(true);
    try {
      await teamAPI.removeTeamLogo(team.id);
      onTeamUpdated();
    } catch (err) {
      console.error("Failed to remove logo:", err);
    } finally {
      setIsRemovingLogo(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await teamAPI.deleteTeam(team.id);
      onTeamDeleted();
      onClose();
    } catch (err) {
      console.error("Failed to delete team:", err);
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card
        classNames={{
          base: "bg-surface-elevated border border-border-base",
        }}
      >
        <CardHeader className="border-b border-border-base">
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:settings-bold-duotone"
              width={20}
              className="text-accent-400"
            />
            <h3 className="text-lg font-semibold text-text-primary">Team Settings</h3>
          </div>
        </CardHeader>
        <CardBody className="gap-6 p-6">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Team Name</label>
            <div className="flex gap-2">
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                classNames={{
                  input: "text-text-primary",
                }}
              />
              <Button
                color="primary"
                onPress={handleRename}
                isLoading={isRenaming}
                isDisabled={!teamName.trim() || teamName === team.name}
                className="bg-accent-400 text-white"
              >
                Save
              </Button>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border-base">
            <label className="text-sm text-text-secondary">Team Logo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <div
              onClick={() => !isUploadingLogo && fileInputRef.current?.click()}
              className="relative group cursor-pointer"
            >
              <div className="flex items-center gap-5 p-4 rounded-xl bg-surface-base border-2 border-dashed border-border-base hover:border-accent-400/50 hover:bg-accent-400/5 transition-all">
                <div className="relative">
                  <Avatar
                    src={team.logo_url}
                    name={team.name}
                    classNames={{
                      base: "w-20 h-20 bg-surface-elevated border-2 border-border-base group-hover:border-accent-400/30 transition-colors",
                      name: "text-xl font-semibold text-text-secondary",
                    }}
                  />
                  {isUploadingLogo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                      <Icon icon="solar:spinner-bold" className="text-white text-2xl animate-spin" />
                    </div>
                  )}
                  {!isUploadingLogo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded-full transition-all">
                      <Icon
                        icon="solar:camera-bold"
                        className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors">
                    {team.logo_url ? "Change logo" : "Upload a logo"}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Square image recommended • PNG, JPG up to 5MB
                  </p>
                </div>
                <Icon
                  icon="solar:upload-minimalistic-bold"
                  className="text-2xl text-text-tertiary group-hover:text-accent-400 transition-colors"
                />
              </div>
            </div>
            {team.logo_url && (
              <Button
                size="sm"
                variant="light"
                color="danger"
                onPress={handleRemoveLogo}
                isLoading={isRemovingLogo}
                startContent={!isRemovingLogo && <Icon icon="solar:trash-bin-trash-bold" width={14} />}
                className="mt-1"
              >
                Remove logo
              </Button>
            )}
          </div>

          <div className="pt-4 border-t border-border-base">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-text-primary">Danger Zone</h4>
              <p className="text-xs text-text-tertiary">
                Deleting this team will remove all members and data. This action cannot be
                undone.
              </p>
              <Button
                color="danger"
                variant="flat"
                onPress={onOpen}
                startContent={<Icon icon="solar:trash-bin-trash-bold-duotone" width={18} />}
              >
                Delete Team
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        classNames={{
          base: "bg-surface-base border border-border-base",
          header: "border-b border-border-base",
          footer: "border-t border-border-base",
        }}
      >
        <ModalContent>
          <ModalHeader className="text-text-primary">
            Delete Team
          </ModalHeader>
          <ModalBody className="py-6">
            <p className="text-text-secondary">
              Are you sure you want to delete <span className="font-semibold">{team.name}</span>?
              This will remove all members and data. This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={onClose}
              className="text-text-secondary"
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleDelete}
              isLoading={isDeleting}
            >
              Delete Team
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
