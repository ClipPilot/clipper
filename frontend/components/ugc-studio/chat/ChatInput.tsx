"use client";

import {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
  type KeyboardEvent,
} from "react";
import { TextArea, Input, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useAtom } from "jotai";
import { sceneRefAtom } from "@/store/ugc";
import { videoStateAtom } from "@/store/videoState";
import { useAtomValue } from "jotai";
import { SceneMentionDropdown } from "./SceneMentionDropdown";
import { ugcScriptAPI } from "@/api/ugc";
import { videoAPI } from "@/api/video";
import { useTeams } from "@/hooks/useTeams";
import type { ChatAttachment } from "./types";

export interface VideoAttachment {
  file?: File;
  url?: string;
  name: string;
  size?: number;
  preview?: string;
  s3Key?: string;
}

interface ChatInputProps {
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  isDisabled?: boolean;
  placeholder?: string;
  videoAttachment?: VideoAttachment | null;
  onVideoAttach?: (video: VideoAttachment | null) => void;
}

export interface ChatInputHandle {
  addFiles: (files: File[]) => void;
}

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".avi", ".mkv"];
const MAX_VIDEO_SIZE_MB = 500;

const SUPPORTED_URL_PATTERNS = [
  /youtube\.com\/watch/,
  /youtu\.be\//,
  /tiktok\.com\//,
  /instagram\.com\/(p|reel|reels)\//,
  /x\.com\/.*\/status\//,
  /twitter\.com\/.*\/status\//,
  /facebook\.com\/.*\/videos\//,
  /fb\.watch\//,
];

function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return VIDEO_EXTENSIONS.includes(ext);
}

