"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { adminAPI, Team, Pagination } from "@/lib/api";

const ITEMS_PER_PAGE = 10;

export default function DashboardPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadTeams = useCallback(async (offset = 0) => {
    setIsLoading(true);
    try {
      const result = await adminAPI.getTeams({
        search: debouncedSearch || undefined,
        limit: ITEMS_PER_PAGE,
        offset,
      });
      setTeams(result.teams);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadTeams(0);
  }, [loadTeams]);

  const handlePrevPage = () => {
    if (pagination && pagination.offset > 0) {
      loadTeams(Math.max(0, pagination.offset - ITEMS_PER_PAGE));
    }
  };

  const handleNextPage = () => {
    if (pagination?.hasMore) {
      loadTeams(pagination.offset + ITEMS_PER_PAGE);
    }
  };

  const getPlanBadgeClass = (plan: string) => {
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

  const getUsageDisplay = (team: Team) => {
    const created = team.usage?.clips_created ?? 0;
    const limit = team.usage?.limit ?? 0;
    return { created, limit };
  };

  const getUsagePercent = (team: Team) => {
    const { created, limit } = getUsageDisplay(team);
    if (limit === 0) return 0;
    return Math.min((created / limit) * 100, 100);
  };

  const currentPage = pagination ? Math.floor(pagination.offset / ITEMS_PER_PAGE) + 1 : 1;
  const totalPages = pagination ? Math.ceil(pagination.total / ITEMS_PER_PAGE) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Teams</h1>
          <p className="text-text-secondary mt-1">Manage all workspaces and enterprise subscriptions</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-tertiary">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
          {pagination?.total ?? 0} teams
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search teams by name, email, or plan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary placeholder-text-muted transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Team</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Usage</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Members</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Owner</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
                    </div>
                  </td>
                </tr>
              ) : teams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-text-tertiary">
                    <svg className="w-12 h-12 mx-auto mb-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {debouncedSearch ? `No teams found for "${debouncedSearch}"` : "No teams found"}
                  </td>
                </tr>
              ) : (
                teams.map((team) => {
                  const { created, limit } = getUsageDisplay(team);
                  return (
                    <tr key={team.id} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center text-text-secondary font-semibold">
                            {team.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-text-primary">{team.name}</div>
                            <div className="text-xs text-text-muted">ID: {team.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${getPlanBadgeClass(team.plan)}`}>
                          {team.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-text-primary font-medium">
                          {created.toLocaleString()} / {limit.toLocaleString()}
                        </div>
                        <div className="w-28 h-1.5 bg-surface-elevated rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald to-emerald-light rounded-full transition-all"
                            style={{ width: `${getUsagePercent(team)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-text-secondary">
                          {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-text-secondary truncate max-w-[200px] block">
                          {team.ownerEmail || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {team.plan !== "enterprise" && (
                          <button
                            onClick={() => router.push(`/dashboard/enterprise?teamId=${team.id}`)}
                            className="text-sm px-4 py-2 rounded-lg bg-emerald/10 text-emerald hover:bg-emerald/20 border border-emerald/20 hover:border-emerald/40 transition-all font-medium"
                          >
                            Setup Enterprise
                          </button>
                        )}
                        {team.plan === "enterprise" && (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-semibold text-emerald">
                              ${((team.enterpriseMonthlyPrice || 0) / 100).toFixed(2)}/mo
                            </span>
                            <span className="text-xs text-text-muted">
                              {team.enterpriseClipLimit?.toLocaleString()} clips
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.total > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-elevated/50">
            <div className="text-sm text-text-muted">
              Showing {pagination.offset + 1} - {Math.min(pagination.offset + ITEMS_PER_PAGE, pagination.total)} of {pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={pagination.offset === 0}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface border border-border hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-text-secondary"
              >
                Previous
              </button>
              <span className="text-sm text-text-secondary px-3">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={!pagination.hasMore}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface border border-border hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-text-secondary"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
