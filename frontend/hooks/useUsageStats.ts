"use client";

import { useState, useEffect } from "react";
import { teamAPI, TeamUsageStats } from "@/api/team";

export function useUsageStats(teamId?: number) {
  const [usageStats, setUsageStats] = useState<TeamUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageStats = async () => {
    if (!teamId) {
      setIsLoading(false);
      return;
    }

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setIsLoading(false);
        return;
      }
    }

    try {
      setIsLoading(true);
      setError(null);
      const stats = await teamAPI.getTeamUsageStats(teamId);
      setUsageStats(stats);
    } catch (err: any) {
      setError(err.message || "Failed to fetch usage stats");
      console.error("Error fetching usage stats:", err);

      if (err.message?.includes("Unauthorized") || err.message?.includes("401")) {
        setUsageStats(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageStats();
  }, [teamId]); // Refetch when teamId changes

  return {
    usageStats,
    isLoading,
    error,
    refetch: fetchUsageStats,
  };
}
