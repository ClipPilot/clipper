"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/sidebar/sidebar";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Dropdown,
  Popover,
  Button,
  Tooltip,
  Toast,
  cn,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import { sidebarCollapsedAtom } from "@/store/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useTeams } from "@/hooks/useTeams";
import WorkspaceSelector from "@/components/workspace-selector";
import CreateTeamModal from "@/components/teams/CreateTeamModal";
import TeamManagementModal from "@/components/teams/TeamManagementModal";
import Image from "next/image";
import { UsageStatsProvider } from "@/contexts/UsageStatsContext";
import CuttrLogo from "@/public/branding/cuttr_logo.png";
import CuttrIcon from "@/public/branding/cuttr logo svg.svg";
import { useTheme } from "next-themes";
import NotificationBellButton from "@/components/announcements/NotificationBellButton";
import AnnouncementInboxModal from "@/components/announcements/AnnouncementInboxModal";
import AnnouncementPopupModal from "@/components/announcements/AnnouncementPopupModal";
import { useAnnouncements } from "@/hooks/useAnnouncements";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user] = useAtom(userAtom);
  const { signOut: handleSignOut } = useAuth();
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const { fetchTeams, selectTeam } = useTeams();
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useAtom(sidebarCollapsedAtom);
  const [contentCollapsed, setContentCollapsed] = useState(isCollapsed);
  const expandTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(expandTimer.current);
    if (isCollapsed) {
      setContentCollapsed(true);
    } else {
      expandTimer.current = setTimeout(() => setContentCollapsed(false), 150);
    }
    return () => clearTimeout(expandTimer.current);
  }, [isCollapsed]);

  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const { fetchUnread } = useAnnouncements();

  const canViewPricing = true;

  const getTeamIcon = (role?: string) => {
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

  const getPlanBgColor = (plan?: string) => {
    switch (plan) {
      case "enterprise":
        return "bg-emerald-500";
      case "scale":
        return "bg-purple-500";
      case "studio":
        return "bg-accent-400";
      case "creator":
        return "bg-orange-500";
      default:
        return "bg-blue-500";
    }
  };

  const getInitials = (
    firstName?: string,
    lastName?: string,
    email?: string,
  ) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  const teamIconEl = selectedTeam?.logo_url ? (
    <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0">
      <img
        src={selectedTeam.logo_url}
        alt={selectedTeam.name}
        className="w-full h-full object-cover"
      />
    </div>
  ) : (
    <div
      className={`flex items-center justify-center w-7 h-7 rounded-md ${getPlanBgColor(selectedTeam?.plan)} text-white`}
    >
      <Icon icon={getTeamIcon(selectedTeam?.role)} width={14} />
    </div>
  );

  return (
    <UsageStatsProvider>
      <div className="flex h-screen bg-surface-dark">
        <aside
          className={cn(
            "relative bg-surface-base border-r border-border-base flex-shrink-0 flex flex-col transition-[width] duration-300 ease-in-out overflow-hidden",
            isCollapsed ? "w-[72px]" : "w-[256px]",
          )}
        >
          <div
            className={cn(
              "border-b border-border-base transition-[padding] duration-300",
              contentCollapsed ? "p-3" : "p-4",
            )}
          >
            <div
              className={cn(
                "flex items-center mb-3",
                contentCollapsed ? "justify-center" : "justify-between",
              )}
            >
              {contentCollapsed ? (
                <Tooltip>
                  <Tooltip.Trigger>
                    <div className="flex items-center justify-center w-8 h-8">
                      <Image
                        src={CuttrIcon}
                        alt="Cuttr"
                        width={28}
                        height={28}
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="right">Cuttr</Tooltip.Content>
                </Tooltip>
              ) : (
                <>
                  <Image
                    src={CuttrLogo}
                    alt="Cuttr"
                    width={100}
                    height={28}
                    className="object-contain"
                    unoptimized
                  />
                  <div className="flex items-center gap-1">
                    <NotificationBellButton />
                    <Button
                      isIconOnly
                      size="sm"
                      variant="tertiary"
                      className="text-text-secondary hover:text-text-primary"
                      onPress={() =>
                        setTheme(theme === "dark" ? "light" : "dark")
                      }
                    >
                      <Icon
                        icon={
                          theme === "dark"
                            ? "solar:sun-bold-duotone"
                            : "solar:moon-bold-duotone"
                        }
                        width={20}
                      />
                    </Button>
                  </div>
                </>
              )}
            </div>

            {contentCollapsed ? (
              <Popover
                isOpen={isWorkspaceOpen}
                onOpenChange={setIsWorkspaceOpen}
              >
                <Popover.Trigger>
                  <Button
                    variant="tertiary"
                    className="w-full flex items-center justify-center p-1 rounded-lg hover:bg-surface-elevated transition-colors"
                  >
                    {teamIconEl}
                  </Button>
                </Popover.Trigger>
                <Popover.Content className="p-0" placement="right top">
                  <WorkspaceSelector
                    onClose={() => setIsWorkspaceOpen(false)}
                    onCreateTeam={() => {
                      setIsWorkspaceOpen(false);
                      setIsCreateTeamOpen(true);
                    }}
                    onManageTeam={() => {
                      setIsWorkspaceOpen(false);
                      setIsManageTeamOpen(true);
                    }}
                  />
                </Popover.Content>
              </Popover>
            ) : (
              <Popover
                isOpen={isWorkspaceOpen}
                onOpenChange={setIsWorkspaceOpen}
              >
                <Popover.Trigger>
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="w-full justify-start bg-surface-elevated hover:bg-surface-hover h-auto py-1.5"
                  >
                    <div className="flex items-center gap-2.5 w-full">
                      {teamIconEl}
                      <span className="text-[13px] font-medium text-text-primary flex-1 text-left truncate">
                        {selectedTeam?.name || "Select Team"}
                      </span>
                      <Icon
                        icon="solar:alt-arrow-down-bold-duotone"
                        className="text-text-tertiary"
                        width={16}
                      />
                    </div>
                  </Button>
                </Popover.Trigger>
                <Popover.Content placement="bottom start" className="p-0">
                  <WorkspaceSelector
                    onClose={() => setIsWorkspaceOpen(false)}
                    onCreateTeam={() => {
                      setIsWorkspaceOpen(false);
                      setIsCreateTeamOpen(true);
                    }}
                    onManageTeam={() => {
                      setIsWorkspaceOpen(false);
                      setIsManageTeamOpen(true);
                    }}
                  />
                </Popover.Content>
              </Popover>
            )}
          </div>

          <div
            className={cn(
              "flex-1 overflow-y-auto transition-[padding] duration-300",
              contentCollapsed ? "p-2" : "p-3",
            )}
          >
            <Sidebar
              isCollapsed={contentCollapsed}
              canViewPricing={canViewPricing}
            />
          </div>

          <div
            className={cn(
              "border-t border-border-base transition-[padding] duration-300",
              contentCollapsed ? "p-2" : "p-3",
            )}
          >
            {contentCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <Dropdown>
                  <Dropdown.Trigger>
                    <Button
                      variant="tertiary"
                      className="rounded-lg hover:bg-surface-elevated transition-colors p-1"
                    >
                      <Avatar size="sm" className="bg-accent-400 text-white">
                        <Avatar.Fallback className="text-xs font-semibold">
                          {getInitials(
                            user?.firstName,
                            user?.lastName,
                            user?.email,
                          )}
                        </Avatar.Fallback>
                      </Avatar>
                    </Button>
                  </Dropdown.Trigger>
                  <Dropdown.Popover placement="right top">
                    <Dropdown.Menu aria-label="Account actions">
                      <Dropdown.Item
                        key="settings"
                        onPress={() => router.push("/dashboard/settings")}
                      >
                        <Icon
                          icon="solar:settings-bold-duotone"
                          width={18}
                          className="text-text-secondary"
                        />
                        Settings
                      </Dropdown.Item>
                      <Dropdown.Item
                        key="api-platform"
                        onPress={() => router.push("/dashboard/api-platform")}
                      >
                        <Icon
                          icon="solar:code-bold-duotone"
                          width={18}
                          className="text-text-secondary"
                        />
                        API Platform
                      </Dropdown.Item>
                      <Dropdown.Item
                        key="referrals"
                        onPress={() => router.push("/dashboard/referrals")}
                      >
                        <Icon
                          icon="solar:money-bag-bold-duotone"
                          width={18}
                          className="text-amber-500"
                        />
                        Referral Program
                      </Dropdown.Item>
                      {canViewPricing ? (
                        <Dropdown.Item
                          key="pricing"
                          onPress={() => router.push("/dashboard/pricing")}
                        >
                          <Icon
                            icon="solar:wallet-bold-duotone"
                            width={18}
                            className="text-text-secondary"
                          />
                          Pricing
                        </Dropdown.Item>
                      ) : null}
                      <Dropdown.Item
                        key="logout"
                        variant="danger"
                        onPress={handleSignOut}
                      >
                        <Icon icon="solar:logout-2-bold-duotone" width={18} />
                        Sign Out
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>

                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      isIconOnly
                      variant="tertiary"
                      size="sm"
                      onPress={() => setIsCollapsed(!isCollapsed)}
                      className="p-2 rounded-lg hover:bg-surface-elevated transition-colors text-text-tertiary hover:text-text-primary"
                    >
                      <Icon
                        icon="solar:alt-arrow-right-bold-duotone"
                        width={18}
                      />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="right">
                    Expand sidebar
                  </Tooltip.Content>
                </Tooltip>
              </div>
            ) : (
              <Dropdown>
                <Dropdown.Trigger>
                  <Button
                    variant="tertiary"
                    className="w-full h-auto p-2 justify-start bg-surface-elevated hover:bg-surface-hover transition-all"
                  >
                    <div className="flex items-center gap-2.5 w-full">
                      <Avatar size="sm" className="bg-accent-400 text-white">
                        <Avatar.Fallback className="text-sm font-semibold">
                          {getInitials(
                            user?.firstName,
                            user?.lastName,
                            user?.email,
                          )}
                        </Avatar.Fallback>
                      </Avatar>
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <span className="text-sm font-semibold text-text-primary truncate w-full">
                          {user?.firstName && user?.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user?.email?.split("@")[0] || "User"}
                        </span>
                        <span className="text-xs text-text-tertiary truncate w-full">
                          {user?.email}
                        </span>
                      </div>
                      <Icon
                        icon="solar:alt-arrow-up-bold-duotone"
                        className="text-text-tertiary flex-shrink-0"
                        width={18}
                      />
                    </div>
                  </Button>
                </Dropdown.Trigger>
                <Dropdown.Popover placement="top start">
                  <Dropdown.Menu aria-label="Account actions">
                    <Dropdown.Item
                      key="settings"
                      onPress={() => router.push("/dashboard/settings")}
                    >
                      <Icon
                        icon="solar:settings-bold-duotone"
                        width={18}
                        className="text-text-secondary"
                      />
                      Settings
                    </Dropdown.Item>
                    <Dropdown.Item
                      key="api-platform"
                      onPress={() => router.push("/dashboard/api-platform")}
                    >
                      <Icon
                        icon="solar:code-bold-duotone"
                        width={18}
                        className="text-text-secondary"
                      />
                      API Platform
                    </Dropdown.Item>
                    <Dropdown.Item
                      key="referrals"
                      onPress={() => router.push("/dashboard/referrals")}
                    >
                      <Icon
                        icon="solar:money-bag-bold-duotone"
                        width={18}
                        className="text-amber-500"
                      />
                      Referral Program
                    </Dropdown.Item>
                    {canViewPricing ? (
                      <Dropdown.Item
                        key="pricing"
                        onPress={() => router.push("/dashboard/pricing")}
                      >
                        <Icon
                          icon="solar:wallet-bold-duotone"
                          width={18}
                          className="text-text-secondary"
                        />
                        Pricing
                      </Dropdown.Item>
                    ) : null}
                    <Dropdown.Item
                      key="logout"
                      variant="danger"
                      onPress={handleSignOut}
                    >
                      <Icon icon="solar:logout-2-bold-duotone" width={18} />
                      Sign Out
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          {selectedTeam?.plan === "free" && (
            <div className="bg-gradient-to-r from-accent-400/10 via-purple-500/10 to-accent-400/10 border-b border-accent-400/20">
              <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon
                    icon="solar:star-bold-duotone"
                    className="text-accent-400 flex-shrink-0"
                    width={18}
                  />
                  <p className="text-sm text-text-secondary">
                    Upgrade your workspace for more credits and features.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-accent-400 text-white font-semibold flex-shrink-0"
                  onPress={() => router.push("/dashboard/pricing")}
                >
                  Upgrade
                </Button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
      <Toast.Provider placement="top end" />

      <AnnouncementInboxModal />
      <AnnouncementPopupModal />

      <CreateTeamModal
        isOpen={isCreateTeamOpen}
        onClose={() => setIsCreateTeamOpen(false)}
        onTeamCreated={(newTeam) => {
          fetchTeams();
          selectTeam(newTeam);
        }}
      />

      {selectedTeam && (
        <TeamManagementModal
          isOpen={isManageTeamOpen}
          onClose={() => setIsManageTeamOpen(false)}
          team={selectedTeam}
          onTeamUpdated={fetchTeams}
          onTeamDeleted={fetchTeams}
        />
      )}
    </UsageStatsProvider>
  );
}
