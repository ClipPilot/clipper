"use client";

import { motion } from "framer-motion";
import {  } from "@heroui/react";
import { Icon } from "@iconify/react";
import NextImage from "next/image";
import Markdown from "react-markdown";
import type { ChatMessage } from "./types";
import { StructurePreview } from "./StructurePreview";

function highlightMentions(text: string): React.ReactNode {
  const parts = text.split(/(@[Ss]cene \d+(?: [Ss]hot \d+)?)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (/@[Ss]cene \d+/i.test(part)) {
      return (
        <span key={i} className="bg-white/30 text-white px-1 py-0.5 rounded font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
}

export type ChatColorTheme = "default" | "orange";

interface MessageCardProps {
  message: ChatMessage;
  isAccepted?: boolean;
  onAccept?: () => void;
  onRetry?: () => void;
  theme?: ChatColorTheme;
}

export function MessageCard({ message, isAccepted, onAccept, onRetry, theme = "default" }: MessageCardProps) {
  const isUser = message.role === "user";
  const isOrange = theme === "orange";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 mt-1 ring-1 overflow-hidden backdrop-blur-sm ${
          isOrange
            ? "from-orange-500/20 to-amber-500/20 ring-orange-500/10"
            : "from-accent-400/20 to-purple-500/20 ring-accent-400/10"
        }`}>
          <NextImage
            src="/branding/cuttr logo svg.svg"
            alt="Cuttr"
            width={18}
            height={18}
            className="object-contain"
          />
        </div>
      )}

      <div className={`max-w-[80%] flex flex-col ${isUser ? "items-end" : "items-start"} gap-1.5`}>
        {/* Sender label */}
        <span className={`text-[11px] font-medium ${
          isUser ? "text-text-muted/60" : isOrange ? "text-orange-500/80" : "text-accent-400/80"
        }`}>
          {isUser ? "You" : "Cuttr AI"}
        </span>

        {message.videoAttachment && (
          <div className="rounded-xl overflow-hidden ring-1 ring-white/10 max-w-[240px]">
            {message.videoAttachment.preview ? (
              <video
                src={message.videoAttachment.preview}
                className="w-full max-h-[160px] object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04]">
                <Icon icon="solar:videocamera-record-bold-duotone" width={16} className="text-orange-500 shrink-0" />
                <span className="text-xs text-text-muted truncate">{message.videoAttachment.name}</span>
              </div>
            )}
          </div>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <div className={`flex gap-2 flex-wrap ${isUser ? "justify-end" : "justify-start"}`}>
            {message.attachments.map((att, i) => (
              <img
 key={i}
 src={att.url}
 alt={`Attachment ${i + 1}`}
 className="w-16 h-16 rounded-xl object-cover ring-1 ring-white/5"
 />
            ))}
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
            isUser
              ? isOrange
                ? "bg-orange-500 text-white rounded-br-sm shadow-lg shadow-orange-500/10"
                : "bg-accent-400 text-white rounded-br-sm shadow-lg shadow-accent-400/10"
              : "bg-white/[0.03] text-text-primary/90 rounded-bl-sm border border-white/[0.06] backdrop-blur-sm"
          }`}
        >
          {isUser && /@scene \d/i.test(message.content) ? (
            <p>{highlightMentions(message.content)}</p>
          ) : (
            <Markdown
              components={{
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em>{children}</em>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-1">{children}</ol>,
                li: ({ children }) => <li className="mb-0.5">{children}</li>,
              }}
            >
              {message.content}
            </Markdown>
          )}
        </div>

        {/* Structure result */}
        {message.structureResult && (
          <StructurePreview
            result={message.structureResult}
            isAccepted={isAccepted}
            onAccept={onAccept}
            onRetry={onRetry}
            theme={theme}
          />
        )}
      </div>
    </motion.div>
  );
}
