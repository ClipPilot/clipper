"use client";

import { useEffect, useState } from "react";
import { adminAPI, AdminReferral } from "@/lib/api";

interface SetRewardModalProps {
  referral: AdminReferral;
  onClose: () => void;
  onSuccess: () => void;
}

function SetRewardModal({ referral, onClose, onSuccess }: SetRewardModalProps) {
  const [rewardType, setRewardType] = useState<"clips" | "percent">(
    parseFloat(referral.percentOff) > 0 ? "percent" : "clips"
  );
  const [bonusClips, setBonusClips] = useState(referral.bonusClips.toString() || "0");
  const [percentOff, setPercentOff] = useState(referral.percentOff || "0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await adminAPI.setReferralReward(
        referral.id,
        rewardType === "clips" ? parseInt(bonusClips) : 0,
        rewardType === "percent" ? parseFloat(percentOff) : 0
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set reward");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Set Referral Reward
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          {referral.referrerTeamName} referred {referral.referredTeamName}
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Reward Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRewardType("clips")}
                className={`flex-1 py-2.5 rounded-lg border transition-colors ${
                  rewardType === "clips"
                    ? "bg-emerald/20 border-emerald text-emerald"
                    : "bg-surface-elevated border-border text-text-secondary hover:border-text-muted"
                }`}
              >
                Bonus Clips
              </button>
              <button
                type="button"
                onClick={() => setRewardType("percent")}
                className={`flex-1 py-2.5 rounded-lg border transition-colors ${
                  rewardType === "percent"
                    ? "bg-purple-500/20 border-purple-500 text-purple-400"
                    : "bg-surface-elevated border-border text-text-secondary hover:border-text-muted"
                }`}
              >
                Percent Off
              </button>
            </div>
          </div>

          {rewardType === "clips" ? (
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Bonus Clips</label>
              <input
                type="number"
                value={bonusClips}
                onChange={e => setBonusClips(e.target.value)}
                required
                min="0"
                className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary"
                placeholder="100"
              />
              <p className="text-xs text-text-muted mt-1.5">
                Applied on the referrer&apos;s next subscription renewal
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Percent Off (%)</label>
              <input
                type="number"
                value={percentOff}
                onChange={e => setPercentOff(e.target.value)}
                required
                min="0"
                max="100"
                step="0.5"
                className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-purple-500 outline-none text-text-primary"
                placeholder="10"
              />
              <p className="text-xs text-text-muted mt-1.5">
                Accumulated perpetually on referrer&apos;s subscription
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-lg bg-emerald text-black font-medium hover:bg-emerald-light transition-colors disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Set Reward"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<AdminReferral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedReferral, setSelectedReferral] = useState<AdminReferral | null>(null);

  const loadReferrals = async () => {
    setIsLoading(true);
    try {
      const result = await adminAPI.getReferrals();
      setReferrals(result.referrals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referrals");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  const getPlanBadgeClass = (plan: string | null) => {
    switch (plan) {
      case "enterprise":
        return "bg-emerald/20 text-emerald border border-emerald/30";
      case "scale":
        return "bg-purple-500/20 text-purple-400 border border-purple-500/30";
      case "studio":
        return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
      default:
        return "bg-text-muted/20 text-text-tertiary border border-text-muted/30";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400 border border-green-500/30";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
      case "churned":
        return "bg-red-500/20 text-red-400 border border-red-500/30";
      default:
        return "bg-text-muted/20 text-text-tertiary border border-text-muted/30";
    }
  };

  const formatReward = (referral: AdminReferral) => {
    const percentOff = parseFloat(referral.percentOff);
    if (percentOff > 0) {
      return <span className="text-purple-400">{percentOff}% off</span>;
    }
    if (referral.bonusClips > 0) {
      return <span className="text-emerald">+{referral.bonusClips} clips</span>;
    }
    return <span className="text-text-muted">Not set</span>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const activeCount = referrals.filter(r => r.status === "active").length;
  const pendingCount = referrals.filter(r => r.status === "pending").length;
  const totalClipsRewarded = referrals.reduce((sum, r) => sum + r.bonusClips, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Referrals</h1>
          <p className="text-text-secondary mt-1">Manage referral rewards and track conversions</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-text-tertiary">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {activeCount} active
          </div>
          <div className="flex items-center gap-2 text-text-tertiary">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            {pendingCount} pending
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-sm text-text-secondary mb-1">Total Referrals</div>
          <div className="text-2xl font-bold text-text-primary">{referrals.length}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-sm text-text-secondary mb-1">Active Referrals</div>
          <div className="text-2xl font-bold text-emerald">{activeCount}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-sm text-text-secondary mb-1">Total Clips Rewarded</div>
          <div className="text-2xl font-bold text-text-primary">{totalClipsRewarded.toLocaleString()}</div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-lg shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-elevated border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Referrer</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Referred</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Reward</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
                    </div>
                  </td>
                </tr>
              ) : referrals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-text-tertiary">
                    <svg className="w-12 h-12 mx-auto mb-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    No referrals yet
                  </td>
                </tr>
              ) : (
                referrals.map((referral) => (
                  <tr key={referral.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-text-primary">{referral.referrerTeamName}</div>
                        <div className="text-xs text-text-muted">{referral.referrerEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-text-primary">{referral.referredTeamName}</div>
                        <div className="text-xs text-text-muted">{referral.referredEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${getPlanBadgeClass(referral.referredPlan)}`}>
                        {referral.referredPlan || "free"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg capitalize ${getStatusBadgeClass(referral.status)}`}>
                        {referral.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {formatDate(referral.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      {formatReward(referral)}
                      {referral.rewardApplied && (
                        <span className="ml-2 text-xs text-text-muted">(applied)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedReferral(referral)}
                        className="text-sm px-4 py-2 rounded-lg bg-emerald/10 text-emerald hover:bg-emerald/20 border border-emerald/20 hover:border-emerald/40 transition-all font-medium"
                      >
                        Set Reward
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedReferral && (
        <SetRewardModal
          referral={selectedReferral}
          onClose={() => setSelectedReferral(null)}
          onSuccess={loadReferrals}
        />
      )}
    </div>
  );
}
