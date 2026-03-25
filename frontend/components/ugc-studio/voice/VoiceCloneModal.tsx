"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Modal,
  Button,
  Input,
  Select,
  Spinner, TextField, Label, FieldError } from "@heroui/react";
import { Icon } from "@iconify/react";
import { voiceCloneAPI } from "@/api/voiceClone";

const PARAGRAPHS = [
  "Welcome to Cuttr, the future of AI-powered content creation. With our platform, you can transform any idea into stunning video content in minutes. Whether you're building ads, tutorials, or social media clips, your voice brings it all to life. In today's world, marketing is everything. The brands that win are the ones that show up consistently with content that feels authentic and personal. Cuttr gives you the tools to do exactly that, from AI-generated scripts to face swaps, voice cloning, and automated short-form video editing, all in one place.",
  "Creating engaging content has never been easier. Cuttr helps creators and brands produce professional videos with AI actors, custom scripts, and dynamic scenes. Your unique voice is the final touch that makes every piece of content truly yours. Marketing moves fast, and if you're not putting out content daily, you're falling behind your competitors. That's why we built Cuttr, to help you produce weeks of content in a single session. Clone your voice, swap faces, generate clips from long-form videos, and stay ahead of the curve without burning out.",
  "Imagine having the power to produce studio-quality videos right from your laptop. That's exactly what Cuttr delivers. From scriptwriting to final export, every step is streamlined so you can focus on what matters most, your creative vision and authentic voice. The best marketing doesn't feel like marketing. It feels like a real person talking to you, sharing something valuable. With Cuttr's voice cloning and AI video tools, you can scale that personal connection across hundreds of pieces of content while keeping the human touch that builds trust with your audience.",
  "Great content starts with a great story, and every story deserves a memorable voice. With Cuttr's AI tools, you can clone your voice to narrate videos, create ads, and build a personal brand that stands out in today's crowded digital landscape. Think about it, the top creators and brands aren't just making one video a week. They're everywhere, on every platform, with fresh content every single day. Cuttr makes that possible for anyone. Upload a video, pick your style, and let the AI handle the editing, clipping, and repurposing so you can focus on strategy and storytelling.",
  "The best creators know that authenticity is everything. By cloning your voice with Cuttr, you unlock the ability to scale your content production without losing that personal touch. Record once, and let your AI voice do the rest across all your projects. Marketing in the age of short-form video means you need volume and quality. Cuttr bridges that gap by giving you AI-powered tools that handle the heavy lifting, from finding the best moments in your footage to generating captions, adding hooks, and packaging everything into scroll-stopping clips ready for TikTok, Reels, and Shorts.",
];

type CloneState = "idle" | "recording" | "recorded" | "submitting" | "done";

interface VoiceCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  onSuccess?: () => void;
}

export function VoiceCloneModal({
  isOpen,
  onClose,
  teamId,
  onSuccess,
}: VoiceCloneModalProps) {
  const [state, setState] = useState<CloneState>("idle");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [paragraph] = useState(
    () => PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)],
  );
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount / close
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setState("idle");
      setName("");
      setGender("");
      setError(null);
      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    }
  }, [isOpen]);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("recorded");

        // Stop all mic tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setState("recording");
    } catch (err) {
      console.error("[VoiceClone] Mic access failed:", err);
      setError("Microphone access denied. Please allow mic access and try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleReRecord = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setState("idle");
  };

  const handleSubmit = async () => {
    if (!audioBlob || !name.trim() || !gender) {
      setError("Please fill in all fields and record your voice");
      return;
    }

    setState("submitting");
    setError(null);

    try {
      await voiceCloneAPI.cloneVoice(teamId, name.trim(), gender, audioBlob);
      setState("done");
      onSuccess?.();
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clone voice");
      setState("recorded");
    }
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}><Modal.Container><Modal.Dialog className="sm:max-w-2xl">
        <Modal.Header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Icon
              icon="solar:microphone-3-bold-duotone"
              className="text-purple-400"
              width={22}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-accent">
              Clone Your Voice
            </h3>
            <p className="text-xs text-text-tertiary font-normal">
              Record yourself reading the paragraph below
            </p>
          </div>
        </Modal.Header>
        <Modal.Body className="py-6 space-y-6">
          {/* Paragraph to read */}
          <div className="bg-surface-elevated rounded-xl p-4 border border-border-base">
            <p className="text-xs text-text-muted mb-2 uppercase tracking-wider font-medium">
              Read this aloud:
            </p>
            <p className="text-text-accent text-sm leading-relaxed">
              {paragraph}
            </p>
          </div>

          {/* Recording controls */}
          <div className="flex flex-col items-center gap-4">
            {state === "idle" && (
              <Button
 size="lg"
 className="bg-red-500 text-white font-semibold px-8"
 onPress={startRecording}
 >
                <Icon icon="solar:microphone-3-bold" width={20} />
                Start Recording
              </Button>
            )}

            {state === "recording" && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                    <Icon
                      icon="solar:microphone-3-bold"
                      className="text-white"
                      width={22}
                    />
                  </div>
                </div>
                <p className="text-sm text-red-400 font-medium">
                  Recording...
                </p>
                <Button
 size="md"
 className="bg-surface-elevated text-text-accent"
 onPress={stopRecording}
 >
                  <Icon icon="solar:stop-bold" width={16} />
                  Stop Recording
                </Button>
              </div>
            )}

            {(state === "recorded" || state === "submitting") && audioUrl && (
              <div className="w-full space-y-3">
                <div className="flex items-center gap-3">
                  <audio
                    src={audioUrl}
                    controls
                    className="flex-1 h-10"
                  />
                  <Button
 size="sm"
 variant="outline"
 className="border-border-base"
 onPress={handleReRecord}
 isDisabled={state === "submitting"}
 >
                    Re-record
                  </Button>
                </div>
              </div>
            )}

            {state === "done" && (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Icon
                    icon="solar:check-circle-bold"
                    className="text-green-500"
                    width={32}
                  />
                </div>
                <p className="text-green-500 font-semibold">
                  Voice cloned successfully!
                </p>
              </div>
            )}
          </div>

          {/* Name and gender inputs */}
          {(state === "recorded" || state === "submitting") && (
            <div className="grid grid-cols-2 gap-4">
                            <TextField>
                <Label>Voice Name</Label>
                <Input onChange={(e) => (setName)(e.target.value)}
 placeholder="e.g. My Voice"
 value={name}
 isDisabled={state === "submitting"}
 />
                <FieldError />
              </TextField>
              <Select
 label="Gender"
 placeholder="Select gender"
 selectedKeys={gender ? [gender] : []}
 onSelectionChange={(keys) =>
 setGender(Array.from(keys)[0] as string)
 }
 isDisabled={state === "submitting"}
 >
                <SelectItem key="male">Male</SelectItem>
                <SelectItem key="female">Female</SelectItem>
              </Select>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          {/* Submit button */}
          {state === "recorded" && (
            <div className="flex justify-center">
              <Button
 size="lg"
 className="bg-purple-500 text-white font-semibold px-8"
 onPress={handleSubmit}
 isDisabled={!name.trim() || !gender}
 >
                <Icon icon="solar:upload-minimalistic-bold" width={18} />
                Clone Voice
              </Button>
            </div>
          )}

          {state === "submitting" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <Spinner size="lg" color="current" />
              <p className="text-text-secondary text-sm">
                Cloning your voice... This may take a moment.
              </p>
            </div>
          )}
        </Modal.Body>
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
}
