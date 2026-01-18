export type CommandGroup = "navigation" | "actions" | "search" | "recent" | "teams";

export interface Command {
  id: string;
  label: string;
  icon: string;
  group: CommandGroup;
  keywords?: string[];
  shortcut?: string;
  action: () => void | Promise<void>;
}

export interface CommandSection {
  group: CommandGroup;
  label: string;
  commands: Command[];
}
