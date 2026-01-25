"use client";

import { useCallback, useRef, useEffect } from "react";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { io, Socket } from "socket.io-client";
import { adCloneAPI } from "@/api/adClone";
import {
  adCloneVideoAtom,
  adCloneProductImageAtom,
  adCloneProductNameAtom,
  adCloneProductDescriptionAtom,
  adCloneAdDirectionAtom,
  adCloneProjectIdAtom,
  adCloneStatusAtom,
  adCloneAnalysisAtom,
  adCloneScriptsAtom,
  adCloneSelectedVariantAtom,
  adCloneCharacterIdAtom,
  adCloneVoiceIdAtom,
  adCloneStepAtom,
  adCloneProgressAtom,
  adCloneProgressMessageAtom,
  adCloneErrorAtom,
  adCloneVideoJobIdAtom,
  adCloneFinalVideoUrlAtom,
  resetAdCloneAtom,
  AdCloneStep,
  AdCloneProjectStatus,
  VideoAnalysis,
} from "@/store/adClone";

const getSocketUrl = (): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return "http://localhost:3001";
  try {
    const url = new URL(apiUrl);
    return url.origin;
  } catch {
    return apiUrl.replace(/\/api\/?$/, "");
  }
};

interface AdCloneSocketUpdate {
  projectId: string;
  status: AdCloneProjectStatus;
  progress: number;
  progressMessage: string;
  analysis?: VideoAnalysis;
  scripts?: any[];
  error?: string;
}

