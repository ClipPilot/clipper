"use client";

import { useEffect, useState, useCallback } from "react";
import {
  adminAPI,
  Incident,
  IncidentStatus,
  CreateIncidentData,
  AddIncidentUpdateData,
} from "@/lib/api";

const ITEMS_PER_PAGE = 10;

const SERVICES = [
  { id: "platform", label: "Platform" },
  { id: "api", label: "API" },
  { id: "worker", label: "Worker" },
  { id: "cdn", label: "CDN" },
  { id: "auth", label: "Authentication" },
];

const STATUS_BADGES: Record<IncidentStatus, string> = {
  investigating: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  identified: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  monitoring: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  resolved: "bg-emerald/10 border-emerald/20 text-emerald",
};

// ── Create Incident Modal ──

interface CreateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateIncidentModal({ onClose, onSuccess }: CreateModalProps) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<IncidentStatus>("investigating");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0) {
      setError("Select at least one affected service");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      await adminAPI.createIncident({
        title,
        status,
        affected_services: selectedServices,
        message,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create incident");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl p-6 w-full max-w-lg my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-text-primary mb-4">
          Create Incident
        </h2>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={255}
              className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary"
              placeholder="API degraded performance"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus)}
              className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary"
            >
              <option value="investigating">Investigating</option>
              <option value="identified">Identified</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Affected Services <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => toggleService(svc.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedServices.includes(svc.id)
                      ? "bg-emerald/10 border-emerald/30 text-emerald"
                      : "bg-surface-elevated border-border text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  {svc.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary resize-none"
              placeholder="We are investigating reports of increased latency..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-lg bg-emerald text-black hover:bg-emerald-light transition-colors disabled:opacity-50 font-medium"
            >
              {isLoading ? "Creating..." : "Create Incident"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Update Modal ──

interface UpdateModalProps {
  incident: Incident;
  onClose: () => void;
  onSuccess: () => void;
}

function AddUpdateModal({ incident, onClose, onSuccess }: UpdateModalProps) {
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await adminAPI.addIncidentUpdate(incident.id, { status, message });
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add update",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl p-6 w-full max-w-lg my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-text-primary mb-1">
          Add Update
        </h2>
        <p className="text-sm text-text-tertiary mb-4">{incident.title}</p>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Timeline of existing updates */}
        {incident.updates.length > 0 && (
          <div className="mb-4 max-h-40 overflow-y-auto space-y-2">
            {incident.updates.map((u, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-text-tertiary"
              >
                <span
                  className={`inline-block px-1.5 py-0.5 rounded border ${STATUS_BADGES[u.status as IncidentStatus] || STATUS_BADGES.investigating} capitalize`}
                >
                  {u.status}
                </span>
                <span className="flex-1">{u.message}</span>
                <span className="flex-shrink-0 tabular-nums">
                  {new Date(u.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              New Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus)}
              className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary"
            >
              <option value="investigating">Investigating</option>
              <option value="identified">Identified</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary resize-none"
              placeholder="The issue has been identified and a fix is being deployed..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-lg bg-emerald text-black hover:bg-emerald-light transition-colors disabled:opacity-50 font-medium"
            >
              {isLoading ? "Adding..." : "Add Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [updatingIncident, setUpdatingIncident] = useState<Incident | null>(
    null,
  );

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const result = await adminAPI.getIncidents({
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: ITEMS_PER_PAGE,
        offset,
      });
      setIncidents(result.incidents);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to fetch incidents:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this incident?")) return;
    try {
      await adminAPI.deleteIncident(id);
      fetchIncidents();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to delete incident",
      );
    }
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Incidents
        </h1>
        <p className="text-text-secondary">
          Manage service incidents shown on status.cuttr.com
        </p>
      </div>

      {/* Filters and Create */}
      <div className="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text-primary"
        >
          <option value="all">All Status</option>
          <option value="investigating">Investigating</option>
          <option value="identified">Identified</option>
          <option value="monitoring">Monitoring</option>
          <option value="resolved">Resolved</option>
        </select>

        <button
          onClick={() => setShowCreateModal(true)}
          className="ml-auto px-4 py-2 rounded-lg bg-emerald text-black hover:bg-emerald-light transition-colors font-medium"
        >
          + Create Incident
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-secondary">
            Loading incidents...
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            No incidents found. That&apos;s a good thing!
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-elevated border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Services
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {incidents.map((incident) => (
                <tr
                  key={incident.id}
                  className="hover:bg-surface-hover transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-text-primary">
                      {incident.title}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {incident.updates.length} update
                      {incident.updates.length !== 1 ? "s" : ""} &middot; By{" "}
                      {incident.created_by_admin_email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-lg border ${STATUS_BADGES[incident.status]} capitalize`}
                    >
                      {incident.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {incident.affected_services.map((svc) => (
                        <span
                          key={svc}
                          className="inline-block px-2 py-0.5 text-xs rounded bg-surface-elevated border border-border text-text-secondary capitalize"
                        >
                          {svc}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-secondary">
                      {new Date(incident.created_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {incident.status !== "resolved" && (
                        <button
                          onClick={() => setUpdatingIncident(incident)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-accent-400 text-black hover:bg-accent-light transition-colors font-medium"
                        >
                          Add Update
                        </button>
                      )}
                      <button
                        onClick={() => setUpdatingIncident(incident)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors font-medium"
                      >
                        Timeline
                      </button>
                      <button
                        onClick={() => handleDelete(incident.id)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <div className="text-sm text-text-secondary">
              Page {currentPage} of {totalPages} &middot; {total} total
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateIncidentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchIncidents}
        />
      )}

      {updatingIncident && (
        <AddUpdateModal
          incident={updatingIncident}
          onClose={() => setUpdatingIncident(null)}
          onSuccess={fetchIncidents}
        />
      )}
    </div>
  );
}
