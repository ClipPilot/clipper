"use client";

import { useRef, useEffect } from "react";
import { ScrollShadow, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import NextImage from "next/image";
import { MessageCard, type ChatColorTheme } from "./MessageCard";
import type { ChatMessage, InitAgentResult } from "./types";

interface MessageListProps {
  messages: ChatMessage[];
  isThinking: boolean;
  acceptedResult?: InitAgentResult | null;
  onAccept?: (messageIndex: number) => void;
  onRetry?: () => void;
  theme?: ChatColorTheme;
  adCloneStep?: "analyzing" | "deconstructing" | null;
  scenesReady?: boolean;
  onGenerateVideo?: () => void;
  isGenerateLoading?: boolean;
}

export function MessageList({ messages, isThinking, acceptedResult, onAccept, onRetry, theme = "default", adCloneStep, scenesReady, onGenerateVideo, isGenerateLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, adCloneStep, scenesReady]);

  const showIndicator = isThinking || !!adCloneStep;

  return (
    <ScrollShadow ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4">
      <div className="max-w-2xl mx-auto min-h-full flex flex-col justify-end py-6 gap-5">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <MessageCard
              key={message.id}
              message={message}
              isAccepted={
                !!message.structureResult && message.structureResult === acceptedResult
              }
              onAccept={
                message.structureResult && !acceptedResult ? () => onAccept?.(index) : undefined
              }
              onRetry={message.structureResult && !acceptedResult ? onRetry : undefined}
              theme={theme}
            />
          ))}
        </AnimatePresence>

        {showIndicator && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400/20 to-purple-500/20 ring-1 ring-accent-400/10 flex items-center justify-center shrink-0 overflow-hidden backdrop-blur-sm">
              <NextImage
                src="/branding/cuttr logo svg.svg"
                alt="Cuttr"
                width={22}
                height={22}
                className="object-contain"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-accent-400/80">Cuttr AI</span>
              {adCloneStep ? (
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium ${
                    adCloneStep === "analyzing"
                      ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                      : "bg-green-500/10 text-green-400 border border-green-500/20"
                  }`}>
                    {adCloneStep === "analyzing" ? (
                      <Icon icon="svg-spinners:pulse-3" width={12} />
                    ) : (
                      <Icon icon="solar:check-circle-bold" width={12} />
                    )}
                    Analyzing
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium ${
                    adCloneStep === "deconstructing"
                      ? "bg-accent-400/10 text-accent-400 border border-accent-400/20"
                      : "bg-white/[0.02] text-text-muted/40 border border-white/[0.04]"
                  }`}>
                    {adCloneStep === "deconstructing" ? (
                      <Icon icon="svg-spinners:pulse-3" width={12} />
                    ) : (
                      <Icon icon="solar:document-text-bold" width={12} />
                    )}
                    Deconstructing
                  </div>
                </div>
              ) : (
                <div className="bg-white/[0.03] rounded-2xl rounded-bl-sm border border-white/[0.06] px-4 py-3 backdrop-blur-sm">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-accent-400/50"
                        animate={{ y: [0, -5, 0] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {scenesReady && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-400/20 to-purple-500/20 ring-1 ring-accent-400/10 flex items-center justify-center shrink-0 mt-1 overflow-hidden backdrop-blur-sm">
              <NextImage
                src="/branding/cuttr logo svg.svg"
                alt="Cuttr"
                width={18}
                height={18}
                className="object-contain"
              />
            </div>
            <div className="max-w-[80%] flex flex-col items-start gap-1.5">
              <span className="text-[11px] font-medium text-accent-400/80">Cuttr AI</span>
              <div className="rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed bg-white/[0.03] text-text-primary/90 rounded-bl-sm border border-white/[0.06] backdrop-blur-sm">
                Your scenes are ready! Click <strong className="font-semibold">Generate Video</strong> to create your video, or ask me to make modifications if you&apos;d like to change anything.
              </div>
              <Button
                size="lg"
                color="primary"
                className="w-full mt-1 font-semibold"
                isLoading={isGenerateLoading}
                isDisabled={isGenerateLoading}
                onPress={onGenerateVideo}
                startContent={!isGenerateLoading ? <Icon icon="solar:play-bold" width={18} /> : undefined}
              >
                {isGenerateLoading ? "Starting..." : "Generate Video"}
              </Button>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollShadow>
  );
}
