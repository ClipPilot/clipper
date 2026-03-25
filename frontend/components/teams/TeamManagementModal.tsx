"use client";

import { useState } from "react";
import {
  Modal,
  Button,
  Tabs,
  useOverlayState,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Team, teamAPI } from "@/api/team";
import { canInviteMembers } from "@/lib/plans";
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
  const inviteState = useOverlayState();
  const leaveState = useOverlayState();

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
      leaveState.close();
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
      <Modal>
        <Modal.Backdrop
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
        >
          <Modal.Container><Modal.Dialog className="sm:max-w-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <div className="flex items-center gap-2">
                  <Icon
                    icon="solar:users-group-rounded-bold-duotone"
                    width={24}
                    className="text-accent-400"
                  />
                  <Modal.Heading>Manage Team</Modal.Heading>
                </div>
              </Modal.Header>
              <Modal.Body>
                <Tabs
                  selectedKey={selectedTab}
                  onSelectionChange={(key) => setSelectedTab(key as string)}
                >
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="Team management tabs">
                      <Tabs.Tab id="members">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:users-group-rounded-bold-duotone" width={18} />
                          <span>Members</span>
                        </div>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      {isOwner && (
                        <Tabs.Tab id="settings">
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:settings-bold-duotone" width={18} />
                            <span>Settings</span>
                          </div>
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      )}
                    </Tabs.List>
                  </Tabs.ListContainer>
                  <Tabs.Panel id="members">
                    <div className="space-y-4 pt-4">
                      {canManage && (
                        <div className="flex flex-col gap-2 items-end">
                          <Button
                            variant="primary"
                            onPress={inviteState.open}
                            isDisabled={!canInviteMembers(team.plan)}
                            className="bg-accent-400 text-white"
                          >
                            <Icon icon="solar:user-plus-bold-duotone" width={18} />
                            Invite Member
                          </Button>
                          {!canInviteMembers(team.plan) && (
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
                  </Tabs.Panel>
                  {isOwner && (
                    <Tabs.Panel id="settings">
                      <div className="pt-4">
                        <TeamSettingsCard
                          team={team}
                          onTeamUpdated={onTeamUpdated}
                          onTeamDeleted={handleTeamDeleted}
                        />
                      </div>
                    </Tabs.Panel>
                  )}
                </Tabs>
              </Modal.Body>
              {!isOwner && (
                <Modal.Footer className="border-t border-border-base">
                  <Button
                    variant="danger-soft"
                    onPress={leaveState.open}
                  >
                    <Icon icon="solar:exit-bold-duotone" width={18} />
                    Leave Team
                  </Button>
                </Modal.Footer>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <InviteMemberModal
        isOpen={inviteState.isOpen}
        onClose={inviteState.close}
        teamId={team.id}
        onMemberAdded={handleMemberUpdated}
      />

      <Modal>
        <Modal.Backdrop isOpen={leaveState.isOpen} onOpenChange={leaveState.close}>
          <Modal.Container><Modal.Dialog className="sm:max-w-md">
              <Modal.CloseTrigger />
              <Modal.Header className="border-b border-border-base">
                <Modal.Heading>Leave Team</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="py-6">
                <p className="text-text-secondary">
                  Are you sure you want to leave{" "}
                  <span className="font-semibold">{team.name}</span>? You will
                  lose access to all team resources.
                </p>
              </Modal.Body>
              <Modal.Footer className="border-t border-border-base">
                <Button
                  variant="tertiary"
                  onPress={leaveState.close}
                  className="text-text-secondary"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={handleLeaveTeam}
                  isPending={isLeavingTeam}
                >
                  Leave Team
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
