"use client";

import { useCallback, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { campaignsListAtom, campaignsLoadingAtom } from "@/store/campaigns";
import { campaignAPI } from "@/api/campaign";

export function useCampaigns() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [campaigns, setCampaigns] = useAtom(campaignsListAtom);
  const [isLoading, setIsLoading] = useAtom(campaignsLoadingAtom);

  const fetchCampaigns = useCallback(async () => {
    if (!selectedTeam?.id) return;

    setIsLoading(true);
    try {
      const result = await campaignAPI.listCampaigns(selectedTeam.id);
      setCampaigns(result.campaigns);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam?.id, setCampaigns, setIsLoading]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const refetch = useCallback(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return { campaigns, isLoading, refetch };
}
