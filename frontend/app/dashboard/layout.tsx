"use client";

import React, { useState, useEffect } from "react";
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
  Badge,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import { useAuth } from "@/hooks/useAuth";
import { useTeams } from "@/hooks/useTeams";
import WorkspaceSelector from "@/components/workspace-selector";
import NotificationsCard from "@/components/notifications/notifications-card";

const sidebarItems: SidebarItem[] = [
  {
    key: "home",
    title: "Home",
    icon: "solar:home-2-bold-duotone",
    href: "/dashboard",
  },
  {
    key: "clips",
    title: "My Clips",
    icon: "solar:video-library-bold-duotone",
    href: "/dashboard/clips",
  },
  {
    key: "create-clip",
    title: "Create Clip",
    icon: "solar:scissors-bold-duotone",
    href: "/dashboard/create-clip",
  },
  {
    key: "settings",
    title: "Settings",
    icon: "solar:settings-bold-duotone",
    href: "/dashboard/settings",
  },
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
  const { } = useTeams(); // Initialize teams on mount
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);

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

  const getInitials = (firstName?: string, lastName?: string, email?: string) => {
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

  const currentKey = sidebarItems.find(item => item.href === pathname)?.key || "home";

  return (
    <div className="flex h-screen bg-surface-dark">
      <aside
        className="relative bg-surface-base border-r border-border-base flex-shrink-0 flex flex-col"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="p-4 border-b border-border-base">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-text-primary">Clipster</h1>
            <Popover placement="bottom-end">
              <PopoverTrigger>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  className="text-text-secondary hover:text-text-primary"
                >
                  <Badge content="3" color="danger" size="sm">
                    <Icon icon="solar:bell-bold-duotone" width={20} />
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0">
                <NotificationsCard />
              </PopoverContent>
            </Popover>
          </div>

          <Popover placement="bottom-start">
            <PopoverTrigger>
              <Button
                variant="flat"
                className="w-full justify-start bg-surface-elevated hover:bg-surface-hover"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-400 text-white">
                    <Icon icon={getTeamIcon(selectedTeam?.role)} width={16} />
                  </div>
                  <span className="text-sm font-medium text-text-primary flex-1 text-left truncate">
                    {selectedTeam?.name || "Select Team"}
                  </span>
                  <Icon icon="solar:alt-arrow-down-bold-duotone" className="text-text-tertiary" width={16} />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <WorkspaceSelector />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <Sidebar
            items={sidebarItems}
            defaultSelectedKey={currentKey}
            onSelect={(key) => {
              const item = sidebarItems.find(item => item.key === key);
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
                    name={getInitials(user?.firstName, user?.lastName, user?.email)}
                    classNames={{
                      base: "bg-accent-400 text-white flex-shrink-0",
                      name: "text-sm font-semibold"
                    }}
                  />
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="text-sm font-semibold text-text-primary truncate w-full">
                      {user?.firstName && user?.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user?.email?.split('@')[0] || 'User'}
                    </span>
                    <span className="text-xs text-text-tertiary truncate w-full">
                      {user?.email}
                    </span>
                  </div>
                  <Icon icon="solar:alt-arrow-up-bold-duotone" className="text-text-tertiary flex-shrink-0" width={18} />
                </div>
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Account actions"
              classNames={{
                base: "bg-surface-base border border-border-base",
                list: "gap-1 p-2"
              }}
            >
              <DropdownItem
                key="profile"
                startContent={<Icon icon="solar:user-bold-duotone" width={20} className="text-text-secondary" />}
                classNames={{
                  base: "rounded-lg hover:bg-surface-elevated",
                  title: "text-text-primary font-medium"
                }}
              >
                Profile
              </DropdownItem>
              <DropdownItem
                key="settings"
                startContent={<Icon icon="solar:settings-bold-duotone" width={20} className="text-text-secondary" />}
                classNames={{
                  base: "rounded-lg hover:bg-surface-elevated",
                  title: "text-text-primary font-medium"
                }}
              >
                Settings
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                startContent={<Icon icon="solar:logout-2-bold-duotone" width={20} />}
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

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
