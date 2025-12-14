import { createServer } from "http";
import app from "./app";
import "./config/env";
import { initializeSocket } from "./services/socket.service";

const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);
initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
