"use client";

import { useState } from "react";
import { Modal, Button, Input, TextField, Label, FieldError } from "@heroui/react";
import { Icon } from "@iconify/react";
import { teamAPI, Team } from "@/api/team";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamCreated: (team: Team) => void;
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
      const newTeam = await teamAPI.createTeam(teamName.trim());
      setTeamName("");
      onTeamCreated(newTeam);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create team";
      setError(msg.includes("subscription") || msg.includes("Upgrade")
        ? msg + " Please upgrade to create additional teams."
        : msg);
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
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-sm">
            <Modal.CloseTrigger />
            <Modal.Header className="items-center text-center">
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <Icon icon="solar:add-circle-bold-duotone" className="size-5" />
              </Modal.Icon>
              <Modal.Heading>Create New Team</Modal.Heading>
              <p className="text-sm text-muted">Give your team a name to get started.</p>
            </Modal.Header>
            <Modal.Body>
              <TextField className="w-full" isRequired isInvalid={!!error}>
                <Label className="text-sm font-medium text-text-secondary mb-1">Team Name</Label>
                <Input
                  className="w-full rounded-lg border border-border-base bg-surface-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-400/40 focus:border-accent-400 transition-colors"
                  placeholder="e.g. Marketing Team"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  autoFocus
                />
                {error && <FieldError>{error}</FieldError>}
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" className="flex-1 bg-white/[0.06] text-text-secondary hover:bg-white/[0.1]" onPress={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-accent-400 text-white"
                onPress={handleCreate}
                isPending={isLoading}
              >
                Create Team
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
