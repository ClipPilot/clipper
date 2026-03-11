"use client";

import { motion } from "framer-motion";
import { Image } from "@heroui/react";
import NextImage from "next/image";
import type { ChatMessage } from "./types";
import { StructurePreview } from "./StructurePreview";

interface MessageCardProps {
  message: ChatMessage;
  isAccepted?: boolean;
  onAccept?: () => void;
  onRetry?: () => void;
}

export function MessageCard({ message, isAccepted, onAccept, onRetry }: MessageCardProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400/30 to-purple-500/30 flex items-center justify-center shrink-0 mt-1 ring-1 ring-accent-400/20 overflow-hidden">
          <NextImage
            src="/branding/cuttr logo svg.svg"
            alt="Cuttr"
            width={22}
            height={22}
            className="object-contain"
          />
        </div>
      )}

      <div className={`max-w-[80%] flex flex-col ${isUser ? "items-end" : "items-start"} gap-2`}>
        {/* Sender label */}
        <span className={`text-[11px] font-medium ${isUser ? "text-text-muted" : "text-accent-400"}`}>
          {isUser ? "You" : "Cuttr AI"}
        </span>

        {/* Image attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={`flex gap-2 flex-wrap ${isUser ? "justify-end" : "justify-start"}`}>
            {message.attachments.map((att, i) => (
              <Image
                key={i}
                src={att.url}
                alt={`Attachment ${i + 1}`}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ))}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-accent-400 text-white rounded-br-sm"
              : "bg-surface-elevated text-text-primary rounded-bl-sm border border-border-base"
          }`}
        >
          {message.content}
        </div>

        {/* Structure result */}
        {message.structureResult && (
          <StructurePreview
            result={message.structureResult}
            isAccepted={isAccepted}
            onAccept={onAccept}
            onRetry={onRetry}
          />
        )}
      </div>
    </motion.div>
  );
}
