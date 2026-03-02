"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  adminAPI,
  Campaign,
  CampaignContract,
  CampaignDetail,
  CampaignVideo,
  ContractClauses,
  IntakeForm,
} from "@/lib/api";

const ITEMS_PER_PAGE = 10;

function getTierCpm(budget: string | null): string {
  if (!budget) return "";
  const b = Number(budget);
  if (b >= 80000) return "1.50";
  if (b >= 40000) return "1.75";
  if (b >= 15000) return "2.00";
  if (b >= 5000) return "2.50";
  return "";
}

function getStatusBadgeClass(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    accepted: "bg-emerald/10 border-emerald/20 text-emerald",
    rejected: "bg-red-500/10 border-red-500/20 text-red-400",
    appeal: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    started: "bg-green-500/10 border-green-500/20 text-green-400",
    paused: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    completed: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  };
  return colors[status] || colors.pending;
}

interface DetailModalProps {
  campaignId: number;
  onClose: () => void;
  onAction: () => void;
}

function DetailModal({ campaignId, onClose, onAction }: DetailModalProps) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [quotedCpmInput, setQuotedCpmInput] = useState("");
  const [videoMinimumInput, setVideoMinimumInput] = useState("");
  const [minimumFundInput, setMinimumFundInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [error, setError] = useState("");
  const [contract, setContract] = useState<CampaignContract | null>(null);
  const [videos, setVideos] = useState<CampaignVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractSaving, setContractSaving] = useState(false);
  const [showContractEditor, setShowContractEditor] = useState(false);
  const [clauseEdits, setClauseEdits] = useState<ContractClauses>({});

  const publishRouter = useRouter();

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const { campaign } = await adminAPI.getCampaign(campaignId);
        setDetail(campaign);
        setQuotedCpmInput(campaign.quoted_cpm ?? getTierCpm(campaign.budget));
        setVideoMinimumInput(campaign.video_minimum != null ? String(campaign.video_minimum) : "");
        setMinimumFundInput(campaign.minimum_fund ?? "");
        setBudgetInput(campaign.budget ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load campaign");
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [campaignId]);

  const fetchContract = useCallback(async () => {
    setContractLoading(true);
    try {
      const { contract: c } = await adminAPI.getCampaignContract(campaignId);
      setContract(c);
      if (c?.terms?.clauses) {
        setClauseEdits(c.terms.clauses);
      }
    } catch {
      // Contract may not exist yet — that's fine
    } finally {
      setContractLoading(false);
    }
  }, [campaignId]);

  const fetchVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const { videos: v } = await adminAPI.getCampaignVideos(campaignId);
      setVideos(v);
    } catch {
      // Videos may not exist yet
    } finally {
      setVideosLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (detail && detail.status !== "pending" && detail.status !== "rejected") {
      fetchContract();
      fetchVideos();
    }
  }, [detail, fetchContract, fetchVideos]);

  const handleSaveContract = async () => {
    setContractSaving(true);
    setError("");
    try {
      const { contract: updated } = await adminAPI.updateCampaignContract(campaignId, clauseEdits);
      setContract(updated);
      if (updated.terms?.clauses) {
        setClauseEdits(updated.terms.clauses);
      }
      setShowContractEditor(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update contract");
    } finally {
      setContractSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!quotedCpmInput.trim() || !videoMinimumInput.trim()) {
      setError("Both Quoted CPM and Video Minimum are required to approve.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const { campaign } = await adminAPI.approveCampaign(
        campaignId,
        quotedCpmInput,
        Number(videoMinimumInput),
        adminNotes || undefined,
        minimumFundInput ? Number(minimumFundInput) : undefined,
      );
      if ((campaign as any).contractWarning) {
        setError(`Approved, but contract generation failed: ${(campaign as any).contractWarning}`);
        setDetail((d) => d ? { ...d, status: "accepted" } : d);
        onAction();
      } else {
        onAction();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve campaign");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      await adminAPI.rejectCampaign(campaignId, rejectionReason, adminNotes || undefined);
      onAction();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject campaign");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    setError("");
    try {
      await adminAPI.pauseCampaign(campaignId);
      onAction();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause campaign");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnd = async () => {
    setActionLoading(true);
    setError("");
    try {
      await adminAPI.endCampaign(campaignId);
      onAction();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end campaign");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCpm = async () => {
    if (!quotedCpmInput && !videoMinimumInput && !minimumFundInput && !budgetInput) return;
    setActionLoading(true);
    setError("");
    try {
      const data: { quotedCpm?: string; videoMinimum?: number; minimumFund?: number; budget?: number } = {};
      if (quotedCpmInput) data.quotedCpm = quotedCpmInput;
      if (videoMinimumInput) data.videoMinimum = Number(videoMinimumInput);
      if (minimumFundInput) data.minimumFund = Number(minimumFundInput);
      if (budgetInput) data.budget = Number(budgetInput);
      const { campaign } = await adminAPI.updateCampaign(campaignId, data);
      setDetail((d) =>
        d
          ? { ...d, quoted_cpm: campaign.quoted_cpm, video_minimum: campaign.video_minimum, minimum_fund: campaign.minimum_fund, budget: campaign.budget }
          : d,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update campaign");
    } finally {
      setActionLoading(false);
    }
  };

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
                  <p className="text-sm font-medium text-text-primary">{icp.name}</p>
                  {icp.description && (
                    <p className="text-xs text-text-secondary mt-1">{icp.description}</p>
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
                    <p className="text-xs font-medium text-text-primary">{comp.companyName}</p>
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

  const canApprove = quotedCpmInput.trim() !== "" && videoMinimumInput.trim() !== "";

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
            Loading campaign details...
          </div>
        ) : !detail ? (
          <div className="p-12 text-center text-red-400">
            {error || "Campaign not found"}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary">{detail.name}</h2>
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

            {/* Intake Form */}
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

            {/* Budget & CPM */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Budget & CPM
              </h3>
              <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3">
                <div className="flex justify-between items-center gap-4">
                  <span className="text-xs text-text-tertiary uppercase tracking-wider flex-shrink-0">
                    Monthly Budget
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-text-tertiary text-sm">$</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="w-28 px-2 py-1 rounded-lg bg-surface border border-border focus:border-emerald outline-none text-text-primary text-sm text-right"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center gap-4">
                  <span className="text-xs text-text-tertiary uppercase tracking-wider flex-shrink-0">
                    Quoted CPM
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-text-tertiary text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={quotedCpmInput}
                      onChange={(e) => setQuotedCpmInput(e.target.value)}
                      className="w-24 px-2 py-1 rounded-lg bg-surface border border-border focus:border-emerald outline-none text-text-primary text-sm text-right"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center gap-4">
                  <span className="text-xs text-text-tertiary uppercase tracking-wider flex-shrink-0">
                    Video Minimum
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={videoMinimumInput}
                      onChange={(e) => setVideoMinimumInput(e.target.value)}
                      className="w-24 px-2 py-1 rounded-lg bg-surface border border-border focus:border-emerald outline-none text-text-primary text-sm text-right"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center gap-4">
                  <span className="text-xs text-text-tertiary uppercase tracking-wider flex-shrink-0">
                    Minimum Fund
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-text-tertiary text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={minimumFundInput}
                      onChange={(e) => setMinimumFundInput(e.target.value)}
                      className="w-24 px-2 py-1 rounded-lg bg-surface border border-border focus:border-emerald outline-none text-text-primary text-sm text-right"
                      placeholder={detail.budget ? Number(detail.budget).toFixed(0) : "0"}
                    />
                    <button
                      onClick={handleSaveCpm}
                      disabled={actionLoading}
                      className="px-2 py-1 text-xs rounded-lg bg-emerald/10 border border-emerald/20 text-emerald hover:bg-emerald/20 transition-colors disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Gates */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Gates
              </h3>
              <div className="p-4 rounded-xl bg-surface-elevated border border-border">
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${detail.videos_ready ? "bg-green-400" : "bg-surface-hover"}`}
                    />
                    <span className="text-sm text-text-secondary">Videos Ready</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${detail.payment_ready ? "bg-green-400" : "bg-surface-hover"}`}
                    />
                    <span className="text-sm text-text-secondary">Payment Ready</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${detail.contract_ready ? "bg-green-400" : "bg-surface-hover"}`}
                    />
                    <span className="text-sm text-text-secondary">Contract Ready</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contract */}
            {contract !== undefined && detail.status !== "pending" && detail.status !== "rejected" && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text-primary">Contract</h3>
                  {contract && contract.status !== "signed" && (
                    <button
                      onClick={() => setShowContractEditor(!showContractEditor)}
                      className="text-xs text-emerald hover:underline"
                    >
                      {showContractEditor ? "Hide Editor" : "Edit Clauses"}
                    </button>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-4">
                  {contractLoading ? (
                    <p className="text-sm text-text-secondary">Loading contract...</p>
                  ) : !contract ? (
                    <div className="space-y-2">
                      <p className="text-sm text-text-tertiary">
                        No contract generated yet.
                      </p>
                      <button
                        onClick={async () => {
                          setContractLoading(true);
                          setError("");
                          try {
                            const { contract: c } = await adminAPI.generateCampaignContract(campaignId);
                            setContract(c);
                            if (c?.terms?.clauses) setClauseEdits(c.terms.clauses);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to generate contract");
                          } finally {
                            setContractLoading(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald/10 border border-emerald/20 text-emerald hover:bg-emerald/20 transition-colors text-sm font-medium"
                      >
                        Generate Contract
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Contract status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              contract.status === "signed"
                                ? "bg-green-400"
                                : contract.status === "voided"
                                  ? "bg-red-400"
                                  : "bg-yellow-400"
                            }`}
                          />
                          <span className="text-sm text-text-secondary capitalize">
                            {contract.status}
                          </span>
                          {contract.signed_at && (
                            <span className="text-xs text-text-tertiary">
                              &middot; Signed{" "}
                              {new Date(contract.signed_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                              {contract.legal_name && ` by ${contract.legal_name}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* PDF Preview */}
                      {contract.presigned_pdf_url ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-text-tertiary">PDF Preview</p>
                            <a
                              href={contract.presigned_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald hover:underline"
                            >
                              Open in new tab &rarr;
                            </a>
                          </div>
                          <iframe
                            src={contract.presigned_pdf_url}
                            className="w-full h-[400px] rounded-lg border border-border bg-white"
                            title="Contract PDF"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-text-tertiary">
                          PDF preview unavailable — check S3 credentials.
                        </p>
                      )}

                      {/* Clause Editor (only for unsigned contracts) */}
                      {showContractEditor && contract.status !== "signed" && (
                        <div className="space-y-3 pt-2 border-t border-border">
                          <p className="text-xs text-text-tertiary">
                            Edit contract clauses below. Changes will regenerate the PDF.
                          </p>

                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">
                              Parties Clause
                            </label>
                            <textarea
                              value={clauseEdits.parties || ""}
                              onChange={(e) =>
                                setClauseEdits((prev) => ({ ...prev, parties: e.target.value }))
                              }
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg bg-surface border border-border focus:border-emerald outline-none text-text-primary text-sm"
                              placeholder="Leave empty for default"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">
                              Provider Obligations
                            </label>
                            <textarea
                              value={clauseEdits.providerObligations || ""}
                              onChange={(e) =>
                                setClauseEdits((prev) => ({
                                  ...prev,
                                  providerObligations: e.target.value,
                                }))
                              }
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg bg-surface border border-border focus:border-emerald outline-none text-text-primary text-sm"
                              placeholder="Leave empty for default"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">
                              Client Obligations
                            </label>
                            <textarea
                              value={clauseEdits.clientObligations || ""}
                              onChange={(e) =>
                                setClauseEdits((prev) => ({
                                  ...prev,
                                  clientObligations: e.target.value,
                                }))
                              }
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg bg-surface border border-border focus:border-emerald outline-none text-text-primary text-sm"
                              placeholder="Leave empty for default"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">
                              Payment Terms
                            </label>
                            <textarea
                              value={clauseEdits.paymentTerms || ""}
                              onChange={(e) =>
                                setClauseEdits((prev) => ({
                                  ...prev,
                                  paymentTerms: e.target.value,
                                }))
                              }
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg bg-surface border border-border focus:border-emerald outline-none text-text-primary text-sm"
                              placeholder="Leave empty for default"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">
                              Additional Clauses (one per line)
                            </label>
                            <textarea
                              value={(clauseEdits.additionalClauses || []).join("\n")}
                              onChange={(e) =>
                                setClauseEdits((prev) => ({
                                  ...prev,
                                  additionalClauses: e.target.value
                                    .split("\n")
                                    .filter((line) => line.trim()),
                                }))
                              }
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg bg-surface border border-border focus:border-emerald outline-none text-text-primary text-sm"
                              placeholder="Each line becomes a separate additional clause section"
                            />
                          </div>

                          <button
                            onClick={handleSaveContract}
                            disabled={contractSaving}
                            className="w-full py-2 rounded-lg bg-emerald/10 border border-emerald/20 text-emerald hover:bg-emerald/20 transition-colors disabled:opacity-50 font-medium text-sm"
                          >
                            {contractSaving ? "Regenerating..." : "Save & Regenerate PDF"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Videos */}
            {detail.status !== "pending" && detail.status !== "rejected" && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-primary mb-3">
                  Videos
                </h3>
                <div className="p-4 rounded-xl bg-surface-elevated border border-border">
                  {videosLoading ? (
                    <p className="text-sm text-text-secondary">Loading videos...</p>
                  ) : videos.length === 0 ? (
                    <p className="text-sm text-text-tertiary">No videos uploaded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {videos.map((video) => (
                        <div
                          key={video.id}
                          className="flex items-center justify-between gap-3 p-2 rounded-lg bg-surface border border-border"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm text-text-primary truncate">
                              {video.file_name || video.title || `Video #${video.id}`}
                            </span>
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[10px] rounded border capitalize flex-shrink-0 ${
                                video.status === "ready"
                                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                                  : video.status === "failed"
                                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                                    : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                              }`}
                            >
                              {video.status}
                            </span>
                          </div>
                          {video.presigned_url && (
                            <a
                              href={video.presigned_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald hover:underline flex-shrink-0"
                            >
                              View
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Google Drive Folder */}
            {detail.google_drive_folder_id && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-primary mb-2">
                  Google Drive Folder
                </h3>
                <a
                  href={`https://drive.google.com/drive/folders/${detail.google_drive_folder_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-emerald hover:underline"
                >
                  Open in Google Drive
                </a>
              </div>
            )}

            {/* Rejection Reason */}
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
                    disabled={actionLoading || !canApprove}
                    className="flex-1 py-2.5 rounded-lg bg-emerald text-black hover:bg-emerald-light transition-colors disabled:opacity-50 font-medium"
                    title={!canApprove ? "Both Quoted CPM and Video Minimum are required" : undefined}
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

            {/* Publish Videos link for started campaigns */}
            {detail.status === "started" && (
              <div className="border-t border-border pt-4 mt-4">
                <button
                  onClick={() => {
                    onClose();
                    publishRouter.push(`/dashboard/campaigns/${campaignId}/publish`);
                  }}
                  className="w-full py-2.5 rounded-lg bg-emerald/10 border border-emerald/20 text-emerald hover:bg-emerald/20 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Manage & Publish Videos
                </button>
              </div>
            )}

            {/* Pause action for started campaigns */}
            {detail.status === "started" && (
              <div className="border-t border-border pt-4 mt-4">
                <button
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50 font-medium"
                >
                  {actionLoading ? "Processing..." : "Pause Campaign"}
                </button>
              </div>
            )}

            {/* End action for started or paused campaigns */}
            {(detail.status === "started" || detail.status === "paused") && (
              <div className={detail.status === "paused" ? "border-t border-border pt-4 mt-4" : "mt-2"}>
                <button
                  onClick={handleEnd}
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 font-medium"
                >
                  {actionLoading ? "Processing..." : "End Campaign"}
                </button>
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

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const result = await adminAPI.getCampaigns({
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: ITEMS_PER_PAGE,
        offset,
      });
      setCampaigns(result.campaigns ?? []);
      setTotal(result.total ?? 0);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Campaigns</h1>
        <p className="text-text-secondary">
          Review and manage advertiser campaigns
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
          <option value="started">Started</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Campaigns Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-secondary">
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            No campaigns found.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-elevated border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Team Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Campaign Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  CPM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Video Min
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Gates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="hover:bg-surface-hover transition-colors cursor-pointer"
                  onClick={() => setSelectedCampaignId(campaign.id)}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-text-primary">
                      {campaign.team_name}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      Team #{campaign.team_id}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-primary">{campaign.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-lg border ${getStatusBadgeClass(campaign.status)} capitalize`}
                    >
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-secondary">
                      {campaign.budget
                        ? `$${Number(campaign.budget).toLocaleString()}`
                        : <span className="text-text-tertiary">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-secondary">
                      {campaign.quoted_cpm
                        ? `$${Number(campaign.quoted_cpm).toFixed(2)}`
                        : campaign.budget
                          ? <span className="text-text-tertiary text-xs">${getTierCpm(campaign.budget)} (tier)</span>
                          : <span className="text-text-tertiary">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-secondary">
                      {campaign.video_minimum != null
                        ? campaign.video_minimum
                        : <span className="text-text-tertiary">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5 items-center">
                      <span
                        className={`w-2 h-2 rounded-full ${campaign.videos_ready ? "bg-green-400" : "bg-surface-hover"}`}
                        title="Videos Ready"
                      />
                      <span
                        className={`w-2 h-2 rounded-full ${campaign.payment_ready ? "bg-green-400" : "bg-surface-hover"}`}
                        title="Payment Ready"
                      />
                      <span
                        className={`w-2 h-2 rounded-full ${campaign.contract_ready ? "bg-green-400" : "bg-surface-hover"}`}
                        title="Contract Ready"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-secondary">
                      {new Date(campaign.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedCampaignId && (
        <DetailModal
          campaignId={selectedCampaignId}
          onClose={() => setSelectedCampaignId(null)}
          onAction={fetchCampaigns}
        />
      )}
    </div>
  );
}
