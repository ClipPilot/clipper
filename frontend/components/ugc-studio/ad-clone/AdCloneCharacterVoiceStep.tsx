"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import {
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Button,
  Tabs,
  Tab,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { actorsAPI } from "@/api/actors";
import { CharacterGrid } from "../actors/CharacterGrid";
import { CharacterDetailModal } from "../actors/CharacterDetailModal";
import { useDisclosure } from "@heroui/react";
import { VoiceCard } from "../voice/VoiceCard";
import { VoiceCloneModal } from "../voice/VoiceCloneModal";
import { voicesConfig, type Voice } from "@/config/voicesConfig";
import { voiceCloneAPI, type ClonedVoice } from "@/api/voiceClone";
import { adCloneCharacterIdAtom, adCloneVoiceIdAtom, adCloneProjectIdAtom } from "@/store/adClone";
import type { Character } from "../actors/types";

const PAGE_SIZE = 12;

type GenderFilter = "all" | "male" | "female";

interface AdCloneCharacterVoiceStepProps {
  teamId: number;
  onContinue?: () => void;
  onBack?: () => void;
}

export function AdCloneCharacterVoiceStep({
  teamId,
  onContinue,
  onBack,
}: AdCloneCharacterVoiceStepProps) {
  const router = useRouter();
  const [characterId, setCharacterId] = useAtom(adCloneCharacterIdAtom);
  const [voiceId, setVoiceId] = useAtom(adCloneVoiceIdAtom);
  const projectId = useAtomValue(adCloneProjectIdAtom);

  const createCharacterUrl = `/dashboard/ugc-studio/characters?tab=create&returnTo=${encodeURIComponent(
    `/dashboard/ugc-studio/ad-clone/create${projectId ? `?projectId=${projectId}` : ""}`
  )}`;

  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [activeTab, setActiveTab] = useState<"my-actors" | "community">("my-actors");
  const [myActors, setMyActors] = useState<Character[]>([]);
  const [communityActors, setCommunityActors] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myActorsSort, setMyActorsSort] = useState<"recent" | "popular">("recent");
  const [communitySort, setCommunitySort] = useState<"recent" | "popular">("popular");
  const [myActorsTotal, setMyActorsTotal] = useState(0);
  const [communityTotal, setCommunityTotal] = useState(0);
  const [detailCharacter, setDetailCharacter] = useState<Character | null>(null);

  const [voiceFilter, setVoiceFilter] = useState<GenderFilter>("all");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);
  const { isOpen: isCloneModalOpen, onOpen: openCloneModal, onClose: closeCloneModal } = useDisclosure();

  // Fetch cloned voices
  useEffect(() => {
    if (!teamId) return;
    voiceCloneAPI
      .listClonedVoices(teamId)
      .then((res) =>
        setClonedVoices(
          res.voices.map((cv: ClonedVoice) => ({
            id: cv.voiceId,
            name: cv.name,
            previewFile: cv.previewUrl,
            gender: cv.gender,
            description: "Your cloned voice",
            isCloned: true,
            clonedVoiceDbId: cv.id,
          })),
        ),
      )
      .catch((err) => console.error("Failed to load cloned voices:", err));
  }, [teamId]);

  const refreshClonedVoices = useCallback(() => {
    voiceCloneAPI
      .listClonedVoices(teamId)
      .then((res) =>
        setClonedVoices(
          res.voices.map((cv: ClonedVoice) => ({
            id: cv.voiceId,
            name: cv.name,
            previewFile: cv.previewUrl,
            gender: cv.gender,
            description: "Your cloned voice",
            isCloned: true,
            clonedVoiceDbId: cv.id,
          })),
        ),
      )
      .catch((err) => console.error("Refresh cloned voices failed:", err));
  }, [teamId]);

  const mainActors = myActors.filter((c) => !c.is_variation && !c.parent_character_id);
  const allVoices = [...clonedVoices, ...voicesConfig];
  const filteredVoices = voiceFilter === "all"
    ? allVoices
    : allVoices.filter((v) => v.gender === voiceFilter);
  const selectedVoice = allVoices.find((v) => v.id === voiceId) || null;

  const canContinue = !!characterId && !!voiceId;

  const loadMyActors = useCallback(
    async (reset = true) => {
      if (reset) {
        setLoading(true);
        setMyActors([]);
      } else {
        setLoadingMore(true);
      }
      try {
        const offset = reset ? 0 : myActors.length;
        const response = await actorsAPI.list(teamId, {
          limit: PAGE_SIZE,
          offset,
          sort: myActorsSort,
        });
        if (reset) {
          setMyActors(response.characters);
        } else {
          setMyActors((prev) => [...prev, ...response.characters]);
        }
        setMyActorsTotal(response.total || 0);
      } catch (error) {
        console.error("Failed to load actors:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [teamId, myActorsSort, myActors.length]
  );

  const loadCommunityActors = useCallback(
    async (reset = true) => {
      if (reset) {
        setLoading(true);
        setCommunityActors([]);
      } else {
        setLoadingMore(true);
      }
      try {
        const offset = reset ? 0 : communityActors.length;
        const response = await actorsAPI.listCommunity({
          limit: PAGE_SIZE,
          offset,
          sort: communitySort,
        });
        if (reset) {
          setCommunityActors(response.characters);
        } else {
          setCommunityActors((prev) => [...prev, ...response.characters]);
        }
        setCommunityTotal(response.total || 0);
      } catch (error) {
        console.error("Failed to load community actors:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [communitySort, communityActors.length]
  );

  useEffect(() => {
    if (activeTab === "my-actors") {
      loadMyActors(true);
    } else {
      loadCommunityActors(true);
    }
  }, [teamId, activeTab, myActorsSort, communitySort]);

  useEffect(() => {
    if (characterId && !selectedCharacter) {
      const findCharacter = async () => {
        try {
          const { character } = await actorsAPI.getById(characterId);
          setSelectedCharacter(character);
        } catch {
          setCharacterId(null);
        }
      };
      findCharacter();
    }
  }, [characterId, selectedCharacter, setCharacterId]);

  const handlePlayToggle = useCallback(
    (voice: Voice) => {
      if (playingVoiceId === voice.id) {
        audioRef.current?.pause();
        setPlayingVoiceId(null);
        setPlaybackProgress(0);
        return;
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = voice.previewFile;
        audioRef.current.load();

        audioRef.current
          .play()
          .then(() => {
            setPlayingVoiceId(voice.id);
            setPlaybackProgress(0);
          })
          .catch((err) => {
            console.error("Audio playback failed:", err);
            setPlayingVoiceId(null);
          });
      }
    },
    [playingVoiceId]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setPlayingVoiceId(null);
      setPlaybackProgress(0);
    };
    const handleTimeUpdate = () => {
      if (audio.duration) {
        setPlaybackProgress(audio.currentTime / audio.duration);
      }
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, []);

  const handleCharacterSelect = (character: Character | null) => {
    setSelectedCharacter(character);
    setCharacterId(character?.id ?? null);
    setDetailCharacter(null);
  };

  const handleVoiceSelect = (voice: Voice) => {
    setVoiceId(selectedVoice?.id === voice.id ? null : voice.id);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Character & Voice
        </h2>
        <p className="text-text-secondary text-sm">
          Select who will appear in your cloned ad and their voice
        </p>
      </div>

      {(selectedCharacter || selectedVoice) && (
        <Card className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/30">
          <CardBody className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              {selectedCharacter && (
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <div className="relative w-14 h-18 rounded-xl overflow-hidden bg-surface-elevated shrink-0">
                    {selectedCharacter.primaryImageUrl ||
                    selectedCharacter.imageUrls?.[selectedCharacter.primary_image_index || 0] ? (
                      <img
                        src={
                          selectedCharacter.primaryImageUrl ||
                          selectedCharacter.imageUrls?.[selectedCharacter.primary_image_index || 0]
                        }
                        alt={selectedCharacter.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon icon="solar:user-circle-bold-duotone" className="text-text-muted" width={28} />
                      </div>
                    )}
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <Icon icon="solar:check-circle-bold" className="text-white" width={10} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Actor</p>
                    <h4 className="text-sm font-semibold text-text-primary truncate">
                      {selectedCharacter.name}
                    </h4>
                    {selectedCharacter.gender && (
                      <p className="text-xs text-text-secondary capitalize">
                        {selectedCharacter.gender} • {selectedCharacter.age_range}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedVoice && (
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Icon icon="solar:soundwave-bold-duotone" className="text-purple-400" width={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Voice</p>
                    <h4 className="text-sm font-semibold text-text-primary">
                      {selectedVoice.name}
                    </h4>
                    <p className="text-xs text-text-secondary capitalize">
                      {selectedVoice.gender} • {selectedVoice.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="bg-surface-base border border-border-base">
        <CardHeader className="flex-col items-start gap-3 pb-0">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Icon icon="solar:user-circle-bold-duotone" className="text-orange-500" width={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-text-primary">Choose Actor</h3>
              <p className="text-xs text-text-tertiary">Select the AI actor for your ad</p>
            </div>
            <Button
              size="sm"
              className="bg-orange-500 text-white"
              startContent={<Icon icon="solar:user-plus-bold" width={16} />}
              onPress={() => router.push(createCharacterUrl)}
            >
              Create New
            </Button>
          </div>
        </CardHeader>
        <CardBody className="pt-4">
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as "my-actors" | "community")}
            classNames={{
              tabList: "bg-surface-elevated/50 p-1 rounded-xl gap-1 border border-border-base",
              cursor: "bg-orange-500 shadow-lg",
              tab: "px-4 py-2 text-text-secondary data-[selected=true]:text-white font-medium rounded-lg transition-all text-sm",
              tabContent: "group-data-[selected=true]:text-white",
            }}
            fullWidth
          >
            <Tab
              key="my-actors"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="solar:user-circle-bold-duotone" width={18} />
                  <span>My Actors</span>
                  {myActorsTotal > 0 && (
                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
                      {myActorsTotal}
                    </span>
                  )}
                </div>
              }
            >
              <div className="pt-4 space-y-4">
                {mainActors.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text-secondary">
                      {mainActors.length} actors
                    </div>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="bordered" size="sm" className="border-border-base">
                          <Icon icon="solar:sort-bold" width={16} />
                          {myActorsSort === "recent" ? "Recent" : "Popular"}
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        selectedKeys={[myActorsSort]}
                        selectionMode="single"
                        onSelectionChange={(keys) =>
                          setMyActorsSort(Array.from(keys)[0] as "recent" | "popular")
                        }
                      >
                        <DropdownItem key="recent" startContent={<Icon icon="solar:clock-circle-bold" width={16} />}>
                          Recent
                        </DropdownItem>
                        <DropdownItem key="popular" startContent={<Icon icon="solar:fire-bold" width={16} />}>
                          Popular
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                )}

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" color="warning" />
                  </div>
                ) : mainActors.length > 0 ? (
                  <>
                    <CharacterGrid
                      characters={mainActors}
                      selectedId={selectedCharacter?.id}
                      onSelect={(char) => setDetailCharacter(char)}
                    />
                    {myActors.length < myActorsTotal && (
                      <div className="flex justify-center pt-4">
                        <Button
                          variant="bordered"
                          className="border-border-base"
                          onPress={() => loadMyActors(false)}
                          isLoading={loadingMore}
                        >
                          Load More
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <Card className="bg-surface-elevated border border-border-base border-dashed">
                    <CardBody className="py-12 flex flex-col items-center text-center">
                      <Icon icon="solar:user-plus-bold-duotone" className="text-text-muted mx-auto mb-4" width={48} />
                      <h3 className="text-lg font-semibold text-text-primary mb-2">
                        No actors yet
                      </h3>
                      <p className="text-text-secondary text-sm mb-4">
                        Create your first AI actor to use in your ad
                      </p>
                      <Button
                        className="bg-orange-500 text-white"
                        startContent={<Icon icon="solar:user-plus-bold" width={16} />}
                        onPress={() => router.push(createCharacterUrl)}
                      >
                        Create New Actor
                      </Button>
                    </CardBody>
                  </Card>
                )}
              </div>
            </Tab>

            <Tab
              key="community"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="solar:users-group-rounded-bold-duotone" width={18} />
                  <span>Community</span>
                  {communityTotal > 0 && (
                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
                      {communityTotal}
                    </span>
                  )}
                </div>
              }
            >
              <div className="pt-4 space-y-4">
                {communityActors.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text-secondary">
                      {communityActors.length} of {communityTotal} community actors
                    </div>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="bordered" size="sm" className="border-border-base">
                          <Icon icon="solar:sort-bold" width={16} />
                          {communitySort === "recent" ? "Recent" : "Popular"}
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        selectedKeys={[communitySort]}
                        selectionMode="single"
                        onSelectionChange={(keys) =>
                          setCommunitySort(Array.from(keys)[0] as "recent" | "popular")
                        }
                      >
                        <DropdownItem key="popular" startContent={<Icon icon="solar:fire-bold" width={16} />}>
                          Popular
                        </DropdownItem>
                        <DropdownItem key="recent" startContent={<Icon icon="solar:clock-circle-bold" width={16} />}>
                          Recent
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                )}

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" color="warning" />
                  </div>
                ) : communityActors.length > 0 ? (
                  <>
                    <CharacterGrid
                      characters={communityActors}
                      selectedId={selectedCharacter?.id}
                      onSelect={(char) => setDetailCharacter(char)}
                    />
                    {communityActors.length < communityTotal && (
                      <div className="flex justify-center pt-4">
                        <Button
                          variant="bordered"
                          className="border-border-base"
                          onPress={() => loadCommunityActors(false)}
                          isLoading={loadingMore}
                        >
                          Load More
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <Card className="bg-surface-elevated border border-border-base border-dashed">
                    <CardBody className="py-12 text-center">
                      <Icon icon="solar:users-group-rounded-bold-duotone" className="text-text-muted mx-auto mb-4" width={48} />
                      <h3 className="text-lg font-semibold text-text-primary mb-2">
                        No Community Actors Yet
                      </h3>
                      <p className="text-text-secondary text-sm">
                        Be the first to share actors with the community
                      </p>
                    </CardBody>
                  </Card>
                )}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      <Card className="bg-surface-base border border-border-base">
        <CardHeader className="pb-0 flex-col items-start gap-3">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Icon icon="solar:microphone-3-bold-duotone" className="text-purple-400" width={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-text-primary">Select Voice</h3>
              <p className="text-xs text-text-tertiary">Choose the AI voice for your cloned ad</p>
            </div>
            <Button
              size="sm"
              className="bg-purple-500 text-white"
              startContent={<Icon icon="solar:microphone-3-bold" width={16} />}
              onPress={openCloneModal}
            >
              Clone Your Voice
            </Button>
          </div>
          <Tabs
            selectedKey={voiceFilter}
            onSelectionChange={(key) => setVoiceFilter(key as GenderFilter)}
            size="sm"
            variant="light"
            classNames={{ tabList: "gap-2", tab: "px-3", cursor: "bg-purple-500/20" }}
          >
            <Tab key="all" title="All" />
            <Tab key="male" title="Male" />
            <Tab key="female" title="Female" />
          </Tabs>
        </CardHeader>
        <CardBody className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                isSelected={selectedVoice?.id === voice.id}
                isPlaying={playingVoiceId === voice.id}
                progress={playingVoiceId === voice.id ? playbackProgress : 0}
                onSelect={() => handleVoiceSelect(voice)}
                onPlayToggle={() => handlePlayToggle(voice)}
              />
            ))}
          </div>
          <audio ref={audioRef} className="hidden" preload="none" />
        </CardBody>
      </Card>

      {onContinue && (
        <div className="flex justify-center">
          <Button
            size="lg"
            className="bg-orange-500 text-white font-semibold px-8"
            isDisabled={!canContinue}
            onPress={onContinue}
            endContent={<Icon icon="solar:arrow-right-bold" width={18} />}
          >
            Continue to Storyboard
          </Button>
        </div>
      )}

      <CharacterDetailModal
        character={detailCharacter}
        isOpen={!!detailCharacter}
        onClose={() => setDetailCharacter(null)}
        allCharacters={[...myActors, ...communityActors]}
        onSelect={handleCharacterSelect}
      />

      <VoiceCloneModal
        isOpen={isCloneModalOpen}
        onClose={closeCloneModal}
        teamId={teamId}
        onSuccess={refreshClonedVoices}
      />
    </div>
  );
}
