"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  Avatar,
  Button,
  Spinner,
  Chip,
} from "@heroui/react";
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
      // Only show pending invites
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
        <Spinner color="primary" size="sm" />
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
        <Card
          key={invite.id}
          classNames={{
            base: "bg-surface-elevated border border-warning/20",
          }}
        >
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  size="md"
                  icon={<Icon icon="solar:letter-bold-duotone" width={20} />}
                  classNames={{
                    base: "bg-warning/20 text-warning",
                  }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">
                      {invite.email}
                    </p>
                    <Chip
                      size="sm"
                      color={getRoleColor(invite.role)}
                      variant="flat"
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
                    variant="flat"
                    color="primary"
                    isLoading={actionLoading === invite.id}
                    onPress={() => handleResendInvite(invite.id)}
                    startContent={
                      actionLoading !== invite.id && (
                        <Icon icon="solar:restart-bold-duotone" width={16} />
                      )
                    }
                  >
                    Resend
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    isLoading={actionLoading === invite.id}
                    onPress={() => handleRevokeInvite(invite.id)}
                    startContent={
                      actionLoading !== invite.id && (
                        <Icon icon="solar:close-circle-bold-duotone" width={16} />
                      )
                    }
                  >
                    Revoke
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
