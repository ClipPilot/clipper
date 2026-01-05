import { io, Socket } from "socket.io-client";
import API_URL from "@/config/constants";

let socket: Socket | null = null;
let pendingTeamJoin: number | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      autoConnect: false,
    });

    // Handle pending team join when socket connects
    socket.on("connect", () => {
      console.log("[socket] Connected, id:", socket?.id);
      if (pendingTeamJoin !== null) {
        console.log("[socket] Joining pending team:", pendingTeamJoin);
        socket?.emit("join-team", pendingTeamJoin);
      }
    });

    socket.on("disconnect", () => {
      console.log("[socket] Disconnected");
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function joinTeam(teamId: number): void {
  const s = getSocket();
  pendingTeamJoin = teamId;

  if (s.connected) {
    console.log("[socket] Already connected, joining team:", teamId);
    s.emit("join-team", teamId);
  } else {
    console.log("[socket] Not connected yet, team join pending:", teamId);
    // Will be joined when 'connect' event fires
  }
}

export function leaveTeam(teamId: number): void {
  const s = getSocket();
  if (pendingTeamJoin === teamId) {
    pendingTeamJoin = null;
  }
  if (s.connected) {
    s.emit("leave-team", teamId);
  }
}
