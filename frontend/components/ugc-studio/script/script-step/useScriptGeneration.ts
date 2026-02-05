"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ugcScriptAPI } from "@/api/ugc";
import { connectSocket, joinTeam, leaveTeam } from "@/lib/socket";
import type { UGCScript, ProductImage } from "../types";
import type { ScriptGenerationState, CustomPatternStep } from "./types";

interface UseScriptGenerationProps {
  teamId: number;
  characterId: number;
  onScriptGenerated: (scripts: UGCScript[], scriptId: string, productImageKeys: string[]) => void;
  onError: (error: string) => void;
}

interface GenerateScriptParams {
  productImages: ProductImage[];
  productName: string;
  scriptDirection: string;
  selectedStructureId: string;
  customPattern?: CustomPatternStep[];
}

const POLL_INTERVAL = 5000; // Poll every 5 seconds as fallback

export function useScriptGeneration({
  teamId,
  characterId,
  onScriptGenerated,
  onError,
}: UseScriptGenerationProps) {
  const [state, setState] = useState<ScriptGenerationState>({
    isGenerating: false,
    generationProgress: 0,
    progressMessage: "",
    pendingScriptId: null,
    error: null,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCompletedRef = useRef(false);

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollScriptStatus = useCallback(async (scriptIdToPoll: string, productImages: ProductImage[]) => {
    // Prevent duplicate completions
    if (isCompletedRef.current) return true;

    try {
      const statusResponse = await ugcScriptAPI.getScriptStatus(scriptIdToPoll);

      // Update progress from polling
      if (statusResponse.status === "generating" || statusResponse.status === "queued") {
        setState((prev) => ({
          ...prev,
          generationProgress: statusResponse.progress || prev.generationProgress,
          progressMessage: statusResponse.progressMessage || prev.progressMessage,
        }));
        return false;
      }

      if (statusResponse.status === "failed") {
        isCompletedRef.current = true;
        clearPolling();
        onError(statusResponse.error || "Script generation failed");
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          pendingScriptId: null,
        }));
        return true;
      }

      if (statusResponse.status === "completed") {
        // Fetch full script data
        const response = await ugcScriptAPI.getFullScript(scriptIdToPoll);
        if (response.success && response.scripts && response.scripts.length > 0) {
          isCompletedRef.current = true;
          clearPolling();
          onScriptGenerated(
            response.scripts,
            scriptIdToPoll,
            productImages.map((img) => img.key)
          );
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            pendingScriptId: null,
            generationProgress: 100,
            progressMessage: "Complete!",
          }));
          return true;
        }
      }
    } catch (err) {
      console.log("[useScriptGeneration] Polling: script not ready yet or error", err);
    }
    return false;
  }, [onScriptGenerated, onError, clearPolling]);

  const generate = useCallback(async (params: GenerateScriptParams) => {
    const { productImages, productName, scriptDirection, selectedStructureId, customPattern } = params;

    if (!scriptDirection.trim()) {
      onError("Please provide a script direction");
      return false;
    }

    // Reset completion tracking
    isCompletedRef.current = false;
    clearPolling();

    setState({
      isGenerating: true,
      generationProgress: 0,
      progressMessage: "Queuing script generation...",
      pendingScriptId: null,
      error: null,
    });

    try {
      const response = await ugcScriptAPI.generateScript({
        teamId,
        characterId,
        productImageKeys: productImages.map((img) => img.key),
        productName: productName || undefined,
        scriptDirection: scriptDirection || undefined,
        numberOfVariations: 2,
        structureId: selectedStructureId,
        customPattern: selectedStructureId === "custom" ? customPattern : undefined,
      });

      setState((prev) => ({
        ...prev,
        pendingScriptId: response.scriptId,
      }));

      return true;
    } catch (err: any) {
      onError(err.message || "Failed to generate script");
      setState((prev) => ({
        ...prev,
        isGenerating: false,
      }));
      return false;
    }
  }, [teamId, characterId, onError, clearPolling]);

  // WebSocket effect for real-time updates + polling fallback
  useEffect(() => {
    if (!state.pendingScriptId) return;

    const scriptId = state.pendingScriptId;
    isCompletedRef.current = false;

    const socket = connectSocket();
    joinTeam(teamId);

    interface ScriptJobUpdate {
      scriptId: string;
      status: "queued" | "generating" | "completed" | "failed";
      progress: number;
      progressMessage: string;
      scripts?: UGCScript[];
      error?: string;
    }

    const handleScriptUpdate = (update: ScriptJobUpdate) => {
      if (update.scriptId !== scriptId || isCompletedRef.current) return;

      setState((prev) => ({
        ...prev,
        generationProgress: update.progress,
        progressMessage: update.progressMessage,
      }));

      if (update.status === "completed" && update.scripts) {
        isCompletedRef.current = true;
        clearPolling();
        onScriptGenerated(update.scripts, update.scriptId, []);
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          pendingScriptId: null,
        }));
      } else if (update.status === "failed") {
        isCompletedRef.current = true;
        clearPolling();
        onError(update.error || "Script generation failed");
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          pendingScriptId: null,
        }));
      }
    };

    socket.on("script-job-update", handleScriptUpdate);

    // Start polling immediately as fallback for WebSocket disconnection
    // This ensures we catch completion even if WebSocket drops
    pollIntervalRef.current = setInterval(() => {
      if (!isCompletedRef.current) {
        pollScriptStatus(scriptId, []);
      }
    }, POLL_INTERVAL);

    return () => {
      socket.off("script-job-update", handleScriptUpdate);
      leaveTeam(teamId);
      clearPolling();
    };
  }, [teamId, state.pendingScriptId, onScriptGenerated, onError, pollScriptStatus, clearPolling]);

  const reset = useCallback(() => {
    isCompletedRef.current = false;
    clearPolling();
    setState({
      isGenerating: false,
      generationProgress: 0,
      progressMessage: "",
      pendingScriptId: null,
      error: null,
    });
  }, [clearPolling]);

  return {
    ...state,
    generate,
    reset,
  };
}
