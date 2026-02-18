import { ServiceConfig, ServiceCheck, ServiceStatus } from "./types";
import { services } from "./services";

async function checkService(config: ServiceConfig): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeout);

    const res = await fetch(config.url, {
      method: config.method,
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Cuttr-StatusChecker/1.0" },
    });

    clearTimeout(timer);
    const responseTime = Date.now() - start;

    let status: ServiceStatus = "operational";
    if (!res.ok) {
      status = "outage";
    } else if (responseTime > config.degradedThreshold) {
      status = "degraded";
    }

    return {
      id: config.id,
      name: config.name,
      description: config.description,
      status,
      responseTime,
      statusCode: res.status,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      status: "outage",
      responseTime: Date.now() - start,
      statusCode: null,
      checkedAt: new Date().toISOString(),
    };
  }
}

function deriveOverallStatus(checks: ServiceCheck[]): ServiceStatus {
  if (checks.some((c) => c.status === "outage")) return "outage";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  if (checks.some((c) => c.status === "maintenance")) return "maintenance";
  return "operational";
}

export interface CheckResult {
  overall: ServiceStatus;
  services: ServiceCheck[];
  checkedAt: string;
}

export async function checkAllServices(): Promise<CheckResult> {
  const checks = await Promise.all(services.map(checkService));
  return {
    overall: deriveOverallStatus(checks),
    services: checks,
    checkedAt: new Date().toISOString(),
  };
}
