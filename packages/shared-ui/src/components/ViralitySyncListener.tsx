"use client";

import { useViralitySyncSocketGlobal, type SocketConnector } from "../hooks/useViralitySync";

interface ViralitySyncListenerProps {
  teamId: number | undefined;
  socketConnector: SocketConnector;
}

export function ViralitySyncListener({ teamId, socketConnector }: ViralitySyncListenerProps) {
  useViralitySyncSocketGlobal(teamId, socketConnector);
  return null;
}