"use client";

import { useState, useCallback } from "react";
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
  content: "What video do you want to make today? Describe your idea and attach any product images.",
  timestamp: new Date(),
};

export function useChatAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);
  const [acceptedResult, setAcceptedResult] = useState<InitAgentResult | null>(null);
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactType | null>(null);

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

      setMessages((prev) => [...prev, userMessage]);
      setIsThinking(true);

      try {
        const result = await ugcScriptAPI.initStructure({
          message: text,
          productImageKeys: attachments.map((a) => a.key).filter(Boolean),
        });

        const assistantMessage: ChatMessage = {
          id: nextId(),
          role: "assistant",
          content: "Here's the structure I'd suggest for your video:",
          structureResult: {
            videoType: result.videoType,
            isSilent: result.isSilent,
            character: result.character,
            structure: result.structure,
          },
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
    [],
  );

  const acceptStructure = useCallback(
    (result: InitAgentResult, imageKeys: string[]) => {
      // Map agent structure → customPattern format for downstream generateScript
      // Agent: { sceneType: "a-roll"|"b-roll", slug, description: "hook"|"demo"|... }
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
