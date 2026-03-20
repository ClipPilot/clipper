"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  videoStateAtom,
  resolveAgent,
  type VideoState,
} from "@/store/videoState";
import { sceneImagesAtom, type SceneImageState } from "@/store/ugc";
import { ugcScriptAPI } from "@/api/ugc";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import type { UGCScript, UGCScene } from "@/components/ugc-studio/script/types";
import type {
  ChatMessage,
  ChatAttachment,
  InitAgentResult,
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
    "Hey! Describe the video you'd like to create and drop in any product images. I'll design the perfect structure for it.",
  timestamp: new Date(),
};

/**
 * Convert ScriptAgentResult (from script-agent) to UGCScript (DB/storyboard shape).
 */
function mapScriptAgentResultToUGCScript(raw: ScriptAgentResult): UGCScript {
  const scenes: UGCScene[] = raw.scenes.map((s) => ({
    id: s.slug,
    sceneNumber: s.sceneNumber,
    sceneType: s.storyBeat as UGCScene["sceneType"],
    action: s.action,
    dialogue: s.dialogue || "",
    emotion: (extractEmotion(s.dialogue) || "confident") as UGCScene["emotion"],
    estimatedDurationSeconds: s.duration,
    shotType: s.sceneType as UGCScene["shotType"],
    cameraAngle: "medium-shot" as UGCScene["cameraAngle"],
    ambientSound: s.ambientSound || undefined,
    bRollShots:
      s.shots && s.shots.length > 0
        ? s.shots.map((shot) => ({
            action: shot.action,
            cinematicPrompt: shot.cinematicPrompt,
            durationSeconds: shot.durationSeconds,
            productImageNeeded: shot.productImageNeeded,
            shotType: shot.shotType,
          }))
        : null,
  }));

  return {
    title: raw.title,
    hook: scenes[0]?.dialogue || "",
    targetAudience: raw.targetAudience,
    totalEstimatedDuration: raw.totalDuration,
    scenes,
    viralScore: 0,
    viralReasoning: "",
    productMentions: [],
  };
}

/** Extract the first [emotion] tag from dialogue text */
function extractEmotion(dialogue: string | undefined): string | null {
  if (!dialogue) return null;
  const match = dialogue.match(/\[([a-z]+)\]/i);
  return match ? match[1].toLowerCase() : null;
}

