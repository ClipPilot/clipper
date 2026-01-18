import { Command } from "./types";

export interface ActionCallbacks {
  openCreateFolder: () => void;
  openUsageStats: () => void;
  toggleTheme: () => void;
  signOut: () => void;
}

export function createActionCommands(callbacks: ActionCallbacks): Command[] {
  return [
    {
      id: "action-new-folder",
      label: "Create New Folder",
      icon: "solar:folder-with-files-bold-duotone",
      group: "actions",
      keywords: ["folder", "organize", "new", "create"],
      action: callbacks.openCreateFolder,
    },
    {
      id: "action-usage",
      label: "View Usage & Analytics",
      icon: "solar:graph-up-bold-duotone",
      group: "actions",
      keywords: ["credits", "generations", "stats", "usage", "analytics", "history", "billing"],
      action: callbacks.openUsageStats,
    },
    {
      id: "action-theme",
      label: "Toggle Theme",
      icon: "solar:moon-bold-duotone",
      group: "actions",
      keywords: ["dark", "light", "mode"],
      action: callbacks.toggleTheme,
    },
    {
      id: "action-signout",
      label: "Sign Out",
      icon: "solar:logout-2-bold-duotone",
      group: "actions",
      keywords: ["logout", "exit"],
      action: callbacks.signOut,
    },
  ];
}
