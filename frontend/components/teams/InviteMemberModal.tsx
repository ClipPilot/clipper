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
  const [success, setSuccess] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await teamAPI.createInvite(teamId, email.trim(), role);
      setSuccess(true);
      setTimeout(() => {
        setEmail("");
        setRole("member");
        setSuccess(false);
        onMemberAdded();
        onClose();
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send invite";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setRole("member");
    setError("");
    setSuccess(false);
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
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-status-success/20 flex items-center justify-center">
                <Icon icon="solar:check-circle-bold" width={32} className="text-status-success" />
              </div>
              <p className="text-text-primary font-medium">Invitation sent!</p>
              <p className="text-text-secondary text-sm text-center">
                We've sent an email invitation to {email}
              </p>
            </div>
          ) : (
            <>
              <p className="text-text-secondary text-sm">
                Enter the email address of the person you'd like to invite. They'll receive an email with a link to join your workspace.
              </p>
              <Input
                type="email"
                label="Email Address"
                placeholder="colleague@example.com"
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
                <SelectItem key="member" description="Can view and create clips">
                  Member
                </SelectItem>
                <SelectItem key="manager" description="Can manage members and settings">
                  Manager
                </SelectItem>
              </Select>
            </>
          )}
        </ModalBody>
        {!success && (
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
        )}
      </ModalContent>
    </Modal>
  );
}
