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

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pollScriptStatus = useCallback(async (scriptIdToPoll: string, productImages: ProductImage[]) => {
    try {
      const response = await ugcScriptAPI.getFullScript(scriptIdToPoll);
      if (response.success && response.scripts && response.scripts.length > 0) {
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
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        return true;
      }
    } catch (err) {
      console.log("[useScriptGeneration] Polling: script not ready yet");
    }
    return false;
  }, [onScriptGenerated]);

  const generate = useCallback(async (params: GenerateScriptParams) => {
    const { productImages, productName, scriptDirection, selectedStructureId, customPattern } = params;

    if (!scriptDirection.trim()) {
      onError("Please provide a script direction");
      return false;
    }

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
  }, [teamId, characterId, onError]);

  // WebSocket effect for real-time updates
  useEffect(() => {
    if (!state.pendingScriptId) return;

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
      if (update.scriptId !== state.pendingScriptId) return;

      setState((prev) => ({
        ...prev,
        generationProgress: update.progress,
        progressMessage: update.progressMessage,
      }));

      if (update.status === "completed" && update.scripts) {
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        onScriptGenerated(update.scripts, update.scriptId, []);
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          pendingScriptId: null,
        }));
      } else if (update.status === "failed") {
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        onError(update.error || "Script generation failed");
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          pendingScriptId: null,
        }));
      } else if (update.progress >= 90 && !pollTimeoutRef.current) {
        // Start polling as backup when nearing completion
        pollTimeoutRef.current = setTimeout(async () => {
          const scriptId = state.pendingScriptId;
          if (scriptId) {
            const success = await pollScriptStatus(scriptId, []);
            if (!success) {
              pollTimeoutRef.current = setTimeout(() => {
                if (state.pendingScriptId) {
                  pollScriptStatus(state.pendingScriptId, []);
                }
              }, 2000);
            }
          }
        }, 3000);
      }
    };

    socket.on("script-job-update", handleScriptUpdate);

    return () => {
      socket.off("script-job-update", handleScriptUpdate);
      leaveTeam(teamId);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [teamId, state.pendingScriptId, onScriptGenerated, onError, pollScriptStatus]);

  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      generationProgress: 0,
      progressMessage: "",
      pendingScriptId: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    generate,
    reset,
  };
}
