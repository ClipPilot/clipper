"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAtomValue } from "jotai";
import { Button, Spinner, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import {} from "@/lib/plans";
import { CreateCharacterFlow } from "@/components/ugc-studio/actors/CreateCharacterFlow";
import { CharacterGrid } from "@/components/ugc-studio/actors/CharacterGrid";
import { CharacterDetailModal } from "@/components/ugc-studio/actors/CharacterDetailModal";
import { VariationModal } from "@/components/ugc-studio/actors/VariationModal";
import { actorsAPI } from "@/api/actors";
import type { Character } from "@/components/ugc-studio/actors/types";
import { useEffect, useCallback } from "react";

const PAGE_SIZE = 12;

export default function CharactersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-dark flex items-center justify-center">
          <Spinner size="lg" color="accent" />
        </div>
      }
    >
      <CharactersPageContent />
    </Suspense>
  );
}

function CharactersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const initialTab = searchParams.get("tab") === "create" ? "create" : "my-actors";
  const [activeTab, setActiveTab] = useState<"create" | "my-actors">(initialTab);
  const [myActors, setMyActors] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myActorsTotal, setMyActorsTotal] = useState(0);
  const [detailCharacter, setDetailCharacter] = useState<Character | null>(null);
  const [variationCharacter, setVariationCharacter] = useState<Character | null>(null);

  const teamId = selectedTeam?.id ?? null;
  const mainActors = myActors.filter((c) => !c.is_variation && !c.parent_character_id);

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
          sort: "recent" });
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
    [teamId, myActors.length]
  );

  useEffect(() => {
    if (teamId && activeTab === "my-actors") {
      loadMyActors(true);
    }
  }, [teamId, activeTab]);

  const handleCharacterCreated = async (character: Character) => {
    try {
      const { character: fullCharacter } = await actorsAPI.getById(character.id);
      setMyActors((prev) => [fullCharacter, ...prev]);
    } catch {
      setMyActors((prev) => [character, ...prev]);
    }

    const returnTo = searchParams.get("returnTo");
    if (returnTo) {
      const separator = returnTo.includes("?") ? "&" : "?";
      router.push(`${returnTo}${separator}newCharacterId=${character.id}`);
      return;
    }

    setActiveTab("my-actors");
  };

  const handleVariationCreated = async (character: Character) => {
    setVariationCharacter(null);
    try {
      const { character: fullCharacter } = await actorsAPI.getById(character.id);
      setMyActors((prev) => [fullCharacter, ...prev]);
    } catch {
      setMyActors((prev) => [character, ...prev]);
    }
  };

  const handleShareToggle = (updatedCharacter: Character) => {
    setMyActors((prev) =>
      prev.map((char) =>
        char.id === updatedCharacter.id ? updatedCharacter : char
      )
    );
  };

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button
                isIconOnly
                variant="tertiary"
                size="sm"
                onPress={() => router.push("/dashboard/ugc-studio")}
                className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
              >
                <Icon icon="solar:arrow-left-linear" className="text-text-secondary" width={20} />
              </Button>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Characters</h1>
            </div>
            <p className="text-text-secondary ml-10">
              Create and manage your AI actors for UGC videos
            </p>
          </div>
        </div>

        <Tabs
 selectedKey={activeTab}
 onSelectionChange={(key) => setActiveTab(key as "create" | "my-actors")}
 >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Characters">
              <Tabs.Tab id="create">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:magic-stick-3-bold-duotone" width={18} />
                  <span>Create New</span>
                  <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">1 Credit</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="my-actors">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:user-circle-bold-duotone" width={18} />
                  <span>My Actors</span>
                  {myActorsTotal > 0 && (
                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
                      {myActorsTotal}
                    </span>
                  )}
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="create">
            <div className="pt-8">
              <CreateCharacterFlow
                teamId={teamId!}
                onCharacterCreated={handleCharacterCreated}
              />
            </div>
          </Tabs.Panel>
          <Tabs.Panel id="my-actors">
            <div className="pt-8 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Spinner size="lg" color="accent" />
                </div>
              ) : mainActors.length > 0 ? (
                <>
                  <div className="text-sm text-text-secondary">
                    {mainActors.length} actors
                  </div>
                  <CharacterGrid
                    characters={mainActors}
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
 onPress={() => setActiveTab("create")}
 >
                      <Icon icon="solar:magic-stick-3-bold" width={18} />
                      Create Your First Actor
                    </Button>
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
          allCharacters={myActors}
          onSelect={() => setDetailCharacter(null)}
          onVariation={(char) => {
            setDetailCharacter(null);
            setVariationCharacter(char);
          }}
        />
      </div>
    </div>
  );
}
