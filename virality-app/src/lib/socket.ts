import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let pendingTeamJoin: number | null = null;

function getSocketUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return "http://localhost:3001";
  try {
    return new URL(apiUrl).origin;
  } catch {
    return apiUrl.replace(/\/api\/?$/, "");
  }
}

export function connectSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      path: "/socket.io/",
    });

    socket.on("connect", () => {
      if (pendingTeamJoin !== null) socket?.emit("join-team", pendingTeamJoin);
    });

    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") socket?.connect();
    });

    socket.on("reconnect", () => {
      if (pendingTeamJoin !== null) socket?.emit("join-team", pendingTeamJoin);
    });
  }

  if (!socket.connected) socket.connect();
  return socket;
}

export function joinTeam(teamId: number): void {
  const s = connectSocket();
  pendingTeamJoin = teamId;
  if (s.connected) s.emit("join-team", teamId);
}

export function leaveTeam(teamId: number): void {
  if (!socket) return;
  if (pendingTeamJoin === teamId) pendingTeamJoin = null;
  if (socket.connected) socket.emit("leave-team", teamId);
}
