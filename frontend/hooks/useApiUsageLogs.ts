"use client";

import { useState, useCallback, useEffect } from "react";
import { useAtom } from "jotai";
import { toast } from "@heroui/react";
import { selectedTeamAtom } from "@/store/auth";
import {
  apiPlatformAPI,
  type UsageLog,
  type ClipJobStatus,
  type FaceSwapJobStatus,
} from "@/api/apiPlatform";

export function useApiUsageLogs() {
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const teamId = selectedTeam?.id;

  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [usageTotal, setUsageTotal] = useState(0);
  const [usageLoading, setUsageLoading] = useState(true);

  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobModalLoading, setJobModalLoading] = useState(false);
  const [jobModalType, setJobModalType] = useState<"clip" | "face-swap">("clip");
  const [clipJobResult, setClipJobResult] = useState<ClipJobStatus | null>(null);
  const [faceSwapJobResult, setFaceSwapJobResult] = useState<FaceSwapJobStatus | null>(null);

  const fetchUsageLogs = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await apiPlatformAPI.getUsageLogs(teamId, 20);
      setUsageLogs(data.logs);
      setUsageTotal(data.total);
    } catch {
      // Non-critical
    } finally {
      setUsageLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchUsageLogs();
  }, [fetchUsageLogs]);

  const openJobModal = async (log: UsageLog) => {
    if (!teamId || !log.metadata?.jobId) return;
    const isClip = log.endpoint.includes("/v1/clip");
    setJobModalType(isClip ? "clip" : "face-swap");
    setClipJobResult(null);
    setFaceSwapJobResult(null);
    setJobModalOpen(true);
    setJobModalLoading(true);
    try {
      if (isClip) {
        const result = await apiPlatformAPI.getClipJobStatus(teamId, String(log.metadata.jobId));
        setClipJobResult(result);
      } else {
        const result = await apiPlatformAPI.getFaceSwapJobStatus(teamId, String(log.metadata.jobId));
        setFaceSwapJobResult(result);
      }
    } catch {
      toast.danger("Error", { description: "Failed to load job results" });
      setJobModalOpen(false);
    } finally {
      setJobModalLoading(false);
    }
  };

  const closeJobModal = () => setJobModalOpen(false);

  return {
    usageLogs,
    usageTotal,
    usageLoading,
    jobModalOpen,
    jobModalLoading,
    jobModalType,
    clipJobResult,
    faceSwapJobResult,
    openJobModal,
    closeJobModal,
  };
}
