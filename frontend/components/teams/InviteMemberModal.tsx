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
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { teamAPI } from "@/api/team";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  onMemberAdded: () => void;
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  teamId,
  onMemberAdded,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "member">("member");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInvite = async () => {
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await teamAPI.addTeamMember(teamId, email.trim(), role);
      setEmail("");
      setRole("member");
      onMemberAdded();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add member";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setRole("member");
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
          <Icon icon="solar:user-plus-bold-duotone" width={24} className="text-accent-400" />
          <span>Invite Team Member</span>
        </ModalHeader>
        <ModalBody className="gap-4">
          <Input
            type="email"
            label="Email Address"
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            isInvalid={!!error}
            errorMessage={error}
            classNames={{
              input: "text-text-primary",
              label: "text-text-secondary",
            }}
            autoFocus
          />
          <Select
            label="Role"
            selectedKeys={[role]}
            onChange={(e) => setRole(e.target.value as "manager" | "member")}
            classNames={{
              trigger: "bg-surface-elevated",
              label: "text-text-secondary",
              value: "text-text-primary",
            }}
          >
            <SelectItem key="member">
              Member
            </SelectItem>
            <SelectItem key="manager">
              Manager
            </SelectItem>
          </Select>
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
            onPress={handleInvite}
            isLoading={isLoading}
            className="bg-accent-400 text-white"
          >
            Send Invite
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
