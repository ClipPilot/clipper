"use client";

import { Avatar, Button, Chip, Dropdown } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtom, useAtomValue } from "jotai";
import { selectedTeamAtom, userTeamsAtom } from "@/store/auth";
import { WidgetWrapper } from "../WidgetWrapper";

interface TeamWidgetProps {
  color?: string;
  onColorChange?: (color: string) => void;
}

export function TeamWidget({ color, onColorChange }: TeamWidgetProps) {
  const [selectedTeam, setSelectedTeam] = useAtom(selectedTeamAtom);
  const userTeams = useAtomValue(userTeamsAtom);

  const getRoleColor = (role: string): "warning" | "accent" | "default" => {
    switch (role) {
      case "owner":
        return "warning";
      case "manager":
        return "accent";
      default:
        return "default";
    }
  };

  const getTeamTypeIcon = (type: string) => {
    switch (type) {
      case "enterprise":
        return "solar:buildings-bold";
      case "business":
        return "solar:building-bold";
      default:
        return "solar:user-bold";
    }
  };

  return (
    <WidgetWrapper
      id="team"
      title="Team"
      icon="solar:users-group-rounded-bold"
      color={color}
      onColorChange={onColorChange}
    >
      <div className="flex flex-col gap-4 h-full justify-between">
        <div className="flex items-center gap-3">
          <Avatar
 size="lg"
 className="flex-shrink-0"
 />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary truncate">
              {selectedTeam?.name || "No Team"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Chip
 size="sm"
 color={getRoleColor(selectedTeam?.role || "member")}
 variant="tertiary"
 className="capitalize"
 >
                {selectedTeam?.role || "member"}
              </Chip>
              <Icon
                icon={getTeamTypeIcon(selectedTeam?.type || "personal")}
                width={14}
                className="text-text-tertiary"
              />
            </div>
          </div>
        </div>

        {userTeams.length > 1 && (
          <Dropdown>
            <Button size="sm" variant="tertiary" className="w-full">
              Switch Team
              <Icon icon="solar:alt-arrow-down-linear" width={14} />
            </Button>
            <Dropdown.Popover>

<Dropdown.Menu
              aria-label="Switch team"
              onAction={(key) => {
                const team = userTeams.find((t) => t.id.toString() === key);
                if (team) setSelectedTeam(team);
              }}
            >
              {userTeams.map((team) => (
                <Dropdown.Item
                  key={team.id.toString()}
                  className={team.id === selectedTeam?.id ? "bg-surface-hover" : ""}
                >
                  <Avatar size="sm" className="w-6 h-6" />
                  {team.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
</Dropdown.Popover>
          </Dropdown>
        )}
      </div>
    </WidgetWrapper>
  );
}
