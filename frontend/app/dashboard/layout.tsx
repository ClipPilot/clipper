"use client";

import React, { useState, useEffect, useMemo } from "react";
import Sidebar, { SidebarItem } from "@/components/sidebar/sidebar";
import { useRouter, usePathname } from "next/navigation";
import {
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  // Badge, // TODO: Re-enable with notifications
  ToastProvider,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import { useAuth } from "@/hooks/useAuth";
import { useTeams } from "@/hooks/useTeams";
import WorkspaceSelector from "@/components/workspace-selector";
import CreateTeamModal from "@/components/teams/CreateTeamModal";
import TeamManagementModal from "@/components/teams/TeamManagementModal";
import Image from "next/image";
// import NotificationsCard from "@/components/notifications/notifications-card"; // TODO: Re-enable
import { UsageStatsProvider } from "@/contexts/UsageStatsContext";
import CuttrLogo from "@/public/branding/cuttr_logo.png";
import { useTheme } from "next-themes";
import NotificationBellButton from "@/components/announcements/NotificationBellButton";
import AnnouncementInboxModal from "@/components/announcements/AnnouncementInboxModal";
import AnnouncementPopupModal from "@/components/announcements/AnnouncementPopupModal";
import { useAnnouncements } from "@/hooks/useAnnouncements";

const baseSidebarItems: SidebarItem[] = [
  {
    key: "home",
    title: "Home",
    icon: "solar:home-2-bold-duotone",
    href: "/dashboard",
  },
  {
    key: "clips",
    title: "Library",
    icon: "solar:video-library-bold-duotone",
    href: "/dashboard/clips",
  },
  {
    key: "create-clip",
    title: "AI Clipping",
    icon: "solar:scissors-bold-duotone",
    href: "/dashboard/create-clip",
  },
  {
    key: "ugc-studio",
    title: "UGC Studio",
    icon: "solar:video-frame-play-vertical-bold-duotone",
    href: "/dashboard/ugc-studio",
  }
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user] = useAtom(userAtom);
  const { signOut: handleSignOut } = useAuth();
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const { fetchTeams } = useTeams();
  const { theme, setTheme } = useTheme();
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const { fetchUnread } = useAnnouncements();

  const canViewPricing =
    selectedTeam?.role === "owner" || selectedTeam?.role === "manager";
  const sidebarItems = baseSidebarItems;

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
      default:
        return "bg-blue-500";
    }
  };

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 400) {
      setSidebarWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  const getInitials = (
    firstName?: string,
    lastName?: string,
    email?: string
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
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove as any);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove as any);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove as any);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Fetch announcements on mount
  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Use startsWith for nested routes (e.g., /dashboard/ugc-studio/face-swap should highlight ugc-studio)
  // Sort by href length descending to match most specific route first
  // Return empty string for pages not in sidebar (e.g., referrals, usage) so nothing is highlighted
  const currentKey =
    [...sidebarItems]
      .sort((a, b) => (b.href?.length || 0) - (a.href?.length || 0))
      .find((item) => item.href && pathname.startsWith(item.href))?.key || "";

  return (
    <UsageStatsProvider>
      <div className="flex h-screen bg-surface-dark">
        <aside
          className="relative bg-surface-base border-r border-border-base flex-shrink-0 flex flex-col"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="p-4 border-b border-border-base">
            <div className="flex items-center justify-between mb-4">
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
                  variant="light"
                  className="text-text-secondary hover:text-text-primary"
                  onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <Icon
                    icon={theme === "dark" ? "solar:sun-bold-duotone" : "solar:moon-bold-duotone"}
                    width={20}
                  />
                </Button>
              </div>
            </div>

            <Popover
              placement="bottom-start"
              isOpen={isWorkspaceOpen}
              onOpenChange={setIsWorkspaceOpen}
            >
              <PopoverTrigger>
                <Button
                  variant="flat"
                  className="w-full justify-start bg-surface-elevated hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-3 w-full">
                    {selectedTeam?.logo_url ? (
                      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={selectedTeam.logo_url}
                          alt={selectedTeam.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${getPlanBgColor(selectedTeam?.plan)} text-white`}>
                        <Icon icon={getTeamIcon(selectedTeam?.role)} width={16} />
                      </div>
                    )}
                    <span className="text-sm font-medium text-text-primary flex-1 text-left truncate">
                      {selectedTeam?.name || "Select Team"}
                    </span>
                    <Icon
                      icon="solar:alt-arrow-down-bold-duotone"
                      className="text-text-tertiary"
                      width={16}
                    />
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0">
                <WorkspaceSelector
                  onCreateTeam={() => {
                    setIsWorkspaceOpen(false);
                    setIsCreateTeamOpen(true);
                  }}
                  onManageTeam={() => {
                    setIsWorkspaceOpen(false);
                    setIsManageTeamOpen(true);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            <Sidebar
              items={sidebarItems}
              defaultSelectedKey={currentKey}
              canViewPricing={canViewPricing}
              onSelect={(key) => {
                const item = sidebarItems.find((item) => item.key === key);
                if (item?.href) {
                  router.push(item.href);
                }
              }}
            />
          </div>

          <div className="p-4 border-t border-border-base">
            <Dropdown placement="top-start">
              <DropdownTrigger>
                <Button
                  variant="flat"
                  className="w-full h-auto p-3 justify-start bg-surface-elevated hover:bg-surface-hover transition-all"
                >
                  <div className="flex items-center gap-3 w-full">
                    <Avatar
                      size="md"
                      name={getInitials(
                        user?.firstName,
                        user?.lastName,
                        user?.email
                      )}
                      classNames={{
                        base: "bg-accent-400 text-white flex-shrink-0",
                        name: "text-sm font-semibold",
                      }}
                    />
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
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Account actions"
                classNames={{
                  base: "bg-surface-base border border-border-base",
                  list: "gap-1 p-2",
                }}
              >
                <DropdownItem
                  key="settings"
                  startContent={
                    <Icon
                      icon="solar:settings-bold-duotone"
                      width={20}
                      className="text-text-secondary"
                    />
                  }
                  onPress={() => router.push("/dashboard/settings")}
                  classNames={{
                    base: "rounded-lg hover:bg-surface-elevated",
                    title: "text-text-primary font-medium",
                  }}
                >
                  Settings
                </DropdownItem>
                {canViewPricing ? (
                  <DropdownItem
                    key="pricing"
                    startContent={
                      <Icon
                        icon="solar:wallet-bold-duotone"
                        width={20}
                        className="text-text-secondary"
                      />
                    }
                    onPress={() => router.push("/dashboard/pricing")}
                    classNames={{
                      base: "rounded-lg hover:bg-surface-elevated",
                      title: "text-text-primary font-medium",
                    }}
                  >
                    Pricing
                  </DropdownItem>
                ) : null}
                <DropdownItem
                  key="logout"
                  color="danger"
                  startContent={
                    <Icon icon="solar:logout-2-bold-duotone" width={20} />
                  }
                  onPress={handleSignOut}
                  classNames={{
                    base: "rounded-lg data-[hover=true]:bg-red-500/10",
                  }}
                >
                  Sign Out
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>

          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent-400 transition-colors"
            onMouseDown={handleMouseDown}
          />
        </aside>

        <main className="flex-1 overflow-auto">{children}</main>
        <ToastProvider placement="top-right" />
      </div>

      <AnnouncementInboxModal />
      <AnnouncementPopupModal />

      <CreateTeamModal
        isOpen={isCreateTeamOpen}
        onClose={() => setIsCreateTeamOpen(false)}
        onTeamCreated={fetchTeams}
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
