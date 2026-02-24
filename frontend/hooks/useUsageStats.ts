"use client";

import { useState, useEffect, useCallback } from "react";
import { teamAPI, TeamUsageStats } from "@/api/team";

export function useUsageStats(teamId?: number) {
  const [usageStats, setUsageStats] = useState<TeamUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) {
      setIsLoading(false);
      setUsageStats(null);
      return;
    }

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setIsLoading(false);
        return;
      }
    }

    let cancelled = false;

    // Clear stale data immediately so old team's credits don't flash
    setUsageStats(null);
    setIsLoading(true);
    setError(null);

    teamAPI
      .getTeamUsageStats(teamId)
      .then((stats) => {
        if (!cancelled) {
          setUsageStats(stats);
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          const errorMessage = err.message || "Failed to fetch usage stats";
          setError(errorMessage);
          setIsLoading(false);
          if (err.message?.includes("Unauthorized") || err.message?.includes("401")) {
            setUsageStats(null);
          }
        }
      });

    // Cancel stale response if teamId changes before this fetch completes
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const refetch = useCallback(async () => {
    if (!teamId) return;
    try {
      setError(null);
      const stats = await teamAPI.getTeamUsageStats(teamId);
      setUsageStats(stats);
    } catch (err: any) {
      setError(err.message || "Failed to fetch usage stats");
    }
  }, [teamId]);

  return { usageStats, isLoading, error, refetch };
}
