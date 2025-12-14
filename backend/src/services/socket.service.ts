import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";

let io: SocketServer | null = null;

export const initializeSocket = (httpServer: HttpServer) => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("join-team", (teamId: number) => {
      socket.join(`team-${teamId}`);
      console.log(`Socket ${socket.id} joined team-${teamId}`);
    });

    socket.on("leave-team", (teamId: number) => {
      socket.leave(`team-${teamId}`);
      console.log(`Socket ${socket.id} left team-${teamId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

export const emitClipUpdate = (teamId: number, clip: any) => {
  if (io) {
    io.to(`team-${teamId}`).emit("clip-updated", clip);
  }
};

export const emitClipsRefresh = (teamId: number) => {
  if (io) {
    io.to(`team-${teamId}`).emit("clips-refresh");
  }
};
