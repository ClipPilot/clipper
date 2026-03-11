"use client";

import { useTeams } from "@/hooks/useTeams";
import { useViralitySyncSocketGlobal } from "@/hooks/useViralitySyncSocket";

/**
 * Invisible component that keeps the Socket.IO listener alive
 * for virality sync updates across all virality pages.
 */
export function ViralitySyncListener() {
  const { selectedTeam } = useTeams();
  useViralitySyncSocketGlobal(selectedTeam?.id);
  return null;
}
