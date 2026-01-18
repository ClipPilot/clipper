import { Team } from "@/store/auth";
import { Command } from "./types";

export function createTeamCommands(
  teams: Team[],
  currentTeam: Team | null,
  switchTeam: (team: Team) => void
): Command[] {
  return teams
    .filter((team) => team.id !== currentTeam?.id)
    .map((team) => ({
      id: `team-${team.id}`,
      label: `Switch to ${team.name}`,
      icon: "solar:users-group-two-rounded-bold-duotone",
      group: "teams" as const,
      keywords: ["team", "switch", team.name.toLowerCase(), team.plan],
      action: () => switchTeam(team),
    }));
}
