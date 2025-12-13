"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { teamAPI, TeamUsageStats } from "@/api/team";

export function useUsageStats(teamId?: number) {
  const [usageStats, setUsageStats] = useState<TeamUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchUsageStats = useCallback(async () => {
    if (!teamId) {
      setIsLoading(false);
      setUsageStats(null);
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setIsLoading(false);
        return;
      }
    }

    isFetchingRef.current = true;

    try {
      setError(null);
      const stats = await teamAPI.getTeamUsageStats(teamId);
      setUsageStats(stats);
      setIsLoading(false);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch usage stats";
      setError(errorMessage);
      setIsLoading(false);

      if (err.message?.includes("Unauthorized") || err.message?.includes("401")) {
        setUsageStats(null);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [teamId]);

  useEffect(() => {
    fetchUsageStats();
  }, [fetchUsageStats]);

  return {
    usageStats,
    isLoading,
    error,
    refetch: fetchUsageStats,
  };
}
