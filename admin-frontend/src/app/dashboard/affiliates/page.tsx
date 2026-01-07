"use client";

import { useEffect, useState } from "react";
import { adminAPI, AdminAffiliate } from "@/lib/api";

export default function AffiliatesPage() {
  const [affiliates, setAffiliates] = useState<AdminAffiliate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAffiliates = async () => {
    setIsLoading(true);
    try {
      const result = await adminAPI.getAffiliates();
      setAffiliates(result.affiliates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load affiliates");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAffiliates();
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `$${num.toFixed(2)}`;
  };

  const activeCount = affiliates.filter(a => a.status === "active").length;
  const pendingCount = affiliates.filter(a => a.status === "pending").length;
  const totalCommission = affiliates.reduce(
    (sum, a) => sum + parseFloat(a.commissionEarned || "0"),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Affiliates</h1>
          <p className="text-text-secondary mt-1">Track affiliate partnerships and commissions</p>
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
          <div className="text-sm text-text-secondary mb-1">Total Affiliates</div>
          <div className="text-2xl font-bold text-text-primary">{affiliates.length}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-sm text-text-secondary mb-1">Active Affiliates</div>
          <div className="text-2xl font-bold text-emerald">{activeCount}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-sm text-text-secondary mb-1">Total Commission Earned</div>
          <div className="text-2xl font-bold text-text-primary">{formatCurrency(totalCommission)}</div>
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Affiliate</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Brand</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Commission</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Rate</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
                    </div>
                  </td>
                </tr>
              ) : affiliates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-text-tertiary">
                    <svg className="w-12 h-12 mx-auto mb-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    No affiliates yet
                  </td>
                </tr>
              ) : (
                affiliates.map((affiliate) => (
                  <tr key={affiliate.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-text-primary">{affiliate.affiliateName}</div>
                        <div className="text-xs text-text-muted">{affiliate.affiliateEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="px-2 py-1 text-xs bg-surface-elevated rounded text-emerald font-mono">
                        {affiliate.affiliateCode}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-text-primary">{affiliate.teamName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${getPlanBadgeClass(affiliate.teamPlan)}`}>
                        {affiliate.teamPlan || "free"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg capitalize ${getStatusBadgeClass(affiliate.status)}`}>
                        {affiliate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-emerald">
                        {formatCurrency(affiliate.commissionEarned)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {affiliate.commissionPercent}%
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {formatDate(affiliate.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
