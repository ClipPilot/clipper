"use client";

import { useAtom } from "jotai";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedVoiceAtom } from "@/store/ugc";
import { VoiceSelector } from "./VoiceSelector";

interface AudioStepProps {
  onContinue?: () => void;
  teamId?: number;
}

export function AudioStep({ onContinue, teamId }: AudioStepProps) {
  const [selectedVoice, setSelectedVoice] = useAtom(selectedVoiceAtom);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
          Choose a Voice
        </h2>
        <p className="text-text-secondary text-sm sm:text-base">
          Select the AI voice that will narrate your video
        </p>
      </div>

      {selectedVoice && (
        <div className="rounded-xl bg-gradient-to-r from-accent-400/10 to-purple-500/10 border border-accent-400/30 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent-400/20 flex items-center justify-center shrink-0">
                <Icon icon="solar:microphone-3-bold-duotone" className="text-accent-400" width={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-lg font-semibold text-text-primary">{selectedVoice.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedVoice.gender === "male"
                      ? "bg-blue-500/20 text-blue-500"
                      : "bg-pink-500/20 text-pink-500"
                  }`}>
                    {selectedVoice.gender}
                  </span>
                </div>
                <p className="text-sm text-text-secondary">{selectedVoice.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
 variant="outline"
 size="sm"
 className="border-border-base text-text-secondary"
 onPress={() => setSelectedVoice(null)}
 >
                  Change
                </Button>
                {onContinue && (
                  <Button
 className="bg-accent-400 text-white font-semibold"
 onPress={onContinue}
 >
                    Continue
                    <Icon icon="solar:arrow-right-bold" width={18} />
</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <VoiceSelector selectedVoice={selectedVoice} onVoiceChange={setSelectedVoice} teamId={teamId} />
    </div>
  );
}
