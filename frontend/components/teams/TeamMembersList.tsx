"use client";

import { useState, useEffect } from "react";
import { Card, Avatar, Button, Dropdown, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { teamAPI, TeamMember } from "@/api/team";
import { useAtom } from "jotai";
import { userAtom } from "@/store/auth";

interface TeamMembersListProps {
  teamId: number;
  userRole: "owner" | "manager" | "member";
  onMemberUpdated: () => void;
}

export default function TeamMembersList({
  teamId,
  userRole,
  onMemberUpdated,
}: TeamMembersListProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user] = useAtom(userAtom);

  useEffect(() => {
    fetchMembers();
  }, [teamId]);

  const fetchMembers = async () => {
    try {
      const data = await teamAPI.getTeamMembers(teamId);
      setMembers(data);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      await teamAPI.removeTeamMember(teamId, memberId);
      await fetchMembers();
      onMemberUpdated();
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  const handleChangeRole = async (
    memberId: number,
    newRole: "owner" | "manager" | "member",
  ) => {
    try {
      await teamAPI.updateTeamMemberRole(teamId, memberId, newRole);
      await fetchMembers();
      onMemberUpdated();
    } catch (err) {
      console.error("Failed to change role:", err);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return "solar:crown-bold-duotone";
      case "manager":
        return "solar:user-check-bold-duotone";
      case "member":
      default:
        return "solar:user-bold-duotone";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "text-yellow-500";
      case "manager":
        return "text-blue-500";
      case "member":
      default:
        return "text-text-tertiary";
    }
  };

  const canManage = userRole === "owner" || userRole === "manager";
  const isOwner = userRole === "owner";

  const getMenuItems = (member: TeamMember) => {
    const items = [];

    if (isOwner && member.role !== "owner") {
      items.push(
        <Dropdown.Item
          key="promote-owner"
          onPress={() => handleChangeRole(member.id, "owner")}
        >
          <Icon
            icon="solar:crown-bold-duotone"
            width={18}
            className="text-yellow-500"
          />
          Make Owner
        </Dropdown.Item>,
      );

      if (member.role !== "manager") {
        items.push(
          <Dropdown.Item
            key="promote-manager"
            onPress={() => handleChangeRole(member.id, "manager")}
          >
            <Icon
              icon="solar:user-check-bold-duotone"
              width={18}
              className="text-blue-500"
            />
            Make Manager
          </Dropdown.Item>,
        );
      }

      if (member.role !== "member") {
        items.push(
          <Dropdown.Item
            key="demote"
            onPress={() => handleChangeRole(member.id, "member")}
          >
            <Icon
              icon="solar:user-bold-duotone"
              width={18}
              className="text-text-tertiary"
            />
            Make Member
          </Dropdown.Item>,
        );
      }
    }

    const canRemove =
      isOwner || (userRole === "manager" && member.role !== "owner");
    if (canRemove) {
      items.push(
        <Dropdown.Item
          key="remove"
          className="text-red-500"
          onPress={() => handleRemoveMember(member.id)}
        >
          <Icon icon="solar:trash-bin-trash-bold-duotone" width={18} />
          Remove from Team
        </Dropdown.Item>,
      );
    }

    return items;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Spinner color="accent" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <Card key={member.id}>
          <Card.Content className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar size="md" className="bg-accent-400 text-white">
                  <Avatar.Fallback className="font-semibold">
                    {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                  </Avatar.Fallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">
                      {member.firstName} {member.lastName}
                      {user?.id && member.userId === parseInt(user.id) && (
                        <span className="text-xs text-text-tertiary ml-2">
                          (You)
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-xs text-text-tertiary">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Icon
                    icon={getRoleIcon(member.role)}
                    width={16}
                    className={getRoleColor(member.role)}
                  />
                  <span className="text-sm text-text-secondary capitalize">
                    {member.role}
                  </span>
                </div>

                {canManage &&
                  user?.id &&
                  member.userId !== parseInt(user.id) && (
                    <Dropdown>
                      <Button isIconOnly size="sm" variant="tertiary" className="text-text-secondary">
                        <Icon
                          icon="solar:menu-dots-bold-duotone"
                          width={20}
                        />
                      </Button>
                      <Dropdown.Popover>
                        <Dropdown.Menu
                          aria-label="Member actions"
                          className="bg-surface-base border border-border-base"
                        >
                          {getMenuItems(member)}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  )}
              </div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
