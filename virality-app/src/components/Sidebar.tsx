"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button, Avatar, Dropdown, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAuth } from "@/hooks/useAuth";

type SidebarItem = {
  key: string;
  title: string;
  icon: string;
  href: string;
};

type SidebarSection = {
  title: string | null;
  items: SidebarItem[];
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: null,
    items: [
      {
        key: "dashboard",
        title: "Dashboard",
        icon: "solar:chart-square-bold-duotone",
        href: "/",
      },
    ],
  },
  {
    title: "Tracking",
    items: [
      {
        key: "competitors",
        title: "Competitors",
        icon: "solar:users-group-rounded-bold-duotone",
        href: "/competitors",
      },
      {
        key: "my-performance",
        title: "My Performance",
        icon: "solar:star-bold-duotone",
        href: "/my-performance",
      },
    ],
  },
  {
    title: "Configuration",
    items: [
      {
        key: "settings",
        title: "Settings",
        icon: "solar:settings-bold-duotone",
        href: "/settings",
      },
    ],
  },
];

const ALL_ITEMS = SIDEBAR_SECTIONS.flatMap((s) => s.items);

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const currentKey =
    [...ALL_ITEMS]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) =>
        item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
      )?.key || "";

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-base border-r border-border-base flex flex-col z-40">
      <div className="border-b border-border-base p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-accent-400 flex items-center justify-center">
              <Icon icon="solar:chart-bold-duotone" width={16} className="text-white" />
            </div>
            <span className="text-sm font-bold text-text-primary tracking-tight">Cuttr</span>
          </div>
        </div>


      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <nav className="space-y-0.5">
          {SIDEBAR_SECTIONS.map((section, idx) => (
            <div key={idx}>
              {idx > 0 && section.title && (
                <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {section.title}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive = currentKey === item.key;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors",
                        isActive
                          ? "bg-accent-400/10"
                          : "hover:bg-surface-elevated"
                      )}
                    >
                      <Icon
                        icon={item.icon}
                        width={18}
                        className={cn(
                          "flex-shrink-0 transition-colors",
                          isActive ? "text-accent-400" : "text-text-primary"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[13px] font-medium transition-colors",
                          isActive ? "text-accent-400" : "text-text-primary"
                        )}
                      >
                        {item.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-border-base p-3">
        <div className="rounded-xl bg-accent-400/10 border border-accent-400/20 p-3.5 mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Icon icon="solar:bolt-bold-duotone" width={16} className="text-accent-400" />
            <p className="text-xs font-semibold text-text-primary">Quick Sync</p>
          </div>
          <p className="text-[11px] text-text-tertiary leading-relaxed mb-2.5">
            Sync all accounts to get the latest metrics.
          </p>
          <button className="w-full bg-accent-400 text-white text-xs font-medium py-2 rounded-lg hover:bg-accent-500 transition-colors">
            Sync All Accounts
          </button>
        </div>

        <Dropdown>
          <Button variant="tertiary" className="w-full h-auto p-2 justify-start rounded-lg bg-surface-elevated hover:bg-surface-hover transition-all">
            <div className="flex items-center gap-2.5 w-full">
              <Avatar size="sm" className="bg-accent-400 text-white">
                <Avatar.Fallback className="text-sm font-semibold">
                  {user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() : "?"}
                </Avatar.Fallback>
              </Avatar>
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span className="text-sm font-semibold text-text-primary truncate w-full">
                  {user ? `${user.firstName} ${user.lastName}` : "User"}
                </span>
                <span className="text-xs text-text-tertiary truncate w-full">
                  {user?.email ?? ""}
                </span>
              </div>
              <Icon
                icon="solar:alt-arrow-up-bold-duotone"
                className="text-text-tertiary flex-shrink-0"
                width={18}
              />
            </div>
          </Button>
          <Dropdown.Popover placement="top start">
            <Dropdown.Menu
              aria-label="Account actions"
              onAction={(key) => {
                if (key === "logout") signOut();
              }}
            >
              <Dropdown.Item id="settings" textValue="Settings">
                <Icon icon="solar:settings-bold-duotone" width={18} className="text-text-secondary" />
                Settings
              </Dropdown.Item>
              <Dropdown.Item id="logout" textValue="Sign Out" variant="danger">
                <Icon icon="solar:logout-2-bold-duotone" width={18} />
                Sign Out
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </aside>
  );
}
