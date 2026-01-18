"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Command as Cmdk } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Icon } from "@iconify/react";

import { commandPaletteOpenAtom, commandPaletteSearchAtom } from "@/store/commandPalette";
import { savedClipsAtom, isCreateFolderOpenAtom } from "@/store/clips";
import { userTeamsAtom, selectedTeamAtom } from "@/store/auth";
import { useAuth } from "@/hooks/useAuth";
import { useTeams } from "@/hooks/useTeams";
import { clipsAPI } from "@/api/clips";

import {
  Command,
  CommandSection,
  createNavigationCommands,
  createActionCommands,
  createTeamCommands,
  createRecentClipsCommands,
  createSearchResultCommands,
} from "./commands";

const GROUP_LABELS: Record<string, string> = {
  navigation: "Go to",
  actions: "Actions",
  search: "Search Results",
  recent: "Recent Clips",
  teams: "Switch Team",
};

const GROUP_ICONS: Record<string, string> = {
  navigation: "solar:compass-bold-duotone",
  actions: "solar:bolt-bold-duotone",
  search: "solar:magnifer-bold-duotone",
  recent: "solar:clock-circle-bold-duotone",
  teams: "solar:users-group-two-rounded-bold-duotone",
};

export function CommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const { selectTeam } = useTeams();

  const [isOpen, setIsOpen] = useAtom(commandPaletteOpenAtom);
  const [search, setSearch] = useAtom(commandPaletteSearchAtom);
  const savedClips = useAtomValue(savedClipsAtom);
  const teams = useAtomValue(userTeamsAtom);
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [, setIsCreateFolderOpen] = useAtom(isCreateFolderOpenAtom);

  const [searchResults, setSearchResults] = useState<Command[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const navigate = useCallback((path: string) => {
    router.push(path);
    setIsOpen(false);
  }, [router, setIsOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, [setIsOpen, setSearch]);

  const navigationCommands = useMemo(
    () => createNavigationCommands(navigate),
    [navigate]
  );

  const actionCommands = useMemo(
    () => createActionCommands({
      openCreateFolder: () => {
        setIsOpen(false);
        router.push("/dashboard/clips");
        setTimeout(() => setIsCreateFolderOpen(true), 100);
      },
      openUsageStats: () => {
        navigate("/dashboard/usage");
      },
      toggleTheme: () => {
        setTheme(theme === "dark" ? "light" : "dark");
        setIsOpen(false);
      },
      signOut: async () => {
        setIsOpen(false);
        await signOut();
      },
    }),
    [setIsCreateFolderOpen, setIsOpen, navigate, setTheme, theme, signOut, router]
  );

  const teamCommands = useMemo(
    () => createTeamCommands(teams, selectedTeam, (team) => {
      selectTeam(team);
      setIsOpen(false);
    }),
    [teams, selectedTeam, selectTeam, setIsOpen]
  );

  const recentClipsCommands = useMemo(
    () => createRecentClipsCommands(savedClips, navigate, 5),
    [savedClips, navigate]
  );

  useEffect(() => {
    if (!search || search.length < 2 || !selectedTeam) {
      setSearchResults([]);
      return;
    }

    const searchClips = async () => {
      setIsSearching(true);
      try {
        const result = await clipsAPI.searchClips(selectedTeam.id, {
          q: search,
          limit: 5,
        });
        setSearchResults(createSearchResultCommands(result.clips, navigate));
      } catch (error) {
        console.error("Failed to search clips:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchClips, 300);
    return () => clearTimeout(debounce);
  }, [search, selectedTeam, navigate]);

  const sections: CommandSection[] = useMemo(() => {
    const result: CommandSection[] = [];

    if (searchResults.length > 0) {
      result.push({ group: "search", label: GROUP_LABELS.search, commands: searchResults });
    }

    if (recentClipsCommands.length > 0 && !search) {
      result.push({ group: "recent", label: GROUP_LABELS.recent, commands: recentClipsCommands });
    }

    result.push({ group: "navigation", label: GROUP_LABELS.navigation, commands: navigationCommands });
    result.push({ group: "actions", label: GROUP_LABELS.actions, commands: actionCommands });

    if (teamCommands.length > 0) {
      result.push({ group: "teams", label: GROUP_LABELS.teams, commands: teamCommands });
    }

    return result;
  }, [searchResults, recentClipsCommands, navigationCommands, actionCommands, teamCommands, search]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setIsOpen, isOpen, handleClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            onClick={handleClose}
          />
          <div className="fixed inset-0 flex items-start justify-center pt-[15vh] px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-full max-w-2xl"
            >
              <Cmdk
                className="bg-surface-base/95 backdrop-blur-xl border border-border-accent rounded-2xl shadow-2xl overflow-hidden"
                loop
              >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 border-b border-border-base/50">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400/20 to-accent-500/10">
                    <Icon icon="solar:magnifer-bold-duotone" className="text-accent-400 text-xl" />
                  </div>
                  <Cmdk.Input
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Search commands, clips, or navigate..."
                    className="flex-1 h-16 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-lg font-medium"
                    autoFocus
                  />
                  {isSearching ? (
                    <div className="flex items-center justify-center w-10 h-10">
                      <Icon icon="solar:spinner-bold-duotone" className="text-accent-400 text-xl animate-spin" />
                    </div>
                  ) : (
                    <kbd className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-tertiary bg-surface-elevated/80 rounded-lg border border-border-base/50 shadow-sm">
                      ESC
                    </kbd>
                  )}
                </div>

                {/* Results List */}
                <Cmdk.List className="max-h-[420px] overflow-y-auto p-3 scroll-smooth">
                  <Cmdk.Empty className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center">
                        <Icon icon="solar:ghost-smile-bold-duotone" className="text-2xl text-text-tertiary" />
                      </div>
                      <p className="text-text-secondary text-sm">No results found</p>
                    </div>
                  </Cmdk.Empty>

                  {sections.map((section, sectionIndex) => (
                    <Cmdk.Group
                      key={section.group}
                      heading={section.label}
                      className={sectionIndex > 0 ? "mt-4" : ""}
                    >
                      <div className="flex items-center gap-2 px-2 py-2 mb-1">
                        <Icon
                          icon={GROUP_ICONS[section.group] || "solar:widget-bold-duotone"}
                          className="text-sm text-text-tertiary"
                        />
                        <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                          {section.label}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {section.commands.map((command) => (
                          <Cmdk.Item
                            key={command.id}
                            value={`${command.label} ${command.keywords?.join(" ") || ""}`}
                            onSelect={() => command.action()}
                            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-text-primary transition-all duration-150 data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-accent-400/15 data-[selected=true]:to-accent-500/5 data-[selected=true]:shadow-sm hover:bg-surface-elevated/50"
                          >
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-elevated group-data-[selected=true]:bg-accent-400/20 transition-colors">
                              <Icon
                                icon={command.icon}
                                className="text-lg text-text-secondary group-data-[selected=true]:text-accent-400 transition-colors"
                              />
                            </div>
                            <span className="flex-1 font-medium">{command.label}</span>
                            {command.shortcut && (
                              <kbd className="text-xs text-text-tertiary bg-surface-elevated px-2 py-1 rounded-md">
                                {command.shortcut}
                              </kbd>
                            )}
                            <Icon
                              icon="solar:arrow-right-linear"
                              className="text-text-tertiary opacity-0 group-data-[selected=true]:opacity-100 transition-opacity"
                            />
                          </Cmdk.Item>
                        ))}
                      </div>
                    </Cmdk.Group>
                  ))}
                </Cmdk.List>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-border-base/50 bg-surface-elevated/30">
                  <div className="flex items-center gap-5">
                    <span className="flex items-center gap-2 text-xs text-text-tertiary">
                      <kbd className="px-2 py-1 bg-surface-elevated rounded-md border border-border-base/50 font-medium shadow-sm">↑↓</kbd>
                      <span>navigate</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-text-tertiary">
                      <kbd className="px-2 py-1 bg-surface-elevated rounded-md border border-border-base/50 font-medium shadow-sm">↵</kbd>
                      <span>select</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-text-tertiary">
                      <kbd className="px-2 py-1 bg-surface-elevated rounded-md border border-border-base/50 font-medium shadow-sm">esc</kbd>
                      <span>close</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <span className="opacity-60">powered by</span>
                    <span className="font-semibold text-accent-400">Cuttr</span>
                  </div>
                </div>
              </Cmdk>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
