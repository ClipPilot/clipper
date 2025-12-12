"use client";

import { useState } from "react";
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
