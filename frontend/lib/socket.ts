import { io, Socket } from "socket.io-client";
import API_URL from "@/config/constants";

let socket: Socket | null = null;
let pendingTeamJoin: number | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl = API_URL?.replace(/\/api$/, '') || '';

    socket = io(socketUrl, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      path: '/socket.io/',
    });

    socket.on("connect", () => {
      console.log("[socket] Connected, id:", socket?.id);
      reconnectAttempts = 0;
      if (pendingTeamJoin !== null) {
        console.log("[socket] Joining team:", pendingTeamJoin);
        socket?.emit("join-team", pendingTeamJoin);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("[socket] Disconnected:", reason);
      if (reason === "io server disconnect") {
        socket?.connect();
      }
    });

    socket.on("connect_error", (error) => {
      reconnectAttempts++;
      console.error(`[socket] Connection error (attempt ${reconnectAttempts}):`, error.message);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("[socket] Reconnected after", attemptNumber, "attempts");
      if (pendingTeamJoin !== null) {
        socket?.emit("join-team", pendingTeamJoin);
      }
    });

    socket.on("reconnect_failed", () => {
      console.error("[socket] Reconnection failed after", MAX_RECONNECT_ATTEMPTS, "attempts");
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

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

export function joinTeam(teamId: number): void {
  const s = getSocket();
  pendingTeamJoin = teamId;

  if (s.connected) {
    console.log("[socket] Joining team:", teamId);
    s.emit("join-team", teamId);
  } else {
    console.log("[socket] Connection pending, will join team:", teamId);
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
