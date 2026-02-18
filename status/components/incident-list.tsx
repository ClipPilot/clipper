"use client";

import { Incident, IncidentStatus } from "@/lib/types";

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string }> = {
  resolved: { label: "Resolved", color: "#22c55e" },
  monitoring: { label: "Monitoring", color: "#3b82f6" },
  investigating: { label: "Investigating", color: "#f59e0b" },
  identified: { label: "Identified", color: "#f59e0b" },
};

export default function IncidentList({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) {
    return (
      <div
        className="text-center py-12 rounded-xl"
        style={{
          backgroundColor: "var(--surface-base)",
          border: "1px solid var(--border-base)",
        }}
      >
        <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>
          No incidents reported.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {incidents.map((incident) => {
        const config = STATUS_CONFIG[incident.status];
        return (
          <div
            key={incident.id}
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--surface-base)",
              border: "1px solid var(--border-base)",
            }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border-base)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <h4
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {incident.title}
                </h4>
              </div>
              <div className="flex items-center gap-3">
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
                <span
                  className="text-xs tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {incident.date}
                </span>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {incident.updates.map((update, i) => {
                const updateConfig = STATUS_CONFIG[update.status];
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: updateConfig.color }}
                      />
                      {i < incident.updates.length - 1 && (
                        <div
                          className="w-px flex-1 mt-1"
                          style={{ backgroundColor: "var(--border-base)" }}
                        />
                      )}
                    </div>
                    <div className="pb-3 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: updateConfig.color }}
                        >
                          {updateConfig.label}
                        </span>
                        <span
                          className="text-[10px] tabular-nums"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {update.timestamp}
                        </span>
                      </div>
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {update.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
