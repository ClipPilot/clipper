"use client";

import React, { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ScrollShadow,
  Avatar,
  cn,
  type CardProps,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { useTeams } from "@/hooks/useTeams";
import CreateTeamModal from "./teams/CreateTeamModal";
import TeamManagementModal from "./teams/TeamManagementModal";

export default function WorkspaceSelector(props: CardProps) {
  const { teams, isLoading, fetchTeams } = useTeams();
  const [selectedTeam, setSelectedTeam] = useAtom(selectedTeamAtom);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

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

  const handleTeamCreated = async () => {
    await fetchTeams();
  };

  const handleTeamUpdated = async () => {
    await fetchTeams();
  };

  const handleTeamDeleted = async () => {
    await fetchTeams();
    if (teams.length > 0) {
      setSelectedTeam(teams[0]);
    } else {
      setSelectedTeam(null);
    }
  };

  return (
    <>
    <Card className="w-full max-w-[320px] bg-surface-base border border-border-base" {...props}>
      <CardHeader className="flex flex-col px-0 pb-0">
        <div className="flex w-full items-center justify-between px-5 py-3 border-b border-border-base">
          <h4 className="text-medium font-semibold text-text-primary">Switch Team</h4>
        </div>
      </CardHeader>
      <CardBody className="w-full gap-0 p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-text-tertiary">Loading teams...</span>
          </div>
        ) : teams.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-text-tertiary">No teams found</span>
          </div>
        ) : (
          <ScrollShadow className="max-h-[300px] w-full">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team)}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-3 border-b border-border-base transition-colors hover:bg-surface-elevated",
                  {
                    "bg-accent-400/10": selectedTeam?.id === team.id,
                  }
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg",
                  selectedTeam?.id === team.id ? "bg-accent-400 text-white" : "bg-surface-elevated text-text-tertiary"
                )}>
                  <Icon icon={getRoleIcon(team.role)} width={20} />
                </div>
                <div className="flex-1 flex flex-col items-start">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium truncate max-w-[130px]",
                      selectedTeam?.id === team.id ? "text-accent-400" : "text-text-primary"
                    )}>
                      {team.name}
                    </span>
                    {team.type === "personal" && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                        Free
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-text-tertiary capitalize">
                    {team.role}
                  </span>
                </div>
                {selectedTeam?.id === team.id && (
                  <Icon icon="solar:check-circle-bold" className="text-accent-400" width={20} />
                )}
              </button>
            ))}
          </ScrollShadow>
        )}
      </CardBody>
      <div className="px-4 py-3 border-t border-border-base space-y-2">
        <Button
          variant="flat"
          className="w-full bg-accent-400/10 text-accent-400 hover:bg-accent-400/20"
          startContent={<Icon icon="solar:add-circle-bold-duotone" width={18} />}
          onPress={() => setIsCreateModalOpen(true)}
        >
          Create Team
        </Button>
        {selectedTeam && (
          <Button
            variant="light"
            className="w-full text-text-secondary"
            startContent={<Icon icon="solar:settings-bold-duotone" width={18} />}
            onPress={() => setIsManageModalOpen(true)}
          >
            Manage Team
          </Button>
        )}
      </div>
    </Card>

    <CreateTeamModal
      isOpen={isCreateModalOpen}
      onClose={() => setIsCreateModalOpen(false)}
      onTeamCreated={handleTeamCreated}
    />

    {selectedTeam && (
      <TeamManagementModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        team={selectedTeam}
        onTeamUpdated={handleTeamUpdated}
        onTeamDeleted={handleTeamDeleted}
      />
    )}
    </>
  );
}
