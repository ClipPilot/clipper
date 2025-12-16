"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Tabs,
  Tab,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Team, teamAPI } from "@/api/team";
import TeamMembersList from "./TeamMembersList";
import TeamInvitesList from "./TeamInvitesList";
import TeamSettingsCard from "./TeamSettingsCard";
import InviteMemberModal from "./InviteMemberModal";

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team;
  onTeamUpdated: () => void;
  onTeamDeleted: () => void;
}

export default function TeamManagementModal({
  isOpen,
  onClose,
  team,
  onTeamUpdated,
  onTeamDeleted,
}: TeamManagementModalProps) {
  const [selectedTab, setSelectedTab] = useState("members");
  const [isLeavingTeam, setIsLeavingTeam] = useState(false);
  const {
    isOpen: isInviteOpen,
    onOpen: onInviteOpen,
    onClose: onInviteClose,
  } = useDisclosure();
  const {
    isOpen: isLeaveOpen,
    onOpen: onLeaveOpen,
    onClose: onLeaveClose,
  } = useDisclosure();

  const handleMemberUpdated = () => {
    onTeamUpdated();
  };

  const handleTeamDeleted = () => {
    onTeamDeleted();
    onClose();
  };

  const handleLeaveTeam = async () => {
    setIsLeavingTeam(true);
    try {
      await teamAPI.leaveTeam(team.id);
      onTeamUpdated();
      onLeaveClose();
      onClose();
    } catch (err) {
      console.error("Failed to leave team:", err);
      setIsLeavingTeam(false);
    }
  };

  const canManage = team.role === "owner" || team.role === "manager";
  const isOwner = team.role === "owner";

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="3xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-surface-base border border-border-base",
          header: "border-b border-border-base",
          body: "p-6",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                icon="solar:users-group-rounded-bold-duotone"
                width={24}
                className="text-accent-400"
              />
              <span className="text-text-primary">Manage Team</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <Tabs
              selectedKey={selectedTab}
              onSelectionChange={(key) => setSelectedTab(key as string)}
              classNames={{
                tabList: "bg-surface-elevated",
                cursor: "bg-accent-400",
                tab: "text-text-secondary data-[selected=true]:text-text-primary",
              }}
            >
              <Tab
                key="members"
                title={
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:users-group-rounded-bold-duotone" width={18} />
                    <span>Members</span>
                  </div>
                }
              >
                <div className="space-y-4 pt-4">
                  {canManage && (
                    <div className="flex flex-col gap-2 items-end">
                      <Button
                        color="primary"
                        onPress={onInviteOpen}
                        isDisabled={team.plan !== "scale"}
                        startContent={
                          <Icon icon="solar:user-plus-bold-duotone" width={18} />
                        }
                        className="bg-accent-400 text-white"
                      >
                        Invite Member
                      </Button>
                      {team.plan !== "scale" && (
                        <p className="text-xs text-text-tertiary">
                          Upgrade to Scale to invite team members
                        </p>
                      )}
                    </div>
                  )}
                  {canManage && (
                    <TeamInvitesList
                      teamId={team.id}
                      userRole={team.role}
                      onInviteUpdated={handleMemberUpdated}
                    />
                  )}
                  <TeamMembersList
                    teamId={team.id}
                    userRole={team.role}
                    onMemberUpdated={handleMemberUpdated}
                  />
                </div>
              </Tab>

              {isOwner && (
                <Tab
                  key="settings"
                  title={
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:settings-bold-duotone" width={18} />
                      <span>Settings</span>
                    </div>
                  }
                >
                  <div className="pt-4">
                    <TeamSettingsCard
                      team={team}
                      onTeamUpdated={onTeamUpdated}
                      onTeamDeleted={handleTeamDeleted}
                    />
                  </div>
                </Tab>
              )}
            </Tabs>
          </ModalBody>
          {!isOwner && (
            <ModalFooter className="border-t border-border-base">
              <Button
                variant="light"
                color="danger"
                onPress={onLeaveOpen}
                startContent={<Icon icon="solar:exit-bold-duotone" width={18} />}
              >
                Leave Team
              </Button>
            </ModalFooter>
          )}
        </ModalContent>
      </Modal>

      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={onInviteClose}
        teamId={team.id}
        onMemberAdded={handleMemberUpdated}
      />

      <Modal
        isOpen={isLeaveOpen}
        onClose={onLeaveClose}
        classNames={{
          base: "bg-surface-base border border-border-base",
          header: "border-b border-border-base",
          footer: "border-t border-border-base",
        }}
      >
        <ModalContent>
          <ModalHeader className="text-text-primary">Leave Team</ModalHeader>
          <ModalBody className="py-6">
            <p className="text-text-secondary">
              Are you sure you want to leave <span className="font-semibold">{team.name}</span>?
              You will lose access to all team resources.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={onLeaveClose}
              className="text-text-secondary"
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleLeaveTeam}
              isLoading={isLeavingTeam}
            >
              Leave Team
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
