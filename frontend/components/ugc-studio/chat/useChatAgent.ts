"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  isSilentAtom,
  productImageKeysAtom,
  videoTypeAtom,
  hasCharacterAtom,
  customPatternAtom,
  freshStartAtom,
} from "@/store/ugc";
import { selectedVoiceAtom } from "@/store/ugc";
import { ugcScriptAPI } from "@/api/ugc";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import type { UGCScript, UGCScene } from "@/components/ugc-studio/script/types";
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
  content: "Hey! Describe the video you'd like to create and drop in any product images. I'll design the perfect structure for it.",
  timestamp: new Date(),
};

function buildConversationHistory(
  messages: ChatMessage[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.id !== "initial")
    .map((m) => {
      if (m.role === "assistant" && m.structureResult) {
        const structureSummary = m.structureResult.structure
          .map((s, i) => `  ${i + 1}. ${s.slug} (${s.sceneType}) — ${s.description}`)
          .join("\n");
        return {
          role: "assistant" as const,
          content: `I suggested the following structure (videoType: ${m.structureResult.videoType}, isSilent: ${m.structureResult.isSilent}, character: ${m.structureResult.character}):\n${structureSummary}`,
        };
      }
      return { role: m.role, content: m.content };
    });
}

export interface ExistingScriptMeta {
  isSilent: boolean;
  hasCharacter: boolean;
  videoType: string;
}

