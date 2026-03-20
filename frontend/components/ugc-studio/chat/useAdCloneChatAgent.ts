"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSetAtom } from "jotai";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "@/lib/socket";
import {
  isSilentAtom,
  productImageKeysAtom,
  videoTypeAtom,
  hasCharacterAtom,
  customPatternAtom,
} from "@/store/ugc";
import { adCloneAPI } from "@/api/adClone";
import { ugcScriptAPI } from "@/api/ugc";
import { videoAPI } from "@/api/video";
import type {
  ChatMessage,
  ChatAttachment,
  InitAgentResult,
  ArtifactType,
  ScriptAgentResult,
} from "./types";

let messageIdCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: "initial",
  role: "assistant",
  content:
    "Drop in a link or upload the ad you want to clone, along with your product images. Tell me what product this is for and any direction you have for the new ad.",
  timestamp: new Date(),
};

function buildConversationHistory(
  messages: ChatMessage[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.id !== "initial")
    .map((m) => ({ role: m.role, content: m.content }));
}

export interface AdCloneVideoAttachment {
  file?: File;
  url?: string;
  name: string;
  size?: number;
  preview?: string;
  s3Key?: string;
}

interface AnalysisSocketUpdate {
  projectId: string;
  status: string;
  progress: number;
  progressMessage: string;
  analysis?: any;
  scripts?: any[];
  error?: string;
}

interface AgentScriptResult {
  responseType: "conversation" | "script";
  message: string;
  videoType: string;
  isSilent: boolean;
  character: boolean;
  targetAudience: string;
  title: string;
  totalDuration: number;
  scenes: any[];
}

function deriveStructureFromScript(result: AgentScriptResult): InitAgentResult {
  return {
    videoType: result.videoType,
    isSilent: result.isSilent,
    character: result.character,
    targetAudience: result.targetAudience,
    structure: result.scenes.map((s: any) => ({
      sceneType: s.sceneType,
      slug: s.slug,
      description: s.storyBeat,
      shots: s.shots?.map((sh: any) => ({ label: sh.label, shotType: sh.shotType })) || [],
    })),
  };
}

function toScriptAgentResult(result: AgentScriptResult): ScriptAgentResult {
  return {
    title: result.title,
    targetAudience: result.targetAudience,
    totalDuration: result.totalDuration,
    scenes: result.scenes,
  };
}

