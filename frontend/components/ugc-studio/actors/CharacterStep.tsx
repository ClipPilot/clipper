"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs,
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
  selectedCharacters?: Character[];
  onCharactersChange?: (characters: Character[]) => void;
  maxSelections?: number;
  onContinue?: () => void;
  showCreateTab?: boolean;
}

export function CharacterStep({
  selectedCharacter,
  onCharacterSelect,
  selectedCharacters = [],
  onCharactersChange,
  maxSelections = 1,
  onContinue,
  showCreateTab = false,
}: CharacterStepProps) {
  const isMultiSelect = maxSelections > 1;
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
      <div className="rounded-xl border border-border-base overflow-hidden bg-surface-base">
        <div className="py-16 flex flex-col items-center justify-center text-center px-6">
          <Icon
            icon="solar:danger-triangle-bold-duotone"
            className="text-amber-400 mb-4"
            width={48}
          />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            No Team Selected
          </h3>
          <p className="text-text-secondary text-sm">
            Please select a team to continue
          </p>
        </div>
      </div>
    );
  }

  const handleMultiSelect = (char: Character) => {
    if (!onCharactersChange) return;
    const alreadySelected = selectedCharacters.find((c) => c.id === char.id);
    if (alreadySelected) {
      onCharactersChange(selectedCharacters.filter((c) => c.id !== char.id));
    } else if (selectedCharacters.length < maxSelections) {
      onCharactersChange([...selectedCharacters, char]);
    }
  };

  const handleDetailSelect = (char: Character) => {
    if (isMultiSelect) {
      handleMultiSelect(char);
    } else {
      onCharacterSelect(char);
    }
    setDetailCharacter(null);
  };

  const multiSelectReady = isMultiSelect && selectedCharacters.length >= 2;
  const singleSelectReady = !isMultiSelect && selectedCharacter;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center mb-4 sm:mb-6 px-2">
        <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-1 sm:mb-2">
          {isMultiSelect ? `Select Up to ${maxSelections} Actors` : "Choose Your Actor"}
        </h2>
        <p className="text-text-secondary text-sm sm:text-base">
          {isMultiSelect
            ? `Pick ${maxSelections} actors for your podcast — each will speak in different scenes`
            : "Create a new AI actor or select from your library"}
        </p>
      </div>

      {isMultiSelect && selectedCharacters.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-accent-400/10 to-purple-500/10 border border-accent-400/30 mb-6">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-secondary font-medium">
                Selected ({selectedCharacters.length}/{maxSelections})
              </span>
              {onContinue && multiSelectReady && (
                <Button
                  className="bg-accent-400 text-white font-semibold"
                  size="sm"
                  endContent={<Icon icon="solar:arrow-right-bold" width={18} />}
                  onPress={onContinue}
                >
                  Continue
                </Button>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              {selectedCharacters.map((char, idx) => (
                <div key={char.id} className="flex items-center gap-2 bg-surface-elevated rounded-xl p-2 pr-3">
                  <div className="relative w-10 h-12 rounded-lg overflow-hidden bg-surface-base shrink-0">
                    {(char.primaryImageUrl || char.imageUrls?.[char.primary_image_index || 0]) ? (
                      <img
                        src={char.primaryImageUrl || char.imageUrls?.[char.primary_image_index || 0]}
                        alt={char.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon icon="solar:user-circle-bold-duotone" className="text-text-muted" width={20} />
                      </div>
                    )}
                    <div className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-accent-400 flex items-center justify-center text-[10px] text-white font-bold">
                      {idx + 1}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-text-primary truncate max-w-[100px]">{char.name}</span>
                  <button
                    className="ml-1 text-text-muted hover:text-red-400 transition-colors"
                    onClick={() => onCharactersChange?.(selectedCharacters.filter((c) => c.id !== char.id))}
                  >
                    <Icon icon="solar:close-circle-bold" width={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isMultiSelect && selectedCharacter && (
        <div className="rounded-xl bg-gradient-to-r from-accent-400/10 to-purple-500/10 border border-accent-400/30 mb-6">
          <div className="p-4">
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
                  <h3 className="text-lg font-semibold text-text-primary truncate">
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
          </div>
        </div>
      )}

      <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as CharacterSource)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Character source">
            <Tabs.Tab id="create-new">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Icon icon="solar:magic-stick-3-bold-duotone" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <span>Create New</span>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="my-actors">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Icon icon="solar:user-circle-bold-duotone" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <span>My Actors</span>
                {myActorsTotal > 0 && (
                  <span className="text-[10px] sm:text-xs bg-white/20 px-1 sm:px-1.5 py-0.5 rounded-full">{myActorsTotal}</span>
                )}
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="community">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Icon icon="solar:users-group-rounded-bold-duotone" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <span>Community</span>
                {communityTotal > 0 && (
                  <span className="text-[10px] sm:text-xs bg-white/20 px-1 sm:px-1.5 py-0.5 rounded-full">{communityTotal}</span>
                )}
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="create-new">
          <div className="pt-6 sm:pt-8">
            <CreateCharacterFlow teamId={teamId} onCharacterCreated={handleCharacterCreated} />
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="my-actors">
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
                    <Dropdown.Item key="recent">
                      <Icon icon="solar:clock-circle-bold" width={16} />
                      Recent
                    </Dropdown.Item>
                    <Dropdown.Item key="popular">
                      <Icon icon="solar:fire-bold" width={16} />
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
                  selectedId={isMultiSelect ? undefined : selectedCharacter?.id}
                  selectedIds={isMultiSelect ? selectedCharacters.map((c) => c.id) : undefined}
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
              <div className="rounded-xl border border-border-base border-dashed overflow-hidden bg-gradient-to-br from-surface-elevated to-surface-base">
                <div className="py-16 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-20 h-20 rounded-2xl bg-accent-400/10 flex items-center justify-center mb-6">
                    <Icon
                      icon="solar:user-plus-bold-duotone"
                      className="text-accent-400"
                      width={40}
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary mb-2">
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
                </div>
              </div>
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="community">
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
                    <Dropdown.Item key="popular">
                      <Icon icon="solar:fire-bold" width={16} />
                      Popular
                    </Dropdown.Item>
                    <Dropdown.Item key="recent">
                      <Icon icon="solar:clock-circle-bold" width={16} />
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
                  selectedId={isMultiSelect ? undefined : selectedCharacter?.id}
                  selectedIds={isMultiSelect ? selectedCharacters.map((c) => c.id) : undefined}
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
              <div className="rounded-xl border border-border-base border-dashed overflow-hidden bg-gradient-to-br from-surface-elevated to-surface-base">
                <div className="py-16 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                    <Icon
                      icon="solar:users-group-rounded-bold-duotone"
                      className="text-purple-400"
                      width={40}
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary mb-2">
                    No Community Actors Yet
                  </h3>
                  <p className="text-text-secondary text-sm max-w-sm">
                    Be the first to share your actors with the community
                  </p>
                </div>
              </div>
            )}
          </div>
        </Tabs.Panel>
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
        onSelect={handleDetailSelect}
        onVariation={(char) => {
          setDetailCharacter(null);
          setVariationCharacter(char);
        }}
      />
    </div>
  );
}
