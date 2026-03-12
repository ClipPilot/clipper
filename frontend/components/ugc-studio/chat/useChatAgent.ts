"use client";

import { useState, useCallback, useRef } from "react";
import { useSetAtom } from "jotai";
import {
  isSilentAtom,
  productImageKeysAtom,
  videoTypeAtom,
  hasCharacterAtom,
  customPatternAtom,
} from "@/store/ugc";
import { ugcScriptAPI } from "@/api/ugc";
import type { ChatMessage, ChatAttachment, InitAgentResult, ArtifactType } from "./types";

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

/**
 * Serialize chat messages into the format the Mastra agent expects.
 * Includes assistant structured results as text so the agent can reference them.
 */
function buildConversationHistory(
  messages: ChatMessage[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.id !== "initial") // skip the greeting
    .map((m) => {
      if (m.role === "assistant" && m.structureResult) {
        // Serialize the structured result so the agent can see what it previously generated
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

export function useChatAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);
  const [acceptedResult, setAcceptedResult] = useState<InitAgentResult | null>(null);
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactType | null>(null);
  const threadIdRef = useRef(`thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const setIsSilent = useSetAtom(isSilentAtom);
  const setProductImageKeys = useSetAtom(productImageKeysAtom);
  const setVideoType = useSetAtom(videoTypeAtom);
  const setHasCharacter = useSetAtom(hasCharacterAtom);
  const setCustomPattern = useSetAtom(customPatternAtom);

  const sendMessage = useCallback(
    async (text: string, attachments: ChatAttachment[] = []) => {
      const userMessage: ChatMessage = {
        id: nextId(),
        role: "user",
        content: text,
        attachments: attachments.length > 0 ? attachments : undefined,
        timestamp: new Date(),
      };

      // Capture current messages before adding the new one
      const currentMessages = [...messages, userMessage];
      setMessages(currentMessages);
      setIsThinking(true);

      try {
        // Build conversation history from all previous messages
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
          // Only attach structure if the agent generated one (non-empty)
          structureResult:
            result.responseType === "structure" && result.structure?.length
              ? {
                  videoType: result.videoType!,
                  isSilent: result.isSilent!,
                  character: result.character!,
                  structure: result.structure,
                }
              : undefined,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
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
    [messages],
  );

  const acceptStructure = useCallback(
    (result: InitAgentResult, imageKeys: string[]) => {
      // Map agent structure → customPattern format for downstream generateScript
      // Agent: { sceneType: "a-roll"|"b-roll"|"visual", slug, description: "hook"|"demo"|... }
      // Downstream: { type: "hook", shot: "a-roll" }
      const customPattern = result.structure.map((scene) => ({
        type: scene.description,
        shot: scene.sceneType,
      }));

      // Set all atoms so downstream steps (ScriptStep, AudioStep, etc.) have what they need
      setIsSilent(result.isSilent);
      setProductImageKeys(imageKeys);
      setVideoType(result.videoType);
      setHasCharacter(result.character);
      setCustomPattern(customPattern);

      setAcceptedResult(result);

      // If no character needed, skip CharacterStep → go straight to voice (or under-construction if silent)
      if (!result.character) {
        setCurrentArtifact(result.isSilent ? "under-construction" : "voice");
      } else {
        setCurrentArtifact("character");
      }
    },
    [setIsSilent, setProductImageKeys, setVideoType, setHasCharacter, setCustomPattern],
  );

  const advanceArtifact = useCallback(() => {
    setCurrentArtifact((prev) => {
      if (prev === "character") {
        return acceptedResult?.isSilent ? "under-construction" : "voice";
      }
      if (prev === "voice") return "under-construction";
      return prev;
    });
  }, [acceptedResult]);

  const retryStructure = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content, lastUserMsg.attachments);
    }
  }, [messages, sendMessage]);

  return {
    messages,
    isThinking,
    acceptedResult,
    currentArtifact,
    sendMessage,
    acceptStructure,
    advanceArtifact,
    retryStructure,
  };
}
