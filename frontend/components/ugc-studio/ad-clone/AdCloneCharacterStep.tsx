"use client";

import { useState, useEffect, useCallback } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  Card,
  CardBody,
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
import { adCloneCharacterIdAtom, adCloneVoiceIdAtom } from "@/store/adClone";
import type { Character } from "../actors/types";

const PAGE_SIZE = 12;

interface AdCloneCharacterStepProps {
  teamId: number;
}

export function AdCloneCharacterStep({ teamId }: AdCloneCharacterStepProps) {
  const [characterId, setCharacterId] = useAtom(adCloneCharacterIdAtom);
  const setVoiceId = useSetAtom(adCloneVoiceIdAtom);

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

  const mainActors = myActors.filter((c) => !c.is_variation && !c.parent_character_id);

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

  const handleCharacterSelect = (character: Character | null) => {
    setSelectedCharacter(character);
    setCharacterId(character?.id ?? null);
    setVoiceId(null);
    setDetailCharacter(null);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Choose Your Actor
        </h2>
        <p className="text-text-secondary text-sm">
          Select the AI actor who will appear in your cloned ad
        </p>
      </div>

      {selectedCharacter && (
        <Card className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30">
          <CardBody className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-surface-elevated shrink-0">
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
                    <Icon icon="solar:user-circle-bold-duotone" className="text-text-muted" width={32} />
                  </div>
                )}
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Icon icon="solar:check-circle-bold" className="text-white" width={12} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-text-primary truncate">
                  {selectedCharacter.name}
                </h3>
                {selectedCharacter.gender && (
                  <p className="text-sm text-text-secondary capitalize">
                    {selectedCharacter.gender} • {selectedCharacter.age_range}
                  </p>
                )}
              </div>
              <Button
                variant="bordered"
                size="sm"
                className="border-border-base text-text-secondary"
                onPress={() => handleCharacterSelect(null)}
              >
                Change
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

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
          <div className="pt-6 space-y-4">
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
              <div className="flex items-center justify-center py-20">
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
                <CardBody className="py-12 text-center">
                  <Icon icon="solar:user-plus-bold-duotone" className="text-text-muted mx-auto mb-4" width={48} />
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    No actors yet
                  </h3>
                  <p className="text-text-secondary text-sm">
                    Create actors in the UGC Studio to use them here
                  </p>
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
          <div className="pt-6 space-y-4">
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
              <div className="flex items-center justify-center py-20">
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

      <CharacterDetailModal
        character={detailCharacter}
        isOpen={!!detailCharacter}
        onClose={() => setDetailCharacter(null)}
        allCharacters={[...myActors, ...communityActors]}
        onSelect={handleCharacterSelect}
      />
    </div>
  );
}
