"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { userTeamsAtom, selectedTeamAtom, defaultTeamIdAtom, type Team } from "@/store/auth";
import { teamAPI } from "@/api/team";

export function useTeams() {
  const [teams, setTeams] = useAtom(userTeamsAtom);
  const [selectedTeam, setSelectedTeam] = useAtom(selectedTeamAtom);
  const [defaultTeamId, setDefaultTeamId] = useAtom(defaultTeamIdAtom);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasAppliedDefault = useRef(false);

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

      const storedSelectedTeam = localStorage.getItem("selectedTeam");
      const parsedSelectedTeam = storedSelectedTeam ? JSON.parse(storedSelectedTeam) : null;

      if (parsedSelectedTeam) {
        const teamStillExists = fetchedTeams.find(t => t.id === parsedSelectedTeam.id);
        if (teamStillExists) {
          setSelectedTeam(teamStillExists);
          hasAppliedDefault.current = true;
          return;
        }
      }

      const storedDefaultId = localStorage.getItem("defaultTeamId");
      const parsedDefaultId = storedDefaultId ? JSON.parse(storedDefaultId) : null;

      if (parsedDefaultId) {
        const defaultTeam = fetchedTeams.find(t => t.id === parsedDefaultId);
        if (defaultTeam) {
          setSelectedTeam(defaultTeam);
          hasAppliedDefault.current = true;
          return;
        }
      }

      setSelectedTeam(fetchedTeams[fetchedTeams.length - 1]);
      hasAppliedDefault.current = true;
    } catch (err: any) {
      setError(err.message || "Failed to fetch teams");

      if (err.message?.includes("Unauthorized") || err.message?.includes("401")) {
        if (typeof window !== "undefined") localStorage.clear();
        setTeams([]);
        setSelectedTeam(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [setTeams, setSelectedTeam]);

  const selectTeam = useCallback(
    (team: Team) => { setSelectedTeam(team); },
    [setSelectedTeam]
  );

  const setAsDefaultTeam = useCallback(
    (teamId: number | null) => { setDefaultTeamId(teamId); },
    [setDefaultTeamId]
  );

  useEffect(() => { fetchTeams(); }, []);

  useEffect(() => {
    if (hasAppliedDefault.current) return;
    if (!defaultTeamId || teams.length === 0) return;
    if (selectedTeam) { hasAppliedDefault.current = true; return; }

    const defaultTeam = teams.find(t => t.id === defaultTeamId);
    if (defaultTeam) {
      setSelectedTeam(defaultTeam);
      hasAppliedDefault.current = true;
    }
  }, [defaultTeamId, teams, selectedTeam, setSelectedTeam]);

  return { teams, selectedTeam, defaultTeamId, isLoading, error, fetchTeams, selectTeam, setAsDefaultTeam };
}