function buildConversationHistory(
  messages: ChatMessage[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.id !== "initial")
    .map((m) => {
      if (m.role === "assistant" && m.structureResult) {
        const structureSummary = m.structureResult.structure
          .map(
            (s, i) =>
              `  ${i + 1}. ${s.slug} (${s.sceneType}) — ${s.description}`,
          )
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
  // ---------------------------------------------------------------------------
  // VideoState — single source of truth
  // ---------------------------------------------------------------------------
  const [videoState, setVideoState] = useAtom(videoStateAtom);
  const setSceneImages = useSetAtom(sceneImagesAtom);

  // ---------------------------------------------------------------------------
  // Chat-only local state (not shared with other components)
  // ---------------------------------------------------------------------------
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);

  // ---------------------------------------------------------------------------
  // Refs for values synced from ChatInterface
  // ---------------------------------------------------------------------------
  const selectedCharacterRef = useRef<any>(null);
  const teamIdRef = useRef<number | null>(null);
  const pollingIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingIntervalsRef.current.forEach(clearInterval);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers to build a UGCScript from VideoState (for image gen etc.)
  // ---------------------------------------------------------------------------
  function buildUGCScriptFromState(vs: VideoState): UGCScript | null {
    if (vs.scenes.length === 0) return null;
    return {
      title: vs.targetAudience
        ? `Script for ${vs.targetAudience}`
        : "Generated Script",
      hook: vs.scenes[0]?.dialogue || "",
      targetAudience: vs.targetAudience,
      totalEstimatedDuration: vs.scenes.reduce(
        (sum, s) => sum + s.estimatedDurationSeconds,
        0,
      ),
      scenes: vs.scenes,
      viralScore: 0,
      viralReasoning: "",
      productMentions: [],
    };
  }

  // ---------------------------------------------------------------------------
  // triggerImageGeneration — fires scene image jobs, polls for completion
  // ---------------------------------------------------------------------------
  const triggerImageGeneration = useCallback(
    async (script: UGCScript, generatedScriptId: string) => {
      const teamId = teamIdRef.current;
      const characterId = selectedCharacterRef.current?.id;
      if (!teamId || !characterId) return;

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
                sceneBuilderAPI
                  .selectSceneImage({
                    scriptId: generatedScriptId,
                    sceneId,
                    sceneNumber: status.sceneNumber,
                    imageKey: firstImage.key,
                    generationJobId: jobId,
                  })
                  .catch(() => {});
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

  // ---------------------------------------------------------------------------
  // sendMessage — routes to the correct agent based on VideoState
  // ---------------------------------------------------------------------------
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
        const agent = resolveAgent(videoState);

        if (agent === "storyboard") {
          const result = await ugcScriptAPI.storyboardChat({
            scriptId: videoState.scriptId!,
            message: text,
            threadId: videoState.threadId,
            teamId: teamIdRef.current ?? undefined,
            characterId: selectedCharacterRef.current?.id ?? undefined,
          });

          // Update scenes from storyboard agent response
          if (result.updatedScript?.scenes) {
            setVideoState((prev) => ({
              ...prev,
              scenes: result.updatedScript.scenes,
            }));
          }

          // If the agent triggered image regeneration, start polling
          if (result.regeneratingJobs?.length) {
            const jobScenePairs = result.regeneratingJobs.map((j) => ({
              jobId: j.jobId,
              sceneId: j.sceneId,
            }));

            // Set affected scenes to "regenerating" state with shot index
            setSceneImages((prev) => {
              const next = { ...prev };
              for (const job of result.regeneratingJobs!) {
                next[job.sceneId] = {
                  ...next[job.sceneId],
                  status: "regenerating",
                  jobId: job.jobId,
                  regeneratingShotIndex: job.singleBRollShotIndex,
                };
              }
              return next;
            });

            // Poll for completion
            const completedJobs = new Set<string>();
            const interval = setInterval(async () => {
              for (const { jobId, sceneId } of jobScenePairs) {
                if (completedJobs.has(jobId)) continue;
                try {
                  const status =
                    await sceneBuilderAPI.getGenerationStatus(jobId);
                  if (
                    status.status === "completed" &&
                    status.images?.length
                  ) {
                    completedJobs.add(jobId);
                    // Merge new images into existing array by index
                    // (preserves other shots during single-shot regen)
                    setSceneImages((prev) => {
                      const existing = prev[sceneId]?.generatedImages || [];
                      const merged = [...existing];
                      for (const newImg of status.images!) {
                        const idx = merged.findIndex(
                          (m) => m.index === newImg.index,
                        );
                        if (idx >= 0) {
                          merged[idx] = newImg;
                        } else {
                          merged.push(newImg);
                        }
                      }
                      return {
                        ...prev,
                        [sceneId]: {
                          ...prev[sceneId],
                          status: "completed",
                          jobId,
                          generatedImages: merged,
                          imageKey: merged[0]?.key,
                          imageUrl: merged[0]?.url,
                          regeneratingShotIndex: undefined,
                        },
                      };
                    });
                    const firstImage = status.images![0];
                    sceneBuilderAPI
                      .selectSceneImage({
                        scriptId: videoState.scriptId!,
                        sceneId,
                        sceneNumber: status.sceneNumber,
                        imageKey: firstImage.key,
                        generationJobId: jobId,
                      })
                      .catch(() => {});
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
                  // Ignore poll errors
                }
              }
              if (completedJobs.size >= jobScenePairs.length) {
                clearInterval(interval);
              }
            }, 2000);
            pollingIntervalsRef.current.push(interval);
          }

          const assistantMessage: ChatMessage = {
            id: nextId(),
            role: "assistant",
            content: result.message,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          // Pre-script phase: route to initStructure
          const conversationHistory =
            buildConversationHistory(currentMessages);

          const result = await ugcScriptAPI.initStructure({
            message: text,
            productImageKeys: attachments
              .map((a) => a.key)
              .filter(Boolean),
            threadId: videoState.threadId,
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
                    targetAudience:
                      (result as any).targetAudience || "",
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
    [messages, videoState, setVideoState],
  );

  // ---------------------------------------------------------------------------
  // acceptStructure — user accepted a structure from the init agent
  // ---------------------------------------------------------------------------
  const acceptStructure = useCallback(
    (result: InitAgentResult, imageKeys: string[]) => {
      const customPattern = result.structure.map((scene) => ({
        type: scene.description,
        shot: scene.sceneType,
      }));

      setVideoState((prev) => ({
        ...prev,
        structureBlueprint: result,
        isSilent: result.isSilent,
        videoType: result.videoType,
        hasCharacter: result.character,
        targetAudience: result.targetAudience || "",
        productImageKeys: imageKeys,
        customPattern,
      }));
    },
    [setVideoState],
  );

  // ---------------------------------------------------------------------------
  // generateScript — call script-agent, populate scenes
  // ---------------------------------------------------------------------------
  const generateScript = useCallback(async () => {
    const blueprint = videoState.structureBlueprint;
    if (!blueprint || !teamIdRef.current) return;

    setVideoState((prev) => ({ ...prev, isGeneratingScript: true }));

    try {
      const character = selectedCharacterRef.current;
      const allImageKeys = messages
        .filter((m) => m.role === "user" && m.attachments)
        .flatMap((m) => m.attachments!.map((a) => a.key));

      const userDirection =
        messages.find((m) => m.role === "user")?.content || "";

      const result = await ugcScriptAPI.generateScriptAgent({
        teamId: teamIdRef.current,
        structure: blueprint.structure,
        characterId: character?.id,
        character: character
          ? {
              name: character.name,
              gender: character.gender,
              age_range: character.age_range,
              appearance_config: character.appearance_config,
            }
          : null,
        voice: videoState.voice ? { name: videoState.voice.name } : null,
        targetAudience: blueprint.targetAudience || "",
        productImageKeys: allImageKeys,
        userDirection,
        isSilent: blueprint.isSilent,
        videoType: blueprint.videoType,
      });

      // Backend now returns script already in UGCScript format (normalized from agent output)
      const script = result.script as UGCScript;

      setVideoState((prev) => ({
        ...prev,
        scriptId: result.scriptId,
        scenes: script.scenes,
        userDirection,
        structureBlueprint: null, // consumed
        isGeneratingScript: false,
      }));

      // Auto-trigger image generation in background
      triggerImageGeneration(script, result.scriptId);
    } catch (error) {
      console.error("[useChatAgent] Script generation failed:", error);
      setVideoState((prev) => ({
        ...prev,
        isGeneratingScript: false,
      }));
    }
  }, [videoState, messages, triggerImageGeneration, setVideoState]);

  // ---------------------------------------------------------------------------
  // loadExistingScript — set VideoState for an existing script
  // ---------------------------------------------------------------------------
  const loadExistingScript = useCallback(
    (meta: ExistingScriptMeta) => {
      setVideoState((prev) => ({
        ...prev,
        isSilent: meta.isSilent,
        hasCharacter: meta.hasCharacter,
        videoType: meta.videoType,
        freshStart: true,
      }));
    },
    [setVideoState],
  );

  // ---------------------------------------------------------------------------
  // retryStructure — re-send the last user message
  // ---------------------------------------------------------------------------
  const retryStructure = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content, lastUserMsg.attachments);
    }
  }, [messages, sendMessage]);

  // ---------------------------------------------------------------------------
  // updateScene — inline edit handler with debounced backend save
  // ---------------------------------------------------------------------------
  const updateScene = useCallback(
    (sceneId: string, patch: Partial<UGCScene>) => {
      setVideoState((prev) => {
        const updatedScenes = prev.scenes.map((s) =>
          s.id === sceneId ? { ...s, ...patch } : s,
        );

        // Debounce backend save (500ms)
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (prev.scriptId) {
          saveTimerRef.current = setTimeout(() => {
            ugcScriptAPI
              .updateScript(prev.scriptId!, { scenes: updatedScenes })
              .catch((err) => {
                console.error(
                  "[useChatAgent] Failed to save scene edit:",
                  err,
                );
              });
          }, 500);
        }

        return { ...prev, scenes: updatedScenes };
      });
    },
    [setVideoState],
  );

  // ---------------------------------------------------------------------------
  // confirmCharacter — write selected character to VideoState
  // ---------------------------------------------------------------------------
  const confirmCharacter = useCallback(() => {
    const character = selectedCharacterRef.current;
    if (character) {
      setVideoState((prev) => ({ ...prev, character }));
    }
  }, [setVideoState]);

  return {
    messages,
    isThinking,
    videoState,
    sendMessage,
    acceptStructure,
    retryStructure,
    generateScript,
    updateScene,
    loadExistingScript,
    confirmCharacter,
    selectedCharacterRef,
    teamIdRef,
  };
}