export function useAdCloneChatAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);
  const [acceptedResult, setAcceptedResult] = useState<InitAgentResult | null>(null);
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactType | null>(null);
  const [generatedScript, setGeneratedScript] = useState<ScriptAgentResult | null>(null);
  const [isGeneratingScript] = useState(false);
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [videoAttachment, setVideoAttachment] = useState<AdCloneVideoAttachment | null>(null);
  const [latestAgentResult, setLatestAgentResult] = useState<AgentScriptResult | null>(null);

  const threadIdRef = useRef(`thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const socketRef = useRef<Socket | null>(null);
  const pendingAnalysisRef = useRef<{ text: string; imageKeys: string[] } | null>(null);
  const selectedCharacterRef = useRef<any>(null);
  const teamIdRef = useRef<number | null>(null);

  const setIsSilent = useSetAtom(isSilentAtom);
  const setProductImageKeys = useSetAtom(productImageKeysAtom);
  const setVideoType = useSetAtom(videoTypeAtom);
  const setHasCharacter = useSetAtom(hasCharacterAtom);
  const setCustomPattern = useSetAtom(customPatternAtom);

  const processAgentResult = useCallback((result: AgentScriptResult) => {
    if (result.responseType !== "script" || !result.scenes?.length) return null;

    setLatestAgentResult(result);
    setGeneratedScript(toScriptAgentResult(result));

    const structureResult = deriveStructureFromScript(result);
    return structureResult;
  }, []);

  const handleAnalysisComplete = useCallback(
    async (pid: string) => {
      const pending = pendingAnalysisRef.current;
      if (!pending) return;

      try {
        const conversationHistory = buildConversationHistory(messages);
        const result = await adCloneAPI.initStructure({
          projectId: pid,
          message: pending.text,
          productImageKeys: pending.imageKeys,
          threadId: threadIdRef.current,
          conversationHistory,
        });

        const structureResult = processAgentResult(result);

        const assistantMessage: ChatMessage = {
          id: nextId(),
          role: "assistant",
          content: result.message,
          structureResult: structureResult || undefined,
          timestamp: new Date(),
        };

        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== "analyzing-placeholder");
          return [...filtered, assistantMessage];
        });
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: nextId(),
          role: "assistant",
          content: error instanceof Error
            ? `Something went wrong: ${error.message}. Try again?`
            : "Something went wrong. Try again?",
          timestamp: new Date(),
        };
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== "analyzing-placeholder");
          return [...filtered, errorMessage];
        });
      } finally {
        setIsThinking(false);
        setIsAnalyzing(false);
        setAnalysisComplete(true);
        pendingAnalysisRef.current = null;
      }
    },
    [messages, processAgentResult],
  );

  useEffect(() => {
    const teamId = teamIdRef.current;
    if (!teamId || !projectId || !isAnalyzing) return;

    const socketUrl = getSocketUrl();
    socketRef.current = io(socketUrl, { transports: ["websocket", "polling"] });

    socketRef.current.on("connect", () => {
      socketRef.current?.emit("join-team", teamId);
    });

    socketRef.current.on("ad-clone-job-update", (update: AnalysisSocketUpdate) => {
      if (update.projectId !== projectId) return;

      if (update.status === "analysis_complete" || update.status === "script_generated") {
        handleAnalysisComplete(projectId);
      } else if (update.status === "failed") {
        const errorMessage: ChatMessage = {
          id: nextId(),
          role: "assistant",
          content: `Analysis failed: ${update.error || "Unknown error"}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== "analyzing-placeholder");
          return [...filtered, errorMessage];
        });
        setIsThinking(false);
        setIsAnalyzing(false);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "analyzing-placeholder"
              ? { ...m, content: update.progressMessage || "Analyzing your ad..." }
              : m,
          ),
        );
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-team", teamId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [projectId, isAnalyzing, handleAnalysisComplete]);

  const sendMessage = useCallback(
    async (text: string, attachments: ChatAttachment[] = []) => {
      const teamId = teamIdRef.current;

      const userMessage: ChatMessage = {
        id: nextId(),
        role: "user",
        content: text,
        attachments: attachments.length > 0 ? attachments : undefined,
        timestamp: new Date(),
      };

      const currentMessages = [...messages, userMessage];
      setMessages(currentMessages);
      setIsThinking(true);

      if (videoAttachment && !projectId && teamId) {
        try {
          const imageKeys = attachments.map((a) => a.key).filter(Boolean);

          const createResult = await adCloneAPI.createProject({
            teamId,
            productName: undefined,
            productDescription: undefined,
            adDirection: text,
          });

          const pid = createResult.projectId;
          setProjectId(pid);

          let referenceVideoKey: string;

          if (videoAttachment.url && !videoAttachment.file) {
            setMessages((prev) => [
              ...prev,
              { id: "downloading-placeholder", role: "assistant", content: "Downloading video from link...", timestamp: new Date() },
            ]);

            const downloadResult = await videoAPI.downloadFromUrl(
              videoAttachment.url,
              teamId,
              (progress) => {
                if (progress.type === "progress") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === "downloading-placeholder"
                        ? { ...m, content: `Downloading video... ${progress.percent ?? 0}%` }
                        : m,
                    ),
                  );
                }
              },
            );

            referenceVideoKey = downloadResult.s3Key;
            setMessages((prev) => prev.filter((m) => m.id !== "downloading-placeholder"));
          } else if (videoAttachment.file) {
            await adCloneAPI.uploadFile(createResult.uploadUrls.video.uploadUrl, videoAttachment.file);
            referenceVideoKey = createResult.uploadUrls.video.s3Key;
          } else {
            throw new Error("No video file or URL provided");
          }

          if (imageKeys.length > 0 && attachments.length > 0) {
            const uploadUrls = await adCloneAPI.getUploadUrls({
              teamId,
              projectId: pid,
              videoFileName: videoAttachment.name,
              productImageFileNames: attachments.filter((a) => a.file).map((a) => a.file!.name),
            });

            await Promise.all(
              uploadUrls.uploadUrls.productImages.map((url, i) =>
                adCloneAPI.uploadFile(url.uploadUrl, attachments[i].file!),
              ),
            );

            await adCloneAPI.confirmUpload(pid, {
              referenceVideoKey,
              productImageKeys: uploadUrls.uploadUrls.productImages.map((u) => u.s3Key),
            });
          } else {
            await adCloneAPI.confirmUpload(pid, { referenceVideoKey, productImageKeys: [] });
          }

          await adCloneAPI.startAnalysis(pid, teamId);
          pendingAnalysisRef.current = { text, imageKeys };
          setIsAnalyzing(true);

          setMessages((prev) => [
            ...prev,
            { id: "analyzing-placeholder", role: "assistant", content: "Analyzing your ad... This usually takes 30-60 seconds.", timestamp: new Date() },
          ]);
        } catch (error) {
          setMessages((prev) =>
            prev.filter((m) => m.id !== "downloading-placeholder" && m.id !== "analyzing-placeholder"),
          );
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: error instanceof Error ? `Something went wrong: ${error.message}. Try again?` : "Something went wrong. Try again?",
              timestamp: new Date(),
            },
          ]);
          setIsThinking(false);
        }
        return;
      }

      if (projectId && analysisComplete) {
        try {
          const conversationHistory = buildConversationHistory(currentMessages);
          const imageKeys = attachments.map((a) => a.key).filter(Boolean);

          const result = await adCloneAPI.initStructure({
            projectId,
            message: text,
            productImageKeys: imageKeys,
            threadId: threadIdRef.current,
            conversationHistory,
          });

          const structureResult = processAgentResult(result);

          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: result.message,
              structureResult: structureResult || undefined,
              timestamp: new Date(),
            },
          ]);
        } catch (error) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: error instanceof Error ? `Something went wrong: ${error.message}. Try again?` : "Something went wrong. Try again?",
              timestamp: new Date(),
            },
          ]);
        } finally {
          setIsThinking(false);
        }
        return;
      }

      if (!videoAttachment && !projectId) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: "To get started, please upload or paste a link to the ad you want to clone. You can also drop in product images for the new version.",
            timestamp: new Date(),
          },
        ]);
        setIsThinking(false);
        return;
      }

      setIsThinking(false);
    },
    [messages, videoAttachment, projectId, analysisComplete, processAgentResult],
  );

  const acceptStructure = useCallback(
    (result: InitAgentResult, imageKeys: string[]) => {
      const customPattern = result.structure.map((scene) => ({
        type: scene.description,
        shot: scene.sceneType,
      }));

      setIsSilent(result.isSilent);
      setProductImageKeys(imageKeys);
      setVideoType(result.videoType);
      setHasCharacter(result.character);
      setCustomPattern(customPattern);
      setAcceptedResult(result);

      if (!result.character && result.isSilent) {
        setCurrentArtifact("script");
      } else if (!result.character) {
        setCurrentArtifact("voice");
      } else {
        setCurrentArtifact("character");
      }
    },
    [setIsSilent, setProductImageKeys, setVideoType, setHasCharacter, setCustomPattern],
  );

  const advanceArtifact = useCallback(() => {
    setCurrentArtifact((prev) => {
      if (prev === "character") {
        const silent = acceptedResult?.isSilent ?? false;
        return silent ? "script" : "voice";
      }
      if (prev === "voice") return "script";
      return prev;
    });
  }, [acceptedResult]);

  const retryStructure = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content, lastUserMsg.attachments);
    }
  }, [messages, sendMessage]);

  const generateScript = useCallback(async () => {
    if (!generatedScript || !teamIdRef.current) return;

    try {
      const character = selectedCharacterRef.current;
      const allImageKeys = messages
        .filter((m) => m.role === "user" && m.attachments)
        .flatMap((m) => m.attachments!.map((a) => a.key));

      const result = await ugcScriptAPI.saveScript({
        teamId: teamIdRef.current,
        script: generatedScript,
        characterId: character?.id,
        productImageKeys: allImageKeys,
        isSilent: acceptedResult?.isSilent,
        videoType: acceptedResult?.videoType,
      });

      setScriptId(result.scriptId);
    } catch (error) {
      console.error("Failed to save script:", error);
    }
  }, [generatedScript, acceptedResult, messages]);

  return {
    messages,
    isThinking,
    isAnalyzing,
    acceptedResult,
    currentArtifact,
    generatedScript,
    isGeneratingScript,
    scriptId,
    projectId,
    videoAttachment,
    setVideoAttachment,
    sendMessage,
    acceptStructure,
    advanceArtifact,
    retryStructure,
    generateScript,
    selectedCharacterRef,
    teamIdRef,
  };
}
