"use client";

import { useState, useEffect } from "react";
import { Card, Avatar, Button, Spinner, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { teamAPI, TeamInvite } from "@/api/team";

interface TeamInvitesListProps {
  teamId: number;
  userRole: "owner" | "manager" | "member";
  onInviteUpdated: () => void;
}

export default function TeamInvitesList({
  teamId,
  userRole,
  onInviteUpdated,
}: TeamInvitesListProps) {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchInvites();
  }, [teamId]);

  const fetchInvites = async () => {
    try {
      const data = await teamAPI.getTeamInvites(teamId);
      setInvites(data.filter((invite) => invite.status === "pending"));
    } catch (err) {
      console.error("Failed to fetch invites:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeInvite = async (inviteId: number) => {
    setActionLoading(inviteId);
    try {
      await teamAPI.revokeInvite(teamId, inviteId);
      await fetchInvites();
      onInviteUpdated();
    } catch (err) {
      console.error("Failed to revoke invite:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendInvite = async (inviteId: number) => {
    setActionLoading(inviteId);
    try {
      await teamAPI.resendInvite(teamId, inviteId);
      await fetchInvites();
    } catch (err) {
      console.error("Failed to resend invite:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "manager":
        return "primary";
      case "member":
      default:
        return "default";
    }
  };

  const canManage = userRole === "owner" || userRole === "manager";

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Spinner color="accent" size="sm" />
      </div>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Icon
          icon="solar:letter-bold-duotone"
          width={18}
          className="text-warning"
        />
        <span className="text-sm font-medium text-text-secondary">
          Pending Invites ({invites.length})
        </span>
      </div>
      {invites.map((invite) => (
        <Card key={invite.id}>
          <Card.Content className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar size="md" className="bg-accent-400 text-white">
                  <Avatar.Fallback className="font-semibold">
                    {invite.email.charAt(0).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">
                      {invite.email}
                    </p>
                    <Chip
                      size="sm"
                      color={getRoleColor(invite.role)}
                      variant="tertiary"
                      className="capitalize"
                    >
                      {invite.role}
                    </Chip>
                  </div>
                  <p className="text-xs text-text-tertiary">
                    Invited by {invite.invitedBy.firstName} {invite.invitedBy.lastName} &middot; Expires{" "}
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="tertiary"
                    isPending={actionLoading === invite.id}
                    onPress={() => handleResendInvite(invite.id)}
                  >
                    {actionLoading !== invite.id && (
                      <Icon icon="solar:restart-bold-duotone" width={16} />
                    )}
                    Resend
                  </Button>
                  <Button
                    size="sm"
                    variant="danger-soft"
                    isPending={actionLoading === invite.id}
                    onPress={() => handleRevokeInvite(invite.id)}
                  >
                    {actionLoading !== invite.id && (
                      <Icon icon="solar:close-circle-bold-duotone" width={16} />
                    )}
                    Revoke
                  </Button>
                </div>
              )}
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
