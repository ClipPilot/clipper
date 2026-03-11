"use client";

import {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type KeyboardEvent,
} from "react";
import { Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { ugcScriptAPI } from "@/api/ugc";
import { useTeams } from "@/hooks/useTeams";
import type { ChatAttachment } from "./types";

interface ChatInputProps {
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  isDisabled?: boolean;
}

export interface ChatInputHandle {
  addFiles: (files: File[]) => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput({ onSend, isDisabled }, ref) {
    const [text, setText] = useState("");
    const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { selectedTeam } = useTeams();

    const hasContent = text.trim().length > 0;
    const hasAttachments = attachments.length > 0;

    const handleFiles = useCallback(
      async (files: FileList | File[]) => {
        if (!selectedTeam) return;
        const teamId = selectedTeam.id;
        const fileArray = Array.from(files).slice(0, 5 - attachments.length);
        if (fileArray.length === 0) return;

        setIsUploading(true);
        try {
          const uploaded = await Promise.all(
            fileArray.map(async (file) => {
              const result = await ugcScriptAPI.uploadImage(teamId, file);
              return { key: result.key, url: result.url, file };
            }),
          );
          setAttachments((prev) => [...prev, ...uploaded].slice(0, 5));
        } catch (err) {
          console.error("Upload failed:", err);
        } finally {
          setIsUploading(false);
        }
      },
      [selectedTeam, attachments.length],
    );

    // Expose addFiles so drag-and-drop can feed into input attachments
    useImperativeHandle(ref, () => ({
      addFiles: (files: File[]) => handleFiles(files),
    }), [handleFiles]);

    const removeAttachment = (index: number) => {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
      const trimmed = text.trim();
      if (!trimmed) return;
      onSend(trimmed, attachments);
      setText("");
      setAttachments([]);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    return (
      <div className="px-4 pb-4 pt-2">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm overflow-hidden shadow-xl shadow-black/10 transition-all duration-300 focus-within:border-accent-400/30 focus-within:shadow-accent-400/5 focus-within:shadow-2xl">
            {/* Attached images row */}
            <AnimatePresence>
              {hasAttachments && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2.5 px-4 pt-3">
                    {attachments.map((att, i) => (
                      <motion.div
                        key={att.key}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        className="relative group"
                      >
                        <img
                          src={att.url}
                          alt={`Upload ${i + 1}`}
                          className="w-14 h-14 rounded-xl object-cover ring-1 ring-white/10"
                        />
                        <button
                          onClick={() => removeAttachment(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/90 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 scale-75 group-hover:scale-100 shadow-lg shadow-red-500/20"
                        >
                          <Icon icon="solar:close-circle-bold" width={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div className="flex items-end gap-1.5 p-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isDisabled || isUploading || attachments.length >= 5}
                className="shrink-0 mb-0.5 w-8 h-8 rounded-xl flex items-center justify-center text-text-muted hover:text-accent-400 hover:bg-accent-400/10 transition-all duration-200 disabled:opacity-30 disabled:hover:text-text-muted disabled:hover:bg-transparent"
              >
                <Icon icon="solar:gallery-minimalistic-bold-duotone" width={20} />
              </button>

              <Textarea
                value={text}
                onValueChange={setText}
                onKeyDown={handleKeyDown}
                placeholder={hasAttachments ? "Describe what video to make with these images..." : "Describe the video you want to make..."}
                minRows={1}
                maxRows={4}
                isDisabled={isDisabled}
                classNames={{
                  inputWrapper:
                    "bg-transparent shadow-none border-none data-[hover=true]:bg-transparent group-data-[focus=true]:bg-transparent !ring-0 !ring-offset-0 min-h-[36px]",
                  input: "text-sm text-text-primary placeholder:text-text-muted/50",
                  innerWrapper: "pb-0",
                }}
              />

              {/* Send button */}
              <motion.div
                className="shrink-0 mb-0.5"
                whileTap={hasContent && !isDisabled ? { scale: 0.9 } : {}}
              >
                <button
                  onClick={handleSubmit}
                  disabled={isDisabled || !hasContent}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    hasContent && !isDisabled
                      ? "bg-gradient-to-br from-accent-400 to-purple-500 text-white shadow-lg shadow-accent-400/25 hover:shadow-xl hover:shadow-accent-400/30 hover:brightness-110"
                      : "bg-white/[0.04] text-text-muted/40"
                  }`}
                >
                  {isUploading ? (
                    <Icon icon="solar:loading-circle-bold" width={16} className="animate-spin" />
                  ) : (
                    <Icon icon="solar:plain-bold" width={16} />
                  )}
                </button>
              </motion.div>
            </div>
          </div>

          <p className="text-[11px] text-text-muted/40 text-center mt-2.5">
            Attach product images for better results
          </p>
        </div>
      </div>
    );
  },
);
