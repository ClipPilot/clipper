"use client";

import { ServiceWithHistory, ServiceStatus } from "@/lib/types";
import UptimeBar from "./uptime-bar";

const STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; color: string; dotClass: string }
> = {
  operational: {
    label: "Operational",
    color: "#22c55e",
    dotClass: "pulse-dot pulse-dot-green",
  },
  degraded: {
    label: "Degraded",
    color: "#f59e0b",
    dotClass: "pulse-dot pulse-dot-yellow",
  },
  outage: {
    label: "Outage",
    color: "#ef4444",
    dotClass: "pulse-dot pulse-dot-red",
  },
  maintenance: {
    label: "Maintenance",
    color: "#3b82f6",
    dotClass: "",
  },
};

export default function ServiceCard({ service }: { service: ServiceWithHistory }) {
  const config = STATUS_CONFIG[service.status];

  return (
    <div
      className="rounded-xl p-5 transition-colors duration-200"
      style={{
        backgroundColor: "var(--surface-base)",
        border: "1px solid var(--border-base)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-3 h-3">
            <div
              className={`absolute inset-0 rounded-full ${config.dotClass}`}
            />
            <div
              className="w-2.5 h-2.5 rounded-full relative z-[1]"
              style={{ backgroundColor: config.color }}
            />
          </div>
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {service.name}
            </h3>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              {service.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span
            className="text-xs tabular-nums"
            style={{ color: "var(--text-muted)" }}
          >
            {service.responseTime}ms
          </span>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-md"
            style={{
              color: config.color,
              backgroundColor: `${config.color}12`,
              border: `1px solid ${config.color}20`,
            }}
          >
            {config.label}
          </span>
        </div>
      </div>

      <UptimeBar
        history={service.history}
        uptimePercent={service.uptimePercent90d}
      />
    </div>
  );
}