export function useChatAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);
  const [acceptedResult, setAcceptedResult] = useState<InitAgentResult | null>(null);
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactType | null>(null);
  const [generatedScript, setGeneratedScript] = useState<UGCScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isExistingScript, setIsExistingScript] = useState(false);
  const [existingScriptSilent, setExistingScriptSilent] = useState(false);
  const [scriptId, setScriptId] = useState<string | null>(null);
  const threadIdRef = useRef(`thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const setIsSilent = useSetAtom(isSilentAtom);
  const setProductImageKeys = useSetAtom(productImageKeysAtom);
  const setVideoType = useSetAtom(videoTypeAtom);
  const setHasCharacter = useSetAtom(hasCharacterAtom);
  const setCustomPattern = useSetAtom(customPatternAtom);
  const setFreshStart = useSetAtom(freshStartAtom);
  const selectedVoice = useAtomValue(selectedVoiceAtom);

  const selectedCharacterRef = useRef<any>(null);
  const teamIdRef = useRef<number | null>(null);

  // Track active polling intervals for cleanup
  const pollingIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingIntervalsRef.current.forEach(clearInterval);
    };
  }, []);

  /**
   * Trigger image generation for all scenes and poll for completion.
   */
  const triggerImageGeneration = useCallback(
    async (script: UGCScript, generatedScriptId: string) => {
      const teamId = teamIdRef.current;
      const characterId = selectedCharacterRef.current?.id;
      if (!teamId || !characterId) return;

      // Build scenes payload
      const scenesPayload = script.scenes.map((scene) => ({
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        sceneType: scene.sceneType,
        dialogue: scene.dialogue,
        action: scene.action,
        emotion: scene.emotion,
        shotType: scene.shotType,
        cameraAngle: scene.cameraAngle,
        bRollShots: scene.bRollShots,
      }));

      // Set all scenes to "generating" state
      const initialImageState: Record<string, SceneImageState> = {};
      for (const scene of script.scenes) {
        initialImageState[scene.id] = { status: "generating" };
      }
      setSceneImages(initialImageState);

      try {
        const result = await sceneBuilderAPI.generateAllSceneImages({
          teamId,
          scriptId: generatedScriptId,
          characterId,
          scenes: scenesPayload,
        });

        if (!result.success || !result.jobIds?.length) return;

        // Map jobIds to scene IDs (they come back in the same order as scenes)
        const jobScenePairs: Array<{ jobId: string; sceneId: string }> = [];
        result.jobIds.forEach((jobId, idx) => {
          if (scenesPayload[idx]) {
            jobScenePairs.push({ jobId, sceneId: scenesPayload[idx].sceneId });
          }
        });

        // Update state with job IDs
        setSceneImages((prev) => {
          const next = { ...prev };
          for (const { jobId, sceneId } of jobScenePairs) {
            next[sceneId] = { ...next[sceneId], status: "generating", jobId };
          }
          return next;
        });

        // Poll each job
        const completedJobs = new Set<string>();
        const interval = setInterval(async () => {
          for (const { jobId, sceneId } of jobScenePairs) {
            if (completedJobs.has(jobId)) continue;

            try {
              const status = await sceneBuilderAPI.getGenerationStatus(jobId);

              if (status.status === "completed" && status.images?.length) {
                completedJobs.add(jobId);
                const firstImage = status.images[0];
                setSceneImages((prev) => ({
                  ...prev,
                  [sceneId]: {
                    ...prev[sceneId],
                    status: "completed",
                    jobId,
                    generatedImages: status.images,
                    imageKey: firstImage.key,
                    imageUrl: firstImage.url,
                  },
                }));

                // Auto-select the first image
                sceneBuilderAPI.selectSceneImage({
                  scriptId: generatedScriptId,
                  sceneId,
                  sceneNumber: status.sceneNumber,
                  imageKey: firstImage.key,
                  generationJobId: jobId,
                }).catch(() => {});
              } else if (status.status === "failed") {
                completedJobs.add(jobId);
                setSceneImages((prev) => ({
                  ...prev,
                  [sceneId]: {
                    ...prev[sceneId],
                    status: "failed",
                    jobId,
                  },
                }));
              }
            } catch {
              // Ignore individual poll errors
            }
          }

          if (completedJobs.size >= jobScenePairs.length) {
            clearInterval(interval);
          }
        }, 2000);

        pollingIntervalsRef.current.push(interval);
      } catch (error) {
        console.error("[useChatAgent] Image generation failed:", error);
      }
    },
    [setSceneImages],
  );

  const sendMessage = useCallback(
    async (text: string, attachments: ChatAttachment[] = []) => {
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

      try {
        const conversationHistory = buildConversationHistory(currentMessages);

          const result = await ugcScriptAPI.initStructure({
            message: text,
            productImageKeys: attachments.map((a) => a.key).filter(Boolean),
            threadId: threadIdRef.current,
            conversationHistory,
          });

        const assistantMessage: ChatMessage = {
          id: nextId(),
          role: "assistant",
          content: result.message,
          structureResult:
            result.responseType === "structure" && result.structure?.length
              ? {
                  videoType: result.videoType!,
                  isSilent: result.isSilent!,
                  character: result.character!,
                  targetAudience: (result as any).targetAudience || "",
                  structure: result.structure,
                }
              : undefined,
          timestamp: new Date(),
        };

          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: nextId(),
          role: "assistant",
          content:
            error instanceof Error
              ? `Something went wrong: ${error.message}. Try again?`
              : "Something went wrong. Try again?",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsThinking(false);
      }
    },
    [messages, scriptId, generatedScript],
  );

  const generateScript = useCallback(async () => {
    if (!acceptedResult || !teamIdRef.current) return;

    setIsGeneratingScript(true);
    try {
      const character = selectedCharacterRef.current;
      const allImageKeys = messages
        .filter((m) => m.role === "user" && m.attachments)
        .flatMap((m) => m.attachments!.map((a) => a.key));

      const userDirection = messages.find((m) => m.role === "user")?.content || "";

      const result = await ugcScriptAPI.generateScriptAgent({
        teamId: teamIdRef.current,
        structure: acceptedResult.structure,
        characterId: character?.id,
        character: character
          ? {
              name: character.name,
              gender: character.gender,
              age_range: character.age_range,
              appearance_config: character.appearance_config,
            }
          : null,
        voice: selectedVoice
          ? { name: selectedVoice.name }
          : null,
        targetAudience: acceptedResult.targetAudience || "",
        productImageKeys: allImageKeys,
        userDirection,
        isSilent: acceptedResult.isSilent,
        videoType: acceptedResult.videoType,
      });

      // Normalize to UGCScript format
      const ugcScript = mapScriptAgentResultToUGCScript(result.script);
      setGeneratedScript(ugcScript);
      setScriptId(result.scriptId);

      // Auto-trigger image generation in background
      triggerImageGeneration(ugcScript, result.scriptId);
    } catch (error) {
      console.error("[useChatAgent] Script generation failed:", error);
      setGeneratedScript(null);
    } finally {
      setIsGeneratingScript(false);
    }
  }, [acceptedResult, messages, selectedVoice]);

  const loadExistingScript = useCallback(
    (meta: ExistingScriptMeta) => {
      setIsExistingScript(true);
      setFreshStart(true);
      setExistingScriptSilent(meta.isSilent);

      setIsSilent(meta.isSilent);
      setVideoType(meta.videoType);
      setHasCharacter(meta.hasCharacter);
      setProductImageKeys([]);

      if (meta.hasCharacter) {
        setCurrentArtifact("character");
      } else if (!meta.isSilent) {
        setCurrentArtifact("voice");
      } else {
        setCurrentArtifact("script");
      }
    },
    [setIsSilent, setVideoType, setHasCharacter, setProductImageKeys, setFreshStart],
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
        const silent = acceptedResult?.isSilent ?? existingScriptSilent;
        return silent ? "script" : "voice";
      }
      if (prev === "voice") return "script";
      return prev;
    });
  }, [acceptedResult, existingScriptSilent]);

  const retryStructure = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content, lastUserMsg.attachments);
    }
  }, [messages, sendMessage]);

  // Debounce ref for backend save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateScene = useCallback(
    (sceneId: string, patch: Partial<UGCScene>) => {
      setGeneratedScript((prev) => {
        if (!prev) return prev;
        const updatedScenes = prev.scenes.map((s) =>
          s.id === sceneId ? { ...s, ...patch } : s,
        );
        const next = { ...prev, scenes: updatedScenes };

        // Debounce backend save (500ms)
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (scriptId) {
          saveTimerRef.current = setTimeout(() => {
            ugcScriptAPI.updateScript(scriptId, { scenes: updatedScenes }).catch((err) => {
              console.error("[useChatAgent] Failed to save scene edit:", err);
            });
          }, 500);
        }

        return next;
      });
    },
    [scriptId],
  );

  return {
    messages,
    isThinking,
    acceptedResult,
    currentArtifact,
    generatedScript,
    isGeneratingScript,
    isExistingScript,
    scriptId,
    sendMessage,
    acceptStructure,
    advanceArtifact,
    retryStructure,
    generateScript,
    loadExistingScript,
    selectedCharacterRef,
    teamIdRef,
  };
}