export function useAdClone(teamId: number | undefined) {
  const video = useAtomValue(adCloneVideoAtom);
  const productImage = useAtomValue(adCloneProductImageAtom);
  const [productName, setProductName] = useAtom(adCloneProductNameAtom);
  const [productDescription, setProductDescription] = useAtom(adCloneProductDescriptionAtom);
  const [adDirection, setAdDirection] = useAtom(adCloneAdDirectionAtom);

  const [projectId, setProjectId] = useAtom(adCloneProjectIdAtom);
  const [status, setStatus] = useAtom(adCloneStatusAtom);
  const [analysis, setAnalysis] = useAtom(adCloneAnalysisAtom);
  const [scripts, setScripts] = useAtom(adCloneScriptsAtom);
  const [selectedVariant, setSelectedVariant] = useAtom(adCloneSelectedVariantAtom);
  const [characterId, setCharacterId] = useAtom(adCloneCharacterIdAtom);
  const [voiceId, setVoiceId] = useAtom(adCloneVoiceIdAtom);
  const [step, setStep] = useAtom(adCloneStepAtom);
  const setProgress = useSetAtom(adCloneProgressAtom);
  const setProgressMessage = useSetAtom(adCloneProgressMessageAtom);
  const [error, setError] = useAtom(adCloneErrorAtom);
  const [videoJobId, setVideoJobId] = useAtom(adCloneVideoJobIdAtom);
  const [finalVideoUrl, setFinalVideoUrl] = useAtom(adCloneFinalVideoUrlAtom);
  const reset = useSetAtom(resetAdCloneAtom);

  const socketRef = useRef<Socket | null>(null);

  const handleSocketUpdate = useCallback(
    (update: AdCloneSocketUpdate) => {
      if (update.projectId !== projectId) return;

      setStatus(update.status);
      setProgress(update.progress);
      setProgressMessage(update.progressMessage);

      if (update.analysis) {
        setAnalysis(update.analysis);
      }

      if (update.scripts) {
        setScripts(update.scripts);
      }

      if (update.error) {
        setError(update.error);
      }

      // Auto-advance step based on status
      switch (update.status) {
        case "script_generated":
          // Combined analyze+script is done, stay on script step to review
          setStep("script");
          break;
        case "completed":
          // Video generation complete, stay on generate step (which shows preview)
          setStep("generate");
          break;
        case "failed":
          setError(update.error || "An error occurred");
          break;
      }
    },
    [projectId, setStatus, setProgress, setProgressMessage, setAnalysis, setScripts, setError, setStep]
  );

  // Socket connection for real-time updates
  useEffect(() => {
    if (!teamId || !projectId) return;

    const socketUrl = getSocketUrl();
    socketRef.current = io(socketUrl, {
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      socketRef.current?.emit("join-team", teamId);
    });

    socketRef.current.on("ad-clone-job-update", handleSocketUpdate);

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-team", teamId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [teamId, projectId, handleSocketUpdate]);

  const createProject = useCallback(async () => {
    if (!teamId || !video || !productImage) {
      throw new Error("Missing required data");
    }

    setError(null);
    setProgress(0);
    setProgressMessage("Creating project...");

    try {
      const result = await adCloneAPI.createProject({
        teamId,
        productName: productName || undefined,
        productDescription: productDescription || undefined,
        adDirection: adDirection || undefined,
      });

      setProjectId(result.projectId);
      setProgress(5);
      setProgressMessage("Uploading video...");

      // Upload video
      await adCloneAPI.uploadFile(
        result.uploadUrls.video.uploadUrl,
        video.file,
        (progress) => {
          setProgress(5 + Math.round(progress * 0.4));
          setProgressMessage(`Uploading video... ${progress}%`);
        }
      );

      setProgress(50);
      setProgressMessage("Uploading product image...");

      // Get upload URL for product image
      const uploadUrls = await adCloneAPI.getUploadUrls({
        teamId,
        projectId: result.projectId,
        videoFileName: video.file.name,
        productImageFileNames: [productImage.file.name],
      });

      // Upload product image
      await adCloneAPI.uploadFile(
        uploadUrls.uploadUrls.productImages[0].uploadUrl,
        productImage.file,
        (progress) => {
          setProgress(50 + Math.round(progress * 0.3));
          setProgressMessage(`Uploading product image... ${progress}%`);
        }
      );

      setProgress(85);
      setProgressMessage("Confirming uploads...");

      // Confirm upload
      await adCloneAPI.confirmUpload(result.projectId, {
        referenceVideoKey: result.uploadUrls.video.s3Key,
        productImageKeys: [uploadUrls.uploadUrls.productImages[0].s3Key],
      });

      setProgress(100);
      setProgressMessage("Uploads complete");
      setStatus("uploading");

      return result.projectId;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create project";
      setError(errorMsg);
      throw err;
    }
  }, [
    teamId,
    video,
    productImage,
    productName,
    productDescription,
    adDirection,
    setProjectId,
    setProgress,
    setProgressMessage,
    setError,
    setStatus,
  ]);

  const startAnalysis = useCallback(async (overrideProjectId?: string) => {
    const pid = overrideProjectId || projectId;
    if (!teamId || !pid) {
      throw new Error("Missing required data");
    }

    setError(null);
    setProgress(0);
    setProgressMessage("Starting analysis...");
    setStep("script");
    setStatus("analyzing");

    try {
      await adCloneAPI.startAnalysis(pid, teamId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to start analysis";
      setError(errorMsg);
      setStatus("failed");
      throw err;
    }
  }, [teamId, projectId, setError, setProgress, setProgressMessage, setStep, setStatus]);

  const startAnalyzeAndScript = useCallback(async (overrideProjectId?: string) => {
    const pid = overrideProjectId || projectId;
    if (!teamId || !pid) {
      throw new Error("Missing required data");
    }

    setError(null);
    setProgress(0);
    setProgressMessage("Starting analysis...");
    setStep("script");
    setStatus("analyzing");

    try {
      await adCloneAPI.startAnalyzeAndScript(pid, teamId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to start processing";
      setError(errorMsg);
      setStatus("failed");
      throw err;
    }
  }, [teamId, projectId, setError, setProgress, setProgressMessage, setStep, setStatus]);

  const generateScript = useCallback(async () => {
    if (!teamId || !projectId) {
      throw new Error("Missing required data");
    }

    setError(null);
    setProgress(0);
    setProgressMessage("Generating script...");
    setStep("script");
    setStatus("generating_script");

    try {
      await adCloneAPI.generateScript(projectId, { teamId, characterId: characterId || undefined });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to generate script";
      setError(errorMsg);
      setStatus("failed");
      throw err;
    }
  }, [teamId, projectId, characterId, setError, setProgress, setProgressMessage, setStep, setStatus]);

  const updateScript = useCallback(
    async (script: any) => {
      if (!projectId) {
        throw new Error("No project ID");
      }

      try {
        await adCloneAPI.updateScript(projectId, {
          script,
          selectedVariantIndex: selectedVariant,
        });

        const updatedScripts = [...(scripts || [])];
        updatedScripts[selectedVariant] = script;
        setScripts(updatedScripts);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to update script";
        setError(errorMsg);
        throw err;
      }
    },
    [projectId, selectedVariant, scripts, setScripts, setError]
  );

  const generateVideo = useCallback(async () => {
    if (!teamId || !projectId || !voiceId || !characterId) {
      throw new Error("Missing required data");
    }

    setError(null);
    setProgress(0);
    setProgressMessage("Starting video generation...");
    setStep("generate");
    setStatus("generating_video");

    try {
      const result = await adCloneAPI.generateVideo(projectId, { teamId, voiceId, characterId });
      setVideoJobId(result.videoJobId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to generate video";
      setError(errorMsg);
      setStatus("failed");
      throw err;
    }
  }, [teamId, projectId, voiceId, characterId, setError, setProgress, setProgressMessage, setStep, setStatus, setVideoJobId]);

  const pollStatus = useCallback(async () => {
    if (!projectId) return null;

    try {
      const result = await adCloneAPI.getStatus(projectId);
      setStatus(result.status);
      setProgress(result.progress);
      setProgressMessage(result.progressMessage || "");

      if (result.hasScript && result.script && !scripts) {
        setScripts([result.script]);
      }

      if (result.finalVideoUrl) {
        setFinalVideoUrl(result.finalVideoUrl);
      }

      if (result.error) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      console.error("Failed to poll status:", err);
      return null;
    }
  }, [projectId, scripts, setStatus, setProgress, setProgressMessage, setScripts, setFinalVideoUrl, setError]);

  const loadProject = useCallback(
    async (loadProjectId: string) => {
      try {
        const result = await adCloneAPI.getProject(loadProjectId);

        setProjectId(loadProjectId);
        setStatus(result.project.status);
        setProgress(result.project.progress);
        setProgressMessage(result.project.progressMessage || "");

        if (result.project.productName) {
          setProductName(result.project.productName);
        }
        if (result.project.productDescription) {
          setProductDescription(result.project.productDescription);
        }
        if (result.project.adDirection) {
          setAdDirection(result.project.adDirection);
        }

        if (result.analysis) {
          setAnalysis(result.analysis);
        }

        if (result.scripts) {
          setScripts(result.scripts);
          setSelectedVariant(result.project.selectedVariantIndex);
        }

        if (result.project.characterId) {
          setCharacterId(result.project.characterId);
        }

        if (result.project.finalVideoUrl) {
          setFinalVideoUrl(result.project.finalVideoUrl);
        }

        switch (result.project.status) {
          case "uploading":
            setStep("upload");
            break;
          case "analyzing":
          case "analysis_complete":
          case "generating_script":
            setStep("script");
            break;
          case "script_generated":
            if (!result.project.characterId) {
              setStep("script");
            } else {
              setStep("generate");
            }
            break;
          case "generating_video":
          case "completed":
            setStep("generate");
            break;
          case "failed":
            setStep("storyboard");
            setError("Project failed");
            break;
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load project";
        setError(errorMsg);
        throw err;
      }
    },
    [
      setProjectId,
      setStatus,
      setProgress,
      setProgressMessage,
      setProductName,
      setProductDescription,
      setAdDirection,
      setAnalysis,
      setScripts,
      setSelectedVariant,
      setCharacterId,
      setFinalVideoUrl,
      setStep,
      setError,
    ]
  );

  return {
    // State
    video,
    productImage,
    productName,
    productDescription,
    adDirection,
    projectId,
    status,
    analysis,
    scripts,
    selectedVariant,
    characterId,
    voiceId,
    step,
    error,
    videoJobId,
    finalVideoUrl,

    // Setters
    setCharacterId,
    setVoiceId,
    setStep,
    setSelectedVariant,

    // Actions
    createProject,
    startAnalysis,
    startAnalyzeAndScript,
    generateScript,
    updateScript,
    generateVideo,
    pollStatus,
    loadProject,
    reset,
  };
}

export function useAdCloneSocket(
  teamId: number | undefined,
  projectId: string | null,
  onUpdate: (update: AdCloneSocketUpdate) => void
) {
  const socketRef = useRef<Socket | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!teamId || !projectId) return;

    const socketUrl = getSocketUrl();
    socketRef.current = io(socketUrl, {
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      socketRef.current?.emit("join-team", teamId);
    });

    socketRef.current.on("ad-clone-job-update", (update: AdCloneSocketUpdate) => {
      if (update.projectId === projectId) {
        onUpdateRef.current(update);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-team", teamId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [teamId, projectId]);

  return {
    isConnected: socketRef.current?.connected ?? false,
  };
}
