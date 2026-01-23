"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { Button, Card, CardBody, Spinner, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { ScalePlanRequired } from "@/components/ugc-studio";
import { CreateCharacterFlow } from "@/components/ugc-studio/actors/CreateCharacterFlow";
import { CharacterGrid } from "@/components/ugc-studio/actors/CharacterGrid";
import { CharacterDetailModal } from "@/components/ugc-studio/actors/CharacterDetailModal";
import { VariationModal } from "@/components/ugc-studio/actors/VariationModal";
import { actorsAPI } from "@/api/actors";
import type { Character } from "@/components/ugc-studio/actors/types";
import { useEffect, useCallback } from "react";

const PAGE_SIZE = 12;

export default function CharactersPage() {
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [activeTab, setActiveTab] = useState<"create" | "my-actors">("my-actors");
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
          sort: "recent",
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

  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return <ScalePlanRequired currentPlan={selectedTeam?.plan || "free"} />;
  }

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.push("/dashboard/ugc-studio")}
                className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
              >
                <Icon icon="solar:arrow-left-linear" className="text-text-secondary" width={20} />
              </button>
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
          classNames={{
            tabList: "bg-surface-elevated/50 p-1.5 rounded-2xl gap-2 border border-border-base",
            cursor: "bg-accent-400 shadow-lg",
            tab: "px-6 py-2.5 text-text-secondary data-[selected=true]:text-white font-medium rounded-xl transition-all text-sm",
            tabContent: "group-data-[selected=true]:text-white",
          }}
        >
          <Tab
            key="create"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:magic-stick-3-bold-duotone" width={18} />
                <span>Create New</span>
                <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">1 Credit</span>
              </div>
            }
          >
            <div className="pt-8">
              <CreateCharacterFlow
                teamId={teamId!}
                onCharacterCreated={handleCharacterCreated}
              />
            </div>
          </Tab>

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
            <div className="pt-8 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Spinner size="lg" color="primary" />
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
                <Card className="bg-gradient-to-br from-surface-elevated to-surface-base border border-border-base border-dashed">
                  <CardBody className="py-16 flex flex-col items-center justify-center text-center">
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
                      startContent={<Icon icon="solar:magic-stick-3-bold" width={18} />}
                      onPress={() => setActiveTab("create")}
                    >
                      Create Your First Actor
                    </Button>
                  </CardBody>
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
