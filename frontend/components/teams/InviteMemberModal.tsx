"use client";

import { useState } from "react";
import { Modal, Button, Input, TextField, Label, FieldError } from "@heroui/react";
import { Icon } from "@iconify/react";
import { teamAPI } from "@/api/team";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  onMemberAdded: () => void;
}

const ROLES = [
  { id: "member", label: "Member", desc: "Can view and create clips" },
  { id: "manager", label: "Manager", desc: "Can manage members and settings" },
];

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
    if (!email.trim()) { setError("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Please enter a valid email"); return; }
    setIsLoading(true);
    setError("");
    try {
      await teamAPI.createInvite(teamId, email.trim(), role);
      setSuccess(true);
      setTimeout(() => {
        setEmail(""); setRole("member"); setSuccess(false);
        onMemberAdded(); onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail(""); setRole("member"); setError(""); setSuccess(false); onClose();
  };

  const selectedRole = ROLES.find((r) => r.id === role)!;

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header className="items-center text-center">
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <Icon icon="solar:user-plus-bold-duotone" className="size-5" />
              </Modal.Icon>
              <Modal.Heading>Invite Team Member</Modal.Heading>
              <p className="text-sm text-muted">They&apos;ll receive an email with a link to join.</p>
            </Modal.Header>
            <Modal.Body>
              {success ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Icon icon="solar:check-circle-bold" width={32} className="text-green-500" />
                  </div>
                  <p className="font-medium text-text-primary">Invitation sent!</p>
                  <p className="text-text-secondary text-sm text-center">
                    We&apos;ve sent an email to {email}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <TextField className="w-full" type="email" isInvalid={!!error}>
                    <Label className="text-sm font-medium text-text-secondary mb-1">Email Address</Label>
                    <Input
                      className="w-full rounded-lg border border-border-base bg-surface-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-400/40 focus:border-accent-400 transition-colors"
                      placeholder="colleague@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                    />
                    {error && <FieldError>{error}</FieldError>}
                  </TextField>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-text-secondary">Role</label>
                    <div className="flex gap-2">
                      {ROLES.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRole(r.id as "manager" | "member")}
                          className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-all ${
                            role === r.id
                              ? "border-accent-400 bg-accent-400/10 ring-1 ring-accent-400/30"
                              : "border-border-base bg-surface-elevated hover:border-border-light"
                          }`}
                        >
                          <span className={`text-sm font-medium ${role === r.id ? "text-accent-400" : "text-text-primary"}`}>
                            {r.label}
                          </span>
                          <p className="text-xs text-text-tertiary mt-0.5">{r.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Modal.Body>
            {!success && (
              <Modal.Footer>
                <Button slot="close" variant="secondary" className="flex-1" onPress={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 bg-accent-400 text-white"
                  onPress={handleInvite}
                  isPending={isLoading}
                >
                  <Icon icon="solar:letter-bold" width={16} />
                  Send Invite
                </Button>
              </Modal.Footer>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
