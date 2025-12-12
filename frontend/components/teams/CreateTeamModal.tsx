"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { teamAPI } from "@/api/team";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamCreated: () => void;
}

export default function CreateTeamModal({
  isOpen,
  onClose,
  onTeamCreated,
}: CreateTeamModalProps) {
  const [teamName, setTeamName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!teamName.trim()) {
      setError("Team name is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await teamAPI.createTeam(teamName.trim());
      setTeamName("");
      onTeamCreated();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create team";
      setError(errorMessage);

      if (errorMessage.includes("subscription") || errorMessage.includes("Upgrade")) {
        setTimeout(() => {
          setError(errorMessage + " Please upgrade to create additional teams.");
        }, 0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTeamName("");
    setError("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      classNames={{
        base: "bg-surface-base border border-border-base",
        header: "border-b border-border-base",
        body: "py-6",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex gap-2 items-center text-text-primary">
          <Icon icon="solar:add-circle-bold-duotone" width={24} className="text-accent-400" />
          <span>Create New Team</span>
        </ModalHeader>
        <ModalBody>
          <Input
            label="Team Name"
            placeholder="Enter team name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            isInvalid={!!error}
            errorMessage={error}
            classNames={{
              input: "text-text-primary",
              label: "text-text-secondary",
            }}
            autoFocus
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="light"
            onPress={handleClose}
            className="text-text-secondary"
          >
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleCreate}
            isLoading={isLoading}
            className="bg-accent-400 text-white"
          >
            Create Team
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
