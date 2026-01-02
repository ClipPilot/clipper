import { io, Socket } from "socket.io-client";
import API_URL from "@/config/constants";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      autoConnect: false,
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
  if (s.connected) {
    s.emit("join-team", teamId);
  }
}

export function leaveTeam(teamId: number): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("leave-team", teamId);
  }
}
