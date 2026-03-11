"use client";

import { useRef, useEffect } from "react";
import { ScrollShadow } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import NextImage from "next/image";
import { MessageCard } from "./MessageCard";
import type { ChatMessage, InitAgentResult } from "./types";

interface MessageListProps {
  messages: ChatMessage[];
  isThinking: boolean;
  acceptedResult?: InitAgentResult | null;
  onAccept?: (messageIndex: number) => void;
  onRetry?: () => void;
}

export function MessageList({ messages, isThinking, acceptedResult, onAccept, onRetry }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  return (
    <ScrollShadow className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400/30 to-purple-500/30 flex items-center justify-center shrink-0 ring-1 ring-accent-400/20 overflow-hidden">
              <NextImage
                src="/branding/cuttr logo svg.svg"
                alt="Cuttr"
                width={22}
                height={22}
                className="object-contain"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-accent-400">Cuttr AI</span>
              <div className="bg-surface-elevated rounded-2xl rounded-bl-sm border border-border-base px-4 py-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-accent-400/60"
                      animate={{ y: [0, -6, 0] }}
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
