"use client";

import { useCallback, useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { massPostingStatusAtom, massPostingLoadingAtom } from "@/store/massPosting";
import { intakeAPI, ApplicationStatus } from "@/api/intake";

export function useMassPosting() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [status, setStatus] = useAtom(massPostingStatusAtom);
  const [isLoading, setIsLoading] = useAtom(massPostingLoadingAtom);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!selectedTeam?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await intakeAPI.getApplicationStatus(selectedTeam.id);
      setStatus(result);
    } catch (err: any) {
      setError(err.message || "Failed to fetch mass posting status");
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam?.id, setIsLoading, setStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // TODO(human): Decide on the refetch/cache invalidation strategy
  const refetch = useCallback(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    isApproved: status?.applicationStatus === "accepted",
    isPending: status?.applicationStatus === "pending" || status?.applicationStatus === "appeal",
    isRejected: status?.applicationStatus === "rejected",
    hasIntakeForm: status?.hasIntakeForm ?? false,
    intakeFormCompleted: status?.intakeFormCompleted ?? false,
    googleDriveFolderId: status?.googleDriveFolderId ?? null,
    applicationStatus: status?.applicationStatus ?? null,
    isLoading,
    error,
    refetch,
  };
}
