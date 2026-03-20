"use client";

import { useRef, useEffect } from "react";
import { ScrollShadow } from "@heroui/react";
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
}

export function MessageList({ messages, isThinking, acceptedResult, onAccept, onRetry, theme = "default" }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

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

        {/* Typing indicator */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 ring-1 overflow-hidden backdrop-blur-sm ${
              theme === "orange"
                ? "from-orange-500/20 to-amber-500/20 ring-orange-500/10"
                : "from-accent-400/20 to-purple-500/20 ring-accent-400/10"
            }`}>
              <NextImage
                src="/branding/cuttr logo svg.svg"
                alt="Cuttr"
                width={22}
                height={22}
                className="object-contain"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={`text-[11px] font-medium ${theme === "orange" ? "text-orange-500/80" : "text-accent-400/80"}`}>Cuttr AI</span>
              <div className="bg-white/[0.03] rounded-2xl rounded-bl-sm border border-white/[0.06] px-4 py-3 backdrop-blur-sm">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${theme === "orange" ? "bg-orange-500/50" : "bg-accent-400/50"}`}
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
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollShadow>
  );
}
