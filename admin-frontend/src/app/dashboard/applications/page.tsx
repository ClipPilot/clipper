"use client";

import { useEffect, useState, useCallback } from "react";
import {
  adminAPI,
  MassPostingApplication,
  ApplicationDetail,
  IntakeForm,
} from "@/lib/api";

const ITEMS_PER_PAGE = 10;

interface DetailModalProps {
  applicationId: number;
  onClose: () => void;
  onAction: () => void;
}

function DetailModal({ applicationId, onClose, onAction }: DetailModalProps) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const { application } = await adminAPI.getApplication(applicationId);
        setDetail(application);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load application"
        );
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [applicationId]);

  const handleApprove = async () => {
    setActionLoading(true);
    setError("");
    try {
      await adminAPI.approveApplication(applicationId, adminNotes || undefined);
      onAction();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to approve application"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError("Rejection reason is required");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      await adminAPI.rejectApplication(
        applicationId,
        rejectionReason,
        adminNotes || undefined
      );
      onAction();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reject application"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryDrive = async () => {
    setActionLoading(true);
    setError("");
    try {
      await adminAPI.retryDriveFolder(applicationId);
      onAction();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create Drive folder"
      );
    } finally {
      setActionLoading(false);
    }
  };

  // TODO(human): Implement the renderIntakeFormDetails function
  const renderIntakeFormDetails = (form: IntakeForm) => {
    return (
      <div className="space-y-4">
        {form.brand_description && (
          <div>
            <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">
              Brand Description
            </h4>
            <p className="text-sm text-text-primary">{form.brand_description}</p>
          </div>
        )}

        {form.company_website_url && (
          <div>
            <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">
              Website
            </h4>
            <a
              href={form.company_website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald hover:underline"
            >
              {form.company_website_url}
            </a>
          </div>
        )}

        {form.icps && Array.isArray(form.icps) && form.icps.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">
              Ideal Customer Profiles
            </h4>
            <div className="space-y-2">
              {form.icps.map((icp: any, i: number) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-surface-elevated border border-border"
                >
                  <p className="text-sm font-medium text-text-primary">
                    {icp.name}
                  </p>
                  {icp.description && (
                    <p className="text-xs text-text-secondary mt-1">
                      {icp.description}
                    </p>
                  )}
                  {icp.demographics && (
                    <p className="text-xs text-text-tertiary mt-1">
                      Demographics: {icp.demographics}
                    </p>
                  )}
                  {icp.painPoints?.length > 0 && (
                    <p className="text-xs text-text-tertiary mt-1">
                      Pain points: {icp.painPoints.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {form.company_socials &&
          Array.isArray(form.company_socials) &&
          form.company_socials.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">
                Company Socials
              </h4>
              <div className="flex flex-wrap gap-2">
                {form.company_socials.map((social: any, i: number) => (
                  <a
                    key={i}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-surface-elevated border border-border text-emerald hover:underline"
                  >
                    {social.platform}
                    {social.handle && ` (${social.handle})`}
                  </a>
                ))}
              </div>
            </div>
          )}

        {form.competitor_socials &&
          Array.isArray(form.competitor_socials) &&
          form.competitor_socials.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">
                Competitor Socials
              </h4>
              <div className="space-y-2">
                {form.competitor_socials.map((comp: any, i: number) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-surface-elevated border border-border"
                  >
                    <p className="text-xs font-medium text-text-primary">
                      {comp.companyName}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {comp.accounts?.map((acc: any, j: number) => (
                        <a
                          key={j}
                          href={acc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald hover:underline"
                        >
                          {acc.platform}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl p-6 w-full max-w-3xl my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-12 text-center text-text-secondary">
            Loading application details...
          </div>
        ) : !detail ? (
          <div className="p-12 text-center text-red-400">{error || "Application not found"}</div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  Application #{detail.id}
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                  {detail.team_name} &middot; {detail.team_plan} plan
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block px-2 py-1 text-xs rounded-lg border ${getStatusBadgeClass(detail.status)} capitalize`}
                >
                  {detail.status}
                </span>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center"
                >
                  X
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                {error}
              </div>
            )}

            {/* Intake Form Data */}
            {detail.intakeForm && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-primary mb-3">
                  Intake Form
                </h3>
                <div className="p-4 rounded-xl bg-surface-elevated border border-border">
                  {renderIntakeFormDetails(detail.intakeForm)}
                </div>
              </div>
            )}

            {/* Google Drive */}
            {detail.status === "accepted" && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-primary mb-2">
                  Google Drive Folder
                </h3>
                {detail.google_drive_folder_id ? (
                  <a
                    href={`https://drive.google.com/drive/folders/${detail.google_drive_folder_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald hover:underline"
                  >
                    Open in Google Drive
                  </a>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-yellow-400">
                      Drive folder not created
                    </span>
                    <button
                      onClick={handleRetryDrive}
                      disabled={actionLoading}
                      className="px-3 py-1.5 text-xs rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 transition-colors font-medium disabled:opacity-50"
                    >
                      {actionLoading ? "Creating..." : "Retry Drive Folder"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Rejection Reason (if rejected) */}
            {detail.rejection_reason && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-primary mb-2">
                  Rejection Reason
                </h3>
                <p className="text-sm text-red-400 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  {detail.rejection_reason}
                </p>
              </div>
            )}

            {/* Admin Notes (existing) */}
            {detail.admin_notes && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-primary mb-2">
                  Previous Admin Notes
                </h3>
                <p className="text-sm text-text-secondary p-3 rounded-lg bg-surface-elevated border border-border">
                  {detail.admin_notes}
                </p>
              </div>
            )}

            {/* Actions for pending/appeal */}
            {(detail.status === "pending" || detail.status === "appeal") && (
              <div className="border-t border-border pt-4 mt-4 space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">
                    Admin Notes (optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary text-sm"
                    placeholder="Internal notes..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">
                    Rejection Reason (required to reject)
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary text-sm"
                    placeholder="Reason for rejection..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-lg bg-emerald text-black hover:bg-emerald-light transition-colors disabled:opacity-50 font-medium"
                  >
                    {actionLoading ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 font-medium"
                  >
                    {actionLoading ? "Processing..." : "Reject"}
                  </button>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex gap-6 text-xs text-text-tertiary">
                <span>
                  Submitted:{" "}
                  {new Date(detail.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>
                  Updated:{" "}
                  {new Date(detail.updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function getStatusBadgeClass(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    accepted: "bg-emerald/10 border-emerald/20 text-emerald",
    rejected: "bg-red-500/10 border-red-500/20 text-red-400",
    appeal: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  };
  return colors[status] || colors.pending;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<MassPostingApplication[]>(
    []
  );
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    number | null
  >(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const result = await adminAPI.getApplications({
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: ITEMS_PER_PAGE,
        offset,
      });
      setApplications(result.applications);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to fetch applications:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Mass Posting Applications
        </h1>
        <p className="text-text-secondary">
          Review and manage team applications for mass posting features
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text-primary"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="appeal">Appeal</option>
        </select>
      </div>

      {/* Applications Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-secondary">
            Loading applications...
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            No applications found.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-elevated border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Team Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {applications.map((app) => (
                <tr
                  key={app.id}
                  className="hover:bg-surface-hover transition-colors cursor-pointer"
                  onClick={() => setSelectedApplicationId(app.id)}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-text-primary">
                      {app.team_name}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      Team #{app.team_id}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-lg border ${getStatusBadgeClass(app.status)} capitalize`}
                    >
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-text-secondary capitalize">
                      {app.team_plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-secondary">
                      {new Date(app.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedApplicationId(app.id);
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-emerald text-black hover:bg-emerald-light transition-colors font-medium"
                      >
                        View
                      </button>
                      {app.status === "accepted" &&
                        !app.google_drive_folder_id && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await adminAPI.retryDriveFolder(app.id);
                                fetchApplications();
                              } catch (err) {
                                alert(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to create Drive folder"
                                );
                              }
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 transition-colors font-medium"
                          >
                            Retry Drive
                          </button>
                        )}
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

      {selectedApplicationId && (
        <DetailModal
          applicationId={selectedApplicationId}
          onClose={() => setSelectedApplicationId(null)}
          onAction={fetchApplications}
        />
      )}
    </div>
  );
}