function looksLikeVideoUrl(url: string): boolean {
  try {
    new URL(url);
  } catch {
    return false;
  }
  return SUPPORTED_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput({ onSend, isDisabled, placeholder: customPlaceholder, videoAttachment, onVideoAttach }, ref) {
    const [text, setText] = useState("");
    const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const [linkError, setLinkError] = useState<string | null>(null);
    const [isFetchingLink, setIsFetchingLink] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { selectedTeam } = useTeams();
    const [sceneRef, setSceneRef] = useAtom(sceneRefAtom);

    useEffect(() => {
      if (sceneRef) {
        setText((prev) => sceneRef + prev);
        setSceneRef(null);
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    }, [sceneRef, setSceneRef]);

    const hasContent = text.trim().length > 0;
    const hasAttachments = attachments.length > 0;
    const hasVideo = !!videoAttachment;
    const supportsVideo = !!onVideoAttach;
    const videoState = useAtomValue(videoStateAtom);
    const hasScript = !!videoState.scriptId;
    const mentionMatch = videoState.scriptId ? text.match(/@(\S*)$/) : null;
    const showMentions = !!mentionMatch;
    const mentionQuery = mentionMatch?.[1] ?? "";

    const handleImageFiles = useCallback(
      async (files: FileList | File[]) => {
        if (!selectedTeam) return;
        const teamId = selectedTeam.id;
        const imageFiles = Array.from(files)
          .filter((f) => !isVideoFile(f))
          .slice(0, 5 - attachments.length);
        if (imageFiles.length === 0) return;

        const placeholders: ChatAttachment[] = imageFiles.map((file) => ({
          key: `pending-${Date.now()}-${file.name}`,
          url: URL.createObjectURL(file),
          file,
          uploading: true,
        }));
        setAttachments((prev) => [...prev, ...placeholders].slice(0, 5));
        setIsUploading(true);

        await Promise.all(
          placeholders.map(async (placeholder) => {
            try {
              const result = await ugcScriptAPI.uploadImage(teamId, placeholder.file!);
              setAttachments((prev) =>
                prev.map((att) =>
                  att.key === placeholder.key
                    ? { key: result.key, url: result.url, file: placeholder.file, uploading: false }
                    : att,
                ),
              );
            } catch (err) {
              console.error("Upload failed:", err);
              setAttachments((prev) => prev.filter((att) => att.key !== placeholder.key));
            }
          }),
        );
        setIsUploading(false);
      },
      [selectedTeam, attachments.length],
    );

    const handleVideoFile = useCallback(
      (file: File) => {
        if (!onVideoAttach) return;
        if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
          alert(`Video must be under ${MAX_VIDEO_SIZE_MB}MB`);
          return;
        }
        onVideoAttach({ file, name: file.name, size: file.size, preview: URL.createObjectURL(file) });
      },
      [onVideoAttach],
    );

    const handleLinkSubmit = useCallback(async () => {
      if (!onVideoAttach) return;
      const url = linkUrl.trim();
      if (!url) return;
      setLinkError(null);

      if (!looksLikeVideoUrl(url)) {
        setLinkError("Paste a YouTube, TikTok, Instagram, or X link");
        return;
      }

      setIsFetchingLink(true);
      try {
        const info = await videoAPI.getVideoInfo(url);
        onVideoAttach({
          url,
          name: info.title || url,
          size: info.filesize || undefined,
        });
        setLinkUrl("");
      } catch (err) {
        setLinkError(err instanceof Error ? err.message : "Could not fetch video info");
      } finally {
        setIsFetchingLink(false);
      }
    }, [linkUrl, onVideoAttach]);

    const handleFiles = useCallback(
      (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const videoFile = fileArray.find(isVideoFile);
        const imageFiles = fileArray.filter((f) => !isVideoFile(f));

        if (videoFile && !hasVideo && onVideoAttach) {
          handleVideoFile(videoFile);
        }
        if (imageFiles.length > 0) {
          handleImageFiles(imageFiles);
        }
      },
      [hasVideo, onVideoAttach, handleVideoFile, handleImageFiles],
    );

    useImperativeHandle(ref, () => ({
      addFiles: (files: File[]) => handleFiles(files),
    }), [handleFiles]);

    const removeAttachment = (index: number) => {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const removeVideo = () => {
      if (videoAttachment?.preview) {
        URL.revokeObjectURL(videoAttachment.preview);
      }
      onVideoAttach?.(null);
    };

    const handleSubmit = () => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const ready = attachments.filter((a) => !a.uploading);
      onSend(trimmed, ready);
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
      <div className="px-4 pb-4 pt-2 space-y-3">
        <div className="max-w-2xl mx-auto space-y-3 relative">
          <AnimatePresence>
            {showMentions && (
              <SceneMentionDropdown
                query={mentionQuery}
                onSelect={(mention) => {
                  setText((prev) => prev.replace(/@\S*$/, mention));
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
              />
            )}
          </AnimatePresence>

          {supportsVideo && !hasScript && (
            <AnimatePresence mode="wait">
              {hasVideo ? (
                <motion.div
                  key="video-preview"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-3 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0">
                    <Icon
                      icon={videoAttachment!.url ? "solar:link-round-bold-duotone" : "solar:videocamera-record-bold-duotone"}
                      width={20}
                      className="text-amber-400"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {videoAttachment!.name}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {videoAttachment!.url
                        ? "Link ready — will download on send"
                        : `${((videoAttachment!.size ?? 0) / (1024 * 1024)).toFixed(1)}MB — Ready to analyze`}
                    </p>
                  </div>
                  <Button
                    isIconOnly
                    variant="tertiary"
                    size="sm"
                    onPress={removeVideo}
                    isDisabled={isDisabled}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Icon icon="solar:trash-bin-minimalistic-bold" width={16} />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="upload-zone"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-2"
                >
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoFile(file);
                      e.target.value = "";
                    }}
                  />

                  <div
                    onClick={() => !(isDisabled || isFetchingLink) && videoInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = Array.from(e.dataTransfer.files).find(isVideoFile);
                      if (file) handleVideoFile(file);
                    }}
                    className={[
                      "w-full rounded-2xl border-2 border-dashed transition-all duration-200 p-3 flex items-center gap-3 cursor-pointer",
                      isDragOver
                        ? "border-amber-400 bg-amber-400/10"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-amber-400/40 hover:bg-amber-400/5",
                      (isDisabled || isFetchingLink) ? "opacity-40 pointer-events-none" : "",
                    ].join(" ")}
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
                      <Icon icon="solar:upload-minimalistic-bold-duotone" width={20} className="text-amber-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-text-primary">Upload reference ad</p>
                      <p className="text-[11px] text-text-muted">MP4, MOV, WebM up to {MAX_VIDEO_SIZE_MB}MB</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-2">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-[11px] text-text-muted/50 font-medium">or paste a link</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>

                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Icon icon="solar:link-round-bold" width={16} className="text-text-muted" />
                    </div>
                    <Input
                      onChange={(e) => { setLinkUrl(e.target.value); setLinkError(null); }}
                      value={linkUrl}
                      placeholder="YouTube, TikTok, Instagram, or X link"
                      disabled={!!(isDisabled || isFetchingLink)}
                      className="w-full bg-transparent border border-white/[0.08] rounded-xl pl-9 pr-12 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-amber-500/50 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleLinkSubmit();
                        }
                      }}
                    />
                    <Button
                      isIconOnly
                      variant="tertiary"
                      size="sm"
                      onPress={handleLinkSubmit}
                      isDisabled={!linkUrl.trim() || isDisabled || isFetchingLink}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center transition-all hover:brightness-110"
                    >
                      {isFetchingLink ? (
                        <Icon icon="svg-spinners:ring-resize" width={14} />
                      ) : (
                        <Icon icon="solar:play-bold" width={14} />
                      )}
                    </Button>
                    {linkError && <p className="text-xs text-red-500 mt-1">{linkError}</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm overflow-hidden shadow-xl shadow-black/10 transition-all duration-300 focus-within:border-accent-400/30 focus-within:shadow-accent-400/5 focus-within:shadow-2xl">
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
                          className={`w-14 h-14 rounded-xl object-cover ring-1 ring-white/10 transition-opacity ${att.uploading ? "opacity-40" : "opacity-100"}`}
                        />
                        {att.uploading && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                            <Icon icon="solar:loading-circle-bold" width={20} className="animate-spin text-white" />
                          </div>
                        )}
                        {!att.uploading && (
                          <Button
                            isIconOnly
                            variant="tertiary"
                            size="sm"
                            onPress={() => removeAttachment(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/90 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 scale-75 group-hover:scale-100 shadow-lg shadow-red-500/20"
                          >
                            <Icon icon="solar:close-circle-bold" width={14} />
                          </Button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-1.5 p-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleImageFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              <Button
                isIconOnly
                variant="tertiary"
                size="sm"
                onPress={() => fileInputRef.current?.click()}
                isDisabled={isDisabled || isUploading || attachments.length >= 5}
                className="shrink-0 mb-0.5 w-8 h-8 rounded-xl flex items-center justify-center text-text-muted hover:text-accent-400 hover:bg-accent-400/10 transition-all duration-200"
                title="Upload product images"
              >
                <Icon icon="solar:gallery-minimalistic-bold-duotone" width={20} />
              </Button>

              <div className="flex-1 relative">
                {text && /@scene \d/i.test(text) && (
                  <div
                    aria-hidden
                    className="absolute inset-0 pointer-events-none text-sm leading-relaxed whitespace-pre-wrap break-words px-3 py-2 text-transparent"
                  >
                    {text.split(/(@[Ss]cene \d+(?: [Ss]hot \d+)?)/g).map((part, i) =>
                      /@scene \d/i.test(part) ? (
                        <span key={i} className="bg-accent-400/40 border border-accent-400/50 rounded px-0.5">{part}</span>
                      ) : (
                        <span key={i}>{part}</span>
                      ),
                    )}
                  </div>
                )}
                <TextArea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={customPlaceholder || (hasVideo ? "Describe your product and any creative direction..." : "Describe the video you want to make, or attach a video to clone...")}
                  rows={1}
                  disabled={isDisabled}
                  className="w-full bg-transparent border-none outline-none resize-none text-sm text-text-primary placeholder:text-text-muted leading-relaxed px-3 py-2 max-h-32"
                />
              </div>

              <motion.div
                className="shrink-0 mb-0.5"
                whileTap={hasContent && !isDisabled ? { scale: 0.9 } : {}}
              >
                <Button
                  isIconOnly
                  variant="tertiary"
                  size="sm"
                  onPress={handleSubmit}
                  isDisabled={isDisabled || !hasContent}
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
                </Button>
              </motion.div>
            </div>
          </div>

          <p className="text-[11px] text-text-muted/40 text-center">
            Attach product images for better results
          </p>
        </div>
      </div>
    );
  },
);
