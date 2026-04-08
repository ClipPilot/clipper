"use client";

import { connectSocket, joinTeam, leaveTeam } from "@/lib/socket";
import {
  useViralitySyncSocketGlobal as sharedUseViralitySyncSocketGlobal,
  useViralitySync,
  type SocketConnector,
} from "@clipper/shared-ui";

export { useViralitySync };

const socketConnector: SocketConnector = {
  connect: connectSocket,
  joinTeam,
  leaveTeam,
};

export function useViralitySyncSocketGlobal(teamId: number | undefined) {
  return sharedUseViralitySyncSocketGlobal(teamId, socketConnector);
}
