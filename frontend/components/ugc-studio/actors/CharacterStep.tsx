"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs,
  Card,
  Spinner,
  Button,
  Dropdown } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useTeams } from "@/hooks/useTeams";
import { actorsAPI } from "@/api/actors";
import { CharacterGrid } from "./CharacterGrid";
import { CreateCharacterFlow } from "./CreateCharacterFlow";
import { VariationModal } from "./VariationModal";
import { CharacterDetailModal } from "./CharacterDetailModal";
import type { Character, CharacterSource } from "./types";

const PAGE_SIZE = 12;

interface CharacterStepProps {
  selectedCharacter: Character | null;
  onCharacterSelect: (character: Character | null) => void;
  onContinue?: () => void;
  showCreateTab?: boolean;
}

export function CharacterStep({
  selectedCharacter,
  onCharacterSelect,
  onContinue,
  showCreateTab = false,
}: CharacterStepProps) {
  const { selectedTeam, isLoading: teamsLoading } = useTeams();
  const [activeTab, setActiveTab] = useState<CharacterSource>(showCreateTab ? "create-new" : "my-actors");
  const [myActors, setMyActors] = useState<Character[]>([]);
  const [communityActors, setCommunityActors] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myActorsSort, setMyActorsSort] = useState<"recent" | "popular">(
    "recent"
  );
  const [communitySort, setCommunitySort] = useState<"recent" | "popular">(
    "popular"
  );
  const [myActorsTotal, setMyActorsTotal] = useState(0);
  const [communityTotal, setCommunityTotal] = useState(0);
  const [variationCharacter, setVariationCharacter] =
    useState<Character | null>(null);
  const [detailCharacter, setDetailCharacter] = useState<Character | null>(
    null
  );

  const teamId = selectedTeam?.id ?? null;
  const mainActors = myActors.filter(
    (c) => !c.is_variation && !c.parent_character_id
  );

  const loadMyActors = useCallback(
    async (reset = true) => {
      if (!teamId) return;
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
    if (teamId && activeTab === "my-actors") {
      loadMyActors(true);
    } else if (activeTab === "community") {
      loadCommunityActors(true);
    }
  }, [teamId, activeTab, myActorsSort, communitySort]);

  const handleCharacterCreated = async (character: Character) => {
    try {
      const { character: fullCharacter } = await actorsAPI.getById(
        character.id
      );
      setMyActors((prev) => [fullCharacter, ...prev]);
      onCharacterSelect(fullCharacter);
    } catch {
      setMyActors((prev) => [character, ...prev]);
      onCharacterSelect(character);
    }
    setActiveTab("my-actors");
  };

  const handleVariationCreated = async (character: Character) => {
    setVariationCharacter(null);
    try {
      const { character: fullCharacter } = await actorsAPI.getById(
        character.id
      );
      setMyActors((prev) => [fullCharacter, ...prev]);
      onCharacterSelect(fullCharacter);
    } catch {
      setMyActors((prev) => [character, ...prev]);
      onCharacterSelect(character);
    }
    setActiveTab("my-actors");
  };

  const handleShareToggle = (updatedCharacter: Character) => {
    setMyActors((prev) =>
      prev.map((char) =>
        char.id === updatedCharacter.id ? updatedCharacter : char
      )
    );
  };

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" color="accent" />
      </div>
    );
  }

  if (!teamId) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <Card.Content className="py-16 flex flex-col items-center justify-center text-center">
          <Icon
            icon="solar:danger-triangle-bold-duotone"
            className="text-amber-400 mb-4"
            width={48}
          />
          <h3 className="text-lg font-semibold text-text-accent mb-2">
            No Team Selected
          </h3>
          <p className="text-text-secondary text-sm">
            Please select a team to continue
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center mb-4 sm:mb-6 px-2">
        <h2 className="text-xl sm:text-2xl font-bold text-text-accent mb-1 sm:mb-2">
          Choose Your Actor
        </h2>
        <p className="text-text-secondary text-sm sm:text-base">
          Create a new AI actor or select from your library
        </p>
      </div>

      {selectedCharacter && (
        <Card className="bg-gradient-to-r from-accent-400/10 to-purple-500/10 border border-accent-400/30 mb-6">
          <Card.Content className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-20 sm:w-20 sm:h-24 rounded-xl overflow-hidden bg-surface-elevated shrink-0">
                {selectedCharacter.primaryImageUrl ||
                selectedCharacter.imageUrls?.[
                  selectedCharacter.primary_image_index || 0
                ] ? (
                  <img
                    src={
                      selectedCharacter.primaryImageUrl ||
                      selectedCharacter.imageUrls?.[
                        selectedCharacter.primary_image_index || 0
                      ]
                    }
                    alt={selectedCharacter.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon
                      icon="solar:user-circle-bold-duotone"
                      className="text-text-muted"
                      width={32}
                    />
                  </div>
                )}
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent-400 flex items-center justify-center">
                  <Icon
                    icon="solar:check-circle-bold"
                    className="text-white"
                    width={12}
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-text-accent truncate">
                    {selectedCharacter.name}
                  </h3>
                  {selectedCharacter.is_variation && (
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                      Variation
                    </span>
                  )}
                </div>
                {selectedCharacter.gender && (
                  <p className="text-sm text-text-secondary capitalize">
                    {selectedCharacter.gender} • {selectedCharacter.age_range}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
 variant="outline"
 size="sm"
 className="border-border-base text-text-secondary"
 onPress={() => onCharacterSelect(null)}
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
          </Card.Content>
        </Card>
      )}

      <Tabs
 selectedKey={activeTab}
 onSelectionChange={(key) => setActiveTab(key as CharacterSource)}
 >
        <Tab
          key="create-new"
          title={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Icon
                icon="solar:magic-stick-3-bold-duotone"
                className="w-4 h-4 sm:w-[18px] sm:h-[18px]"
              />
              <span className="hidden xs:inline sm:inline">Create New</span>
            </div>
          }
        >
          <div className="pt-6 sm:pt-8">
            <CreateCharacterFlow
              teamId={teamId}
              onCharacterCreated={handleCharacterCreated}
            />
          </div>
        </Tab>

        <Tab
          key="my-actors"
          title={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Icon
                icon="solar:user-circle-bold-duotone"
                className="w-4 h-4 sm:w-[18px] sm:h-[18px]"
              />
              <span className="hidden sm:inline">My Actors</span>
              <span className="sm:hidden">Mine</span>
              {myActorsTotal > 0 && (
                <span className="text-[10px] sm:text-xs bg-white/20 px-1 sm:px-1.5 py-0.5 rounded-full">
                  {myActorsTotal}
                </span>
              )}
            </div>
          }
        >
          <div className="pt-6 sm:pt-8 space-y-4 sm:space-y-6">
            {mainActors.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-text-secondary">
                  {mainActors.length} actors
                </div>
                <Dropdown>
<Button
 variant="outline"
 size="sm"
 className="border-border-base w-full sm:w-auto"
 >
                      <Icon icon="solar:sort-bold" width={16} />
                      {myActorsSort === "recent" ? "Recent" : "Popular"}
                    </Button>
<Dropdown.Popover>

<Dropdown.Menu
                    selectedKeys={[myActorsSort]}
                    selectionMode="single"
                    onSelectionChange={(keys) =>
                      setMyActorsSort(
                        Array.from(keys)[0] as "recent" | "popular"
                      )
                    }
                  >
                    <Dropdown.Item
                      key="recent"
                      startContent={
                        <Icon icon="solar:clock-circle-bold" width={16} />
                      }
                    >
                      Recent
                    </Dropdown.Item>
                    <Dropdown.Item
                      key="popular"
                      startContent={<Icon icon="solar:fire-bold" width={16} />}
                    >
                      Popular
                    </Dropdown.Item>
                  </Dropdown.Menu>
</Dropdown.Popover>
                </Dropdown>
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size="lg" color="accent" />
              </div>
            ) : mainActors.length > 0 ? (
              <>
                <CharacterGrid
                  characters={mainActors}
                  selectedId={selectedCharacter?.id}
                  onSelect={(char) => setDetailCharacter(char)}
                  showShareToggle
                  onShareToggle={handleShareToggle}
                />
                {myActors.length < myActorsTotal && (
                  <div className="flex justify-center pt-4">
                    <Button
 variant="outline"
 className="border-border-base"
 onPress={() => loadMyActors(false)}
 isPending={loadingMore}
 >
                      Load More
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Card className="bg-gradient-to-br from-surface-elevated to-surface-base border border-border-base border-dashed">
                <Card.Content className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-2xl bg-accent-400/10 flex items-center justify-center mb-6">
                    <Icon
                      icon="solar:user-plus-bold-duotone"
                      className="text-accent-400"
                      width={40}
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-text-accent mb-2">
                    No actors yet
                  </h3>
                  <p className="text-text-secondary text-sm mb-6 max-w-sm">
                    Create your first AI actor to start making amazing UGC ads
                  </p>
                  <Button
 className="bg-accent-400 text-white font-semibold"
 onPress={() => setActiveTab("create-new")}
 >
                    <Icon icon="solar:magic-stick-3-bold" width={18} />
                    Create Your First Actor
                  </Button>
                </Card.Content>
              </Card>
            )}
          </div>
        </Tab>

        <Tab
          key="community"
          title={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Icon
                icon="solar:users-group-rounded-bold-duotone"
                className="w-4 h-4 sm:w-[18px] sm:h-[18px]"
              />
              <span className="hidden sm:inline">Community</span>
              <span className="sm:hidden">Public</span>
              {communityTotal > 0 && (
                <span className="text-[10px] sm:text-xs bg-white/20 px-1 sm:px-1.5 py-0.5 rounded-full">
                  {communityTotal}
                </span>
              )}
            </div>
          }
        >
          <div className="pt-6 sm:pt-8 space-y-4 sm:space-y-6">
            {communityActors.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-text-secondary">
                  Showing {communityActors.length} of {communityTotal} community
                  actors
                </div>
                <Dropdown>
<Button
 variant="outline"
 size="sm"
 className="border-border-base w-full sm:w-auto"
 >
                      <Icon icon="solar:sort-bold" width={16} />
                      {communitySort === "recent" ? "Recent" : "Popular"}
                    </Button>
<Dropdown.Popover>

<Dropdown.Menu
                    selectedKeys={[communitySort]}
                    selectionMode="single"
                    onSelectionChange={(keys) =>
                      setCommunitySort(
                        Array.from(keys)[0] as "recent" | "popular"
                      )
                    }
                  >
                    <Dropdown.Item
                      key="popular"
                      startContent={<Icon icon="solar:fire-bold" width={16} />}
                    >
                      Popular
                    </Dropdown.Item>
                    <Dropdown.Item
                      key="recent"
                      startContent={
                        <Icon icon="solar:clock-circle-bold" width={16} />
                      }
                    >
                      Recent
                    </Dropdown.Item>
                  </Dropdown.Menu>
</Dropdown.Popover>
                </Dropdown>
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size="lg" color="accent" />
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
 variant="outline"
 className="border-border-base"
 onPress={() => loadCommunityActors(false)}
 isPending={loadingMore}
 >
                      Load More
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Card className="bg-gradient-to-br from-surface-elevated to-surface-base border border-border-base border-dashed">
                <Card.Content className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                    <Icon
                      icon="solar:users-group-rounded-bold-duotone"
                      className="text-purple-400"
                      width={40}
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-text-accent mb-2">
                    No Community Actors Yet
                  </h3>
                  <p className="text-text-secondary text-sm max-w-sm">
                    Be the first to share your actors with the community
                  </p>
                </Card.Content>
              </Card>
            )}
          </div>
        </Tab>
      </Tabs>

      {teamId && (
        <VariationModal
          character={variationCharacter}
          isOpen={!!variationCharacter}
          onClose={() => setVariationCharacter(null)}
          teamId={teamId}
          onVariationCreated={handleVariationCreated}
        />
      )}

      <CharacterDetailModal
        character={detailCharacter}
        isOpen={!!detailCharacter}
        onClose={() => setDetailCharacter(null)}
        allCharacters={[...myActors, ...communityActors]}
        onSelect={(char) => {
          onCharacterSelect(char);
          setDetailCharacter(null);
        }}
        onVariation={(char) => {
          setDetailCharacter(null);
          setVariationCharacter(char);
        }}
      />
    </div>
  );
}
