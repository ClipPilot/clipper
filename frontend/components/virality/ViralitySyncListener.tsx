"use client";

import { ViralitySyncListener as SharedViralitySyncListener, type SocketConnector } from "@clipper/shared-ui";
import { useTeams } from "@/hooks/useTeams";
import { connectSocket, joinTeam, leaveTeam } from "@/lib/socket";

const socketConnector: SocketConnector = {
  connect: connectSocket,
  joinTeam,
  leaveTeam,
};

export function ViralitySyncListener() {
  const { selectedTeam } = useTeams();
  return <SharedViralitySyncListener teamId={selectedTeam?.id} socketConnector={socketConnector} />;
}
