"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  Avatar,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Spinner,
} from "@heroui/react";
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
        <DropdownItem
          key="promote-owner"
          startContent={
            <Icon
              icon="solar:crown-bold-duotone"
              width={18}
              className="text-yellow-500"
            />
          }
          onPress={() => handleChangeRole(member.id, "owner")}
        >
          Make Manager
        </DropdownItem>,
      );

      if (member.role !== "manager") {
        items.push(
          <DropdownItem
            key="promote-manager"
            startContent={
              <Icon
                icon="solar:user-check-bold-duotone"
                width={18}
                className="text-blue-500"
              />
            }
            onPress={() => handleChangeRole(member.id, "manager")}
          >
            Make Manager
          </DropdownItem>,
        );
      }

      if (member.role !== "member") {
        items.push(
          <DropdownItem
            key="demote"
            startContent={
              <Icon
                icon="solar:user-bold-duotone"
                width={18}
                className="text-text-tertiary"
              />
            }
            onPress={() => handleChangeRole(member.id, "member")}
          >
            Make Member
          </DropdownItem>,
        );
      }
    }

    // Only allow removing if: user is owner, OR (user is manager AND member is not owner)
    const canRemove =
      isOwner || (userRole === "manager" && member.role !== "owner");
    if (canRemove) {
      items.push(
        <DropdownItem
          key="remove"
          color="danger"
          startContent={
            <Icon icon="solar:trash-bin-trash-bold-duotone" width={18} />
          }
          onPress={() => handleRemoveMember(member.id)}
        >
          Remove from Team
        </DropdownItem>,
      );
    }

    return items;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Spinner color="primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <Card
          key={member.id}
          classNames={{
            base: "bg-surface-elevated border border-border-base",
          }}
        >
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  size="md"
                  name={`${member.firstName} ${member.lastName}`}
                  classNames={{
                    base: "bg-accent-400 text-white",
                  }}
                />
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
                      <DropdownTrigger>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="text-text-secondary"
                        >
                          <Icon
                            icon="solar:menu-dots-bold-duotone"
                            width={20}
                          />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Member actions"
                        classNames={{
                          base: "bg-surface-base border border-border-base",
                        }}
                      >
                        {getMenuItems(member)}
                      </DropdownMenu>
                    </Dropdown>
                  )}
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
