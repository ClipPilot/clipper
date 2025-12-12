"use client";

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { userTeamsAtom, selectedTeamAtom } from "@/store/auth";
import { teamAPI, Team } from "@/api/team";

export function useTeams() {
  const [teams, setTeams] = useAtom(userTeamsAtom);
  const [selectedTeam, setSelectedTeam] = useAtom(selectedTeamAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const fetchedTeams = await teamAPI.getUserTeams();
      setTeams(fetchedTeams);

      if (fetchedTeams.length === 0) {
        setSelectedTeam(null);
        return;
      }

      if (selectedTeam) {
        const teamStillExists = fetchedTeams.find(t => t.id === selectedTeam.id);
        if (teamStillExists) {
          setSelectedTeam(teamStillExists);
        } else {
          setSelectedTeam(fetchedTeams[fetchedTeams.length - 1]);
        }
      } else {
        setSelectedTeam(fetchedTeams[fetchedTeams.length - 1]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch teams");
      console.error("Error fetching teams:", err);

      if (err.message?.includes("Unauthorized") || err.message?.includes("401")) {
        if (typeof window !== "undefined") {
          localStorage.clear();
        }
        setTeams([]);
        setSelectedTeam(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [setTeams, setSelectedTeam]);

  const selectTeam = useCallback(
    (team: Team) => {
      setSelectedTeam(team);
    },
    [setSelectedTeam]
  );

  const fetchDefaultTeam = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const defaultTeam = await teamAPI.getDefaultTeam();
      setSelectedTeam(defaultTeam);
      return defaultTeam;
    } catch (err: any) {
      setError(err.message || "Failed to fetch default team");
      console.error("Error fetching default team:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setSelectedTeam]);

  useEffect(() => {
    fetchTeams();
  }, []);

  return {
    teams,
    selectedTeam,
    isLoading,
    error,
    fetchTeams,
    selectTeam,
    fetchDefaultTeam,
  };
}
