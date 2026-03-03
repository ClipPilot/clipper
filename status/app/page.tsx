"use client";

import { useEffect, useState, useCallback } from "react";
import ServiceCard from "@/components/service-card";
import IncidentList from "@/components/incident-list";
import { StatusResponse, ServiceStatus, Incident } from "@/lib/types";

const REFRESH_INTERVAL = 60000;

const OVERALL_CONFIG: Record<
  ServiceStatus,
  { label: string; color: string; dotClass: string }
> = {
  operational: {
    label: "All Systems Operational",
    color: "#22c55e",
    dotClass: "pulse-dot pulse-dot-green",
  },
  degraded: {
    label: "Degraded Performance",
    color: "#f59e0b",
    dotClass: "pulse-dot pulse-dot-yellow",
  },
  outage: {
    label: "Major Outage",
    color: "#ef4444",
    dotClass: "pulse-dot pulse-dot-red",
  },
  maintenance: {
    label: "Maintenance In Progress",
    color: "#3b82f6",
    dotClass: "",
  },
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

const INCIDENTS_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cuttr.com";

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState(false);
  const [lastChecked, setLastChecked] = useState("");
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error();
      const json: StatusResponse = await res.json();
      setData(json);
      setError(false);
      setLastChecked(json.checkedAt);
    } catch {
      setError(true);
    }
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch(`${INCIDENTS_API_URL}/api/incidents/active`);
      if (!res.ok) return;
      const json = await res.json();
      setIncidents(
        (json.incidents || []).map((inc: any) => ({
          id: String(inc.id),
          title: inc.title,
          date: inc.created_at,
          status: inc.status,
          affectedServices: inc.affected_services || [],
          updates: inc.updates || [],
        })),
      );
    } catch {
      // Non-critical — keep showing empty incidents
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchIncidents();
    const interval = setInterval(() => {
      fetchStatus();
      fetchIncidents();
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchIncidents]);

  useEffect(() => {
    if (!lastChecked) return;
    const tick = setInterval(() => setLastChecked((v) => v), 1000);
    return () => clearInterval(tick);
  }, [lastChecked]);

  const overall = data
    ? OVERALL_CONFIG[data.overall]
    : { label: "Checking...", color: "#71717a", dotClass: "" };

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="border-b"
        style={{ borderColor: "var(--border-base)" }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Cuttr Status
          </span>
          <a href="https://cuttr.com" className="text-xs link-muted">
            cuttr.com &rarr;
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10">
        <div
          className="rounded-xl p-4 sm:p-6 mb-6 sm:mb-8"
          style={{
            background: `linear-gradient(135deg, ${overall.color}08, ${overall.color}04)`,
            border: `1px solid ${overall.color}18`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="relative flex items-center justify-center w-4 h-4 flex-shrink-0">
                <div
                  className={`absolute inset-0 rounded-full ${overall.dotClass}`}
                />
                <div
                  className="w-3.5 h-3.5 rounded-full relative z-[1]"
                  style={{ backgroundColor: overall.color }}
                />
              </div>
              <div className="min-w-0">
                <h1
                  className="text-base sm:text-lg font-semibold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {overall.label}
                </h1>
                {error && (
                  <p className="text-xs mt-0.5" style={{ color: "#ef4444" }}>
                    Failed to reach status API
                  </p>
                )}
              </div>
            </div>
            {lastChecked && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className="text-xs tabular-nums hidden sm:inline"
                  style={{ color: "var(--text-muted)" }}
                >
                  {timeAgo(lastChecked)}
                </span>
                <button
                  onClick={fetchStatus}
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.backgroundColor = "var(--surface-hover)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {!data && !error && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl px-5 py-4 animate-pulse"
                style={{
                  backgroundColor: "var(--surface-base)",
                  border: "1px solid var(--border-base)",
                  height: "62px",
                }}
              />
            ))}
          </div>
        )}

        {data && (
          <section className="mb-12">
            <h2
              className="text-xs font-semibold tracking-widest uppercase mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              Services
            </h2>
            <div className="space-y-3">
              {data.services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </section>
        )}

        <section className="mb-12">
          <h2
            className="text-xs font-semibold tracking-widest uppercase mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Incidents
          </h2>
          <IncidentList incidents={incidents} />
        </section>
      </main>

      <footer
        className="border-t"
        style={{ borderColor: "var(--border-base)" }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            &copy; {new Date().getFullYear()} Cuttr
          </span>
          <div className="flex items-center gap-4 sm:gap-5">
            {[
              { label: "Website", href: "https://cuttr.com" },
              { label: "Docs", href: "https://docs.cuttr.com" },
              { label: "Support", href: "mailto:support@cuttr.com" },
            ].map((link) => (
              <a key={link.label} href={link.href} className="text-xs link-muted">
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
