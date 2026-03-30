"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "@/lib/socket";
import {
  videoStateAtom,
  resolveAgent,
  type VideoState,
} from "@/store/videoState";
import { sceneImagesAtom, type SceneImageState } from "@/store/ugc";
import { ugcScriptAPI } from "@/api/ugc";
import { adCloneAPI } from "@/api/adClone";
import { videoAPI } from "@/api/video";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import type { UGCScript, UGCScene } from "@/components/ugc-studio/script/types";
import type { VideoAttachment } from "./ChatInput";
import type {
  ChatMessage,
  ChatAttachment,
  InitAgentResult,
  ScriptAgentResult,
  ScriptAgentScene,
} from "./types";

let messageIdCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: "initial",
  role: "assistant",
  content:
    "Hey! Describe the video you'd like to create, or drop in a video to clone an existing ad. Add product images for best results.",
  timestamp: new Date(),
};

function extractEmotion(dialogue: string | undefined): string | null {
  if (!dialogue) return null;
  const match = dialogue.match(/\[([a-z]+)\]/i);
  return match ? match[1].toLowerCase() : null;
}

function mapScenesToUGC(scenes: ScriptAgentScene[]): UGCScene[] {
  return scenes.map((s) => ({
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
    characterIndex: s.characterIndex,
    arollShots: s.arollShots?.map((shot) => ({
      dialogue: shot.dialogue,
      action: shot.action,
      emotion: (extractEmotion(shot.dialogue) || "confident") as UGCScene["emotion"],
      characterIndex: shot.characterIndex,
      ambientSound: shot.ambientSound || null,
    })) || null,
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

interface AdCloneAgentResult {
  responseType: "conversation" | "script";
  message: string;
  videoType: string;
  isSilent: boolean;
  character: boolean;
  targetAudience: string;
  title: string;
  totalDuration: number;
  scenes: ScriptAgentScene[];
}

export interface ExistingScriptMeta {
  isSilent: boolean;
  hasCharacter: boolean;
  videoType: string;
}

export function useChatAgent() {
  const [videoState, setVideoState] = useAtom(videoStateAtom);
  const setSceneImages = useSetAtom(sceneImagesAtom);

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);

  const [videoAttachment, setVideoAttachment] = useState<VideoAttachment | null>(null);
  const [adCloneProjectId, setAdCloneProjectId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [adCloneStep, setAdCloneStep] = useState<"analyzing" | "deconstructing" | null>(null);
  const waitingForAnalysisRef = useRef(false);

  const selectedCharacterRef = useRef<any>(null);
  const selectedCharactersRef = useRef<Array<{ character: any; voiceId?: string; voiceName?: string }>>([]);
  const teamIdRef = useRef<number | null>(null);
  const pollingIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const socketCleanupRef = useRef<(() => void) | null>(null);
  const pendingAnalysisRef = useRef<{ text: string; imageKeys: string[] } | null>(null);
  const threadIdRef = useRef(`thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const adCloneScriptRef = useRef<AdCloneAgentResult | null>(null);

  useEffect(() => {
    return () => {
      pollingIntervalsRef.current.forEach(clearInterval);
      socketCleanupRef.current?.();
    };
  }, []);

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

  const triggerImageGeneration = useCallback(
    async (script: UGCScript, generatedScriptId: string) => {
      const teamId = teamIdRef.current;
      const characterId = selectedCharacterRef.current?.id;
      const multiChars = selectedCharactersRef.current;
      if (!teamId || (!characterId && multiChars.length === 0)) return;

      const scenesPayload = script.scenes.map((scene) => ({
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        sceneType: scene.sceneType,
        dialogue: scene.dialogue,
        action: scene.action,
        emotion: scene.emotion,
        shotType: scene.shotType,
        cameraAngle: scene.cameraAngle,
        characterIndex: scene.characterIndex,
        bRollShots: scene.bRollShots,
        arollShots: scene.arollShots,
      }));

      const initialImageState: Record<string, SceneImageState> = {};
      for (const scene of script.scenes) {
        initialImageState[scene.id] = { status: "generating" };
      }
      setSceneImages(initialImageState);

      try {
        const result = await sceneBuilderAPI.generateAllSceneImages({
          teamId,
          scriptId: generatedScriptId,
          characterId: characterId || multiChars[0]?.character.id,
          scenes: scenesPayload,
        });

        if (!result.success || !result.jobIds?.length) return;

        const jobScenePairs: Array<{ jobId: string; sceneId: string }> = [];
        result.jobIds.forEach((jobId, idx) => {
          if (scenesPayload[idx]) {
            jobScenePairs.push({ jobId, sceneId: scenesPayload[idx].sceneId });
          }
        });

        setSceneImages((prev) => {
          const next = { ...prev };
          for (const { jobId, sceneId } of jobScenePairs) {
            next[sceneId] = { ...next[sceneId], status: "generating", jobId };
          }
          return next;
        });

        const completedJobs = new Set<string>();
        const interval = setInterval(async () => {
          for (const { jobId, sceneId } of jobScenePairs) {
            if (completedJobs.has(jobId)) continue;
            try {
              const status = await sceneBuilderAPI.getGenerationStatus(jobId);
              if (status.status === "completed" && status.images?.length) {
                completedJobs.add(jobId);
                setSceneImages((prev) => ({
                  ...prev,
                  [sceneId]: {
                    ...prev[sceneId],
                    status: "completed",
                    jobId,
                    generatedImages: status.images,
                    imageKey: status.images![0].key,
                    imageUrl: status.images![0].url,
                  },
                }));
                sceneBuilderAPI
                  .selectSceneImage({
                    scriptId: generatedScriptId,
                    sceneId,
                    sceneNumber: status.sceneNumber,
                    imageKey: status.images![0].key,
                    generationJobId: jobId,
                  })
                  .catch(() => {});
              } else if (status.status === "failed") {
                completedJobs.add(jobId);
                setSceneImages((prev) => ({
                  ...prev,
                  [sceneId]: { ...prev[sceneId], status: "failed", jobId },
                }));
              }
            } catch {
              // ignore
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

  const handleAdCloneAnalysisComplete = useCallback(
    async (pid: string) => {
      const pending = pendingAnalysisRef.current;
      if (!pending) return;

      setIsThinking(true);
      setAdCloneStep("deconstructing");

      try {
        const conversationHistory = buildConversationHistory(messages);
        const result = await adCloneAPI.initStructure({
          projectId: pid,
          message: pending.text,
          productImageKeys: pending.imageKeys,
          threadId: threadIdRef.current,
          conversationHistory,
        });

        let structureResult: InitAgentResult | undefined;
        if (result.responseType === "script" && result.scenes?.length) {
          adCloneScriptRef.current = result as AdCloneAgentResult;
          structureResult = {
            videoType: result.videoType,
            isSilent: result.isSilent,
            character: result.character,
            characterCount: (result as any).characterCount,
            targetAudience: result.targetAudience,
            structure: result.scenes.map((s: any) => ({
              sceneType: s.sceneType,
              slug: s.slug,
              description: s.storyBeat,
              characterIndex: s.characterIndex,
              shots: s.shots?.map((sh: any) => ({ label: sh.label, shotType: sh.shotType })) || [],
            })),
          };
        }

        setMessages((prev) => {
          return [
            ...prev,
            {
              id: nextId(),
              role: "assistant" as const,
              content: result.message,
              structureResult,
              timestamp: new Date(),
            },
          ];
        });
      } catch (error) {
        setMessages((prev) => {
          return [
            ...prev,
            {
              id: nextId(),
              role: "assistant" as const,
              content: error instanceof Error
                ? `Something went wrong: ${error.message}. Try again?`
                : "Something went wrong. Try again?",
              timestamp: new Date(),
            },
          ];
        });
      } finally {
        setIsThinking(false);
        setIsAnalyzing(false);
        setAnalysisComplete(true);
        setAdCloneStep(null);
        waitingForAnalysisRef.current = false;
        pendingAnalysisRef.current = null;
      }
    },
    [messages],
  );

  const connectSocketAndListen = useCallback(
    (pid: string, teamId: number) => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const socketUrl = getSocketUrl();
      const socket = io(socketUrl, { transports: ["websocket", "polling"] });
      socketRef.current = socket;
      let handled = false;

      const cleanup = () => {
        clearInterval(fallbackInterval);
        clearTimeout(timeout);
        socket.emit("leave-team", teamId);
        socket.disconnect();
        if (socketRef.current === socket) socketRef.current = null;
      };

      socket.on("connect", () => {
        socket.emit("join-team", teamId);
      });

      socket.on("ad-clone-job-update", (update: any) => {
        if (update.projectId !== pid) return;
        if (update.status === "analysis_complete" || update.status === "script_generated") {
          if (handled) return;
          handled = true;
          cleanup();
          handleAdCloneAnalysisComplete(pid);
        } else if (update.status === "failed") {
          if (handled) return;
          handled = true;
          cleanup();
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== "analyzing-placeholder");
            return [
              ...filtered,
              { id: nextId(), role: "assistant", content: `Analysis failed: ${update.error || "Unknown error"}. Please try again.`, timestamp: new Date() },
            ];
          });
          setIsThinking(false);
          setIsAnalyzing(false);
          setAdCloneStep(null);
          waitingForAnalysisRef.current = false;
        }
      });

      const fallbackInterval = setInterval(async () => {
        if (handled) return;
        try {
          const resp = await adCloneAPI.getProject(pid);
          if (!resp?.project) return;
          if (resp.project.status === "analysis_complete" || resp.project.status === "script_generated") {
            if (handled) return;
            handled = true;
            cleanup();
            handleAdCloneAnalysisComplete(pid);
          } else if (resp.project.status === "failed") {
            if (handled) return;
            handled = true;
            cleanup();
            setMessages((prev) => [
              ...prev,
              { id: nextId(), role: "assistant", content: `Analysis failed. Please try again.`, timestamp: new Date() },
            ]);
            setIsThinking(false);
            setIsAnalyzing(false);
            setAdCloneStep(null);
            waitingForAnalysisRef.current = false;
          }
        } catch {
          // ignore
        }
      }, 5000);

      const timeout = setTimeout(() => {
        if (handled) return;
        handled = true;
        cleanup();
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", content: "Analysis timed out. Please try again.", timestamp: new Date() },
        ]);
        setIsThinking(false);
        setIsAnalyzing(false);
        setAdCloneStep(null);
        waitingForAnalysisRef.current = false;
      }, 180_000);

      return cleanup;
    },
    [handleAdCloneAnalysisComplete],
  );

  const sendMessage = useCallback(
    async (text: string, attachments: ChatAttachment[] = []) => {
      const userMessage: ChatMessage = {
        id: nextId(),
        role: "user",
        content: text,
        attachments: attachments.length > 0 ? attachments : undefined,
        videoAttachment: videoAttachment ? { name: videoAttachment.name, preview: videoAttachment.preview, url: videoAttachment.url } : undefined,
        timestamp: new Date(),
      };

      const currentMessages = [...messages, userMessage];
      setMessages(currentMessages);
      setIsThinking(true);

      try {
        const agent = resolveAgent(videoState);
        const teamId = teamIdRef.current;

        if (agent === "storyboard") {
          const result = await ugcScriptAPI.storyboardChat({
            scriptId: videoState.scriptId!,
            message: text,
            threadId: videoState.threadId,
            teamId: teamId ?? undefined,
            characterId: selectedCharacterRef.current?.id ?? undefined,
          });

          if (result.updatedScript?.scenes) {
            setVideoState((prev) => ({ ...prev, scenes: result.updatedScript.scenes }));
          }

          if (result.regeneratingJobs?.length) {
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

            const completedJobs = new Set<string>();
            const interval = setInterval(async () => {
              for (const job of result.regeneratingJobs!) {
                if (completedJobs.has(job.jobId)) continue;
                try {
                  const status = await sceneBuilderAPI.getGenerationStatus(job.jobId);
                  if (status.status === "completed" && status.images?.length) {
                    completedJobs.add(job.jobId);
                    setSceneImages((prev) => {
                      const existing = prev[job.sceneId]?.generatedImages || [];
                      const merged = [...existing];
                      for (const newImg of status.images!) {
                        const idx = merged.findIndex((m) => m.index === newImg.index);
                        if (idx >= 0) merged[idx] = newImg;
                        else merged.push(newImg);
                      }
                      return {
                        ...prev,
                        [job.sceneId]: {
                          ...prev[job.sceneId],
                          status: "completed",
                          jobId: job.jobId,
                          generatedImages: merged,
                          imageKey: merged[0]?.key,
                          imageUrl: merged[0]?.url,
                          regeneratingShotIndex: undefined,
                        },
                      };
                    });
                    sceneBuilderAPI
                      .selectSceneImage({
                        scriptId: videoState.scriptId!,
                        sceneId: job.sceneId,
                        sceneNumber: status.sceneNumber,
                        imageKey: status.images![0].key,
                        generationJobId: job.jobId,
                      })
                      .catch(() => {});
                  } else if (status.status === "failed") {
                    completedJobs.add(job.jobId);
                    setSceneImages((prev) => ({
                      ...prev,
                      [job.sceneId]: { ...prev[job.sceneId], status: "failed", jobId: job.jobId },
                    }));
                  }
                } catch {
                  // ignore
                }
              }
              if (completedJobs.size >= result.regeneratingJobs!.length) {
                clearInterval(interval);
              }
            }, 2000);
            pollingIntervalsRef.current.push(interval);
          }

          setMessages((prev) => [
            ...prev,
            { id: nextId(), role: "assistant", content: result.message, timestamp: new Date() },
          ]);
        } else if (videoAttachment && teamId && !adCloneProjectId) {
          // Ad clone: create project, upload video, start analysis
          const imageKeys = attachments.map((a) => a.key).filter(Boolean);
          const createResult = await adCloneAPI.createProject({
            teamId,
            adDirection: text,
          });

          const pid = createResult.projectId;
          setAdCloneProjectId(pid);

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

          pendingAnalysisRef.current = { text, imageKeys };
          setIsAnalyzing(true);
          setAdCloneStep("analyzing");
          waitingForAnalysisRef.current = true;


          socketCleanupRef.current?.();
          socketCleanupRef.current = connectSocketAndListen(pid, teamId);
          await adCloneAPI.startAnalysis(pid, teamId);
        } else if (adCloneProjectId && analysisComplete) {
          // Ad clone follow-up: refine the structure
          const conversationHistory = buildConversationHistory(currentMessages);
          const imageKeys = attachments.map((a) => a.key).filter(Boolean);

          const result = await adCloneAPI.initStructure({
            projectId: adCloneProjectId,
            message: text,
            productImageKeys: imageKeys,
            threadId: threadIdRef.current,
            conversationHistory,
          });

          let structureResult: InitAgentResult | undefined;
          if (result.responseType === "script" && result.scenes?.length) {
            adCloneScriptRef.current = result as AdCloneAgentResult;
            structureResult = {
              videoType: result.videoType,
              isSilent: result.isSilent,
              character: result.character,
              characterCount: (result as any).characterCount,
              targetAudience: result.targetAudience,
              structure: result.scenes.map((s: any) => ({
                sceneType: s.sceneType,
                slug: s.slug,
                description: s.storyBeat,
                characterIndex: s.characterIndex,
                shots: s.shots?.map((sh: any) => ({ label: sh.label, shotType: sh.shotType })) || [],
              })),
            };
          }

          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: result.message,
              structureResult,
              timestamp: new Date(),
            },
          ]);
        } else {
          // Standard UGC: route to initStructure
          const conversationHistory = buildConversationHistory(currentMessages);
          const result = await ugcScriptAPI.initStructure({
            message: text,
            productImageKeys: attachments.map((a) => a.key).filter(Boolean),
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
                    characterCount: (result as any).characterCount,
                    targetAudience: (result as any).targetAudience || "",
                    structure: result.structure,
                  }
                : undefined,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: error instanceof Error
              ? `Something went wrong: ${error.message}. Try again?`
              : "Something went wrong. Try again?",
            timestamp: new Date(),
          },
        ]);
      } finally {
        if (!waitingForAnalysisRef.current) {
          setIsThinking(false);
        }
      }
    },
    [messages, videoState, videoAttachment, adCloneProjectId, analysisComplete, setVideoState, setSceneImages, connectSocketAndListen],
  );

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
        characterCount: result.characterCount ?? (result.character ? 1 : 0),
        targetAudience: result.targetAudience || "",
        productImageKeys: imageKeys,
        customPattern,
      }));

      // If ad clone agent provided scenes, pre-populate them
      if (adCloneScriptRef.current?.scenes?.length) {
        const mappedScenes = mapScenesToUGC(adCloneScriptRef.current.scenes);
        setVideoState((prev) => ({ ...prev, scenes: mappedScenes }));
      }
    },
    [setVideoState],
  );

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

      if (adCloneScriptRef.current?.scenes?.length) {
        // Ad clone path: save the pre-generated script
        const mappedScenes = mapScenesToUGC(adCloneScriptRef.current.scenes);
        const scriptToSave = {
          title: adCloneScriptRef.current.title,
          targetAudience: adCloneScriptRef.current.targetAudience,
          totalDuration: adCloneScriptRef.current.totalDuration,
          scenes: mappedScenes,
        };

        const result = await ugcScriptAPI.saveScript({
          teamId: teamIdRef.current,
          script: scriptToSave,
          characterId: character?.id,
          productImageKeys: allImageKeys,
          isSilent: blueprint.isSilent,
          videoType: blueprint.videoType,
        });

        setVideoState((prev) => ({
          ...prev,
          scriptId: result.scriptId,
          scenes: mappedScenes,
          userDirection,
          structureBlueprint: null,
          isGeneratingScript: false,
        }));

        if (adCloneProjectId) {
          adCloneAPI.updateScript(adCloneProjectId, {
            script: { ...scriptToSave, _scriptId: result.scriptId },
          }).catch(() => {});
        }

        const ugcScript: UGCScript = {
          title: scriptToSave.title,
          hook: mappedScenes[0]?.dialogue || "",
          targetAudience: scriptToSave.targetAudience,
          totalEstimatedDuration: scriptToSave.totalDuration,
          scenes: mappedScenes,
          viralScore: 0,
          viralReasoning: "",
          productMentions: [],
        };
        triggerImageGeneration(ugcScript, result.scriptId);
      } else {
        // Standard UGC path: generate script via agent
        const multiChars = selectedCharactersRef.current;
        const isMultiChar = multiChars.length > 1;

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
          characters: isMultiChar
            ? multiChars.map((c) => ({
                characterId: c.character.id,
                character: {
                  name: c.character.name,
                  gender: c.character.gender,
                  age_range: c.character.age_range,
                  appearance_config: c.character.appearance_config,
                },
                voiceId: c.voiceId,
              }))
            : undefined,
          voice: videoState.voice ? { name: videoState.voice.name } : null,
          targetAudience: blueprint.targetAudience || "",
          productImageKeys: allImageKeys,
          userDirection,
          isSilent: blueprint.isSilent,
          videoType: blueprint.videoType,
        });

        const script = result.script as UGCScript;

        setVideoState((prev) => ({
          ...prev,
          scriptId: result.scriptId,
          scenes: script.scenes,
          userDirection,
          structureBlueprint: null,
          isGeneratingScript: false,
        }));

        triggerImageGeneration(script, result.scriptId);
      }
    } catch (error) {
      console.error("[useChatAgent] Script generation failed:", error);
      setVideoState((prev) => ({ ...prev, isGeneratingScript: false }));
    }
  }, [videoState, messages, adCloneProjectId, triggerImageGeneration, setVideoState]);

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

  const retryStructure = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content, lastUserMsg.attachments);
    }
  }, [messages, sendMessage]);

  const updateScene = useCallback(
    (sceneId: string, patch: Partial<UGCScene>) => {
      setVideoState((prev) => {
        const updatedScenes = prev.scenes.map((s) =>
          s.id === sceneId ? { ...s, ...patch } : s,
        );

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (prev.scriptId) {
          saveTimerRef.current = setTimeout(() => {
            ugcScriptAPI
              .updateScript(prev.scriptId!, { scenes: updatedScenes })
              .catch((err) => {
                console.error("[useChatAgent] Failed to save scene edit:", err);
              });
          }, 500);
        }

        return { ...prev, scenes: updatedScenes };
      });
    },
    [setVideoState],
  );

  const confirmCharacter = useCallback(() => {
    const character = selectedCharacterRef.current;
    if (character) {
      setVideoState((prev) => ({ ...prev, character }));
    }
  }, [setVideoState]);

  const confirmCharacters = useCallback((chars: Array<{ character: any; voiceId?: string; voiceName?: string }>) => {
    selectedCharactersRef.current = chars;
    setVideoState((prev) => ({ ...prev, characters: chars }));
  }, [setVideoState]);

  const regenerateAllImages = useCallback(() => {
    if (!videoState.scriptId || videoState.scenes.length === 0) return;
    const script: UGCScript = {
      title: "",
      hook: "",
      targetAudience: "",
      totalEstimatedDuration: 0,
      scenes: videoState.scenes,
      viralScore: 0,
      viralReasoning: "",
      productMentions: [],
    };
    triggerImageGeneration(script, videoState.scriptId);
  }, [videoState.scriptId, videoState.scenes, triggerImageGeneration]);

  return {
    messages,
    isThinking,
    isAnalyzing,
    adCloneStep,
    videoState,
    videoAttachment,
    setVideoAttachment,
    adCloneProjectId,
    sendMessage,
    acceptStructure,
    retryStructure,
    generateScript,
    updateScene,
    loadExistingScript,
    confirmCharacter,
    confirmCharacters,
    regenerateAllImages,
    selectedCharacterRef,
    selectedCharactersRef,
    teamIdRef,
  };
}
