import { ServiceConfig } from "./types";

export const services: ServiceConfig[] = [
  {
    id: "api",
    name: "API",
    description: "api.cuttr.com",
    url: process.env.CHECK_API_URL || "https://api.cuttr.com/health",
    method: "GET",
    timeout: 10000,
    degradedThreshold: 2000,
  },
  {
    id: "platform",
    name: "Platform",
    description: "platform.cuttr.com",
    url: process.env.CHECK_PLATFORM_URL || "https://platform.cuttr.com",
    method: "GET",
    timeout: 10000,
    degradedThreshold: 3000,
  },
  {
    id: "worker",
    name: "Worker",
    description: "Video processing pipeline",
    url: process.env.CHECK_WORKER_URL || "https://api.cuttr.com/health",
    method: "GET",
    timeout: 10000,
    degradedThreshold: 2000,
  },
];
