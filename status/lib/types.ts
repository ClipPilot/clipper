export type ServiceStatus = "operational" | "degraded" | "outage" | "maintenance";
export type IncidentStatus = "resolved" | "monitoring" | "investigating" | "identified";

export interface ServiceConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  method: "GET" | "HEAD";
  timeout: number;
  degradedThreshold: number;
}

export interface ServiceCheck {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  responseTime: number;
  statusCode: number | null;
  checkedAt: string;
}

export interface DailyUptime {
  date: string;
  checks: number;
  failures: number;
  avgResponseTime: number;
  uptimePercent: number;
}

export interface ServiceWithHistory extends ServiceCheck {
  history: DailyUptime[];
  uptimePercent90d: number | null;
}

export interface StatusResponse {
  overall: ServiceStatus;
  services: ServiceWithHistory[];
  checkedAt: string;
}

export interface IncidentUpdate {
  status: IncidentStatus;
  message: string;
  timestamp: string;
}

export interface Incident {
  id: string;
  title: string;
  date: string;
  status: IncidentStatus;
  affectedServices: string[];
  updates: IncidentUpdate[];
}
