"use client";

import { useState, useEffect } from "react";
import { Tabs, Tab, Card, CardBody, Spinner, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useTeams } from "@/hooks/useTeams";
import { actorsAPI } from "@/api/actors";
import { CharacterGrid } from "./CharacterGrid";
import { CreateCharacterFlow } from "./CreateCharacterFlow";
import type { Character, CharacterSource } from "./types";

interface CharacterStepProps {
  selectedCharacter: Character | null;
  onCharacterSelect: (character: Character) => void;
}

export function CharacterStep({ selectedCharacter, onCharacterSelect }: CharacterStepProps) {
  const { selectedTeam, isLoading: teamsLoading } = useTeams();
  const [activeTab, setActiveTab] = useState<CharacterSource>("create-new");
  const [myActors, setMyActors] = useState<Character[]>([]);
  const [communityActors, setCommunityActors] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);

  const teamId = selectedTeam?.id ?? null;

  useEffect(() => {
    if (teamId && activeTab === "my-actors") {
      loadMyActors();
    } else if (activeTab === "community") {
      loadCommunityActors();
    }
  }, [teamId, activeTab]);

  const loadMyActors = async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const response = await actorsAPI.list(teamId);
      setMyActors(response.characters);
    } catch (error) {
      console.error("Failed to load actors:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommunityActors = async () => {
    setLoading(true);
    try {
      const response = await actorsAPI.listCommunity();
      setCommunityActors(response.characters);
    } catch (error) {
      console.error("Failed to load community actors:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCharacterCreated = (character: Character) => {
    setMyActors((prev) => [character, ...prev]);
    onCharacterSelect(character);
    setActiveTab("my-actors");
  };

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!teamId) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="py-16 flex flex-col items-center justify-center text-center">
          <Icon icon="solar:danger-triangle-bold-duotone" className="text-amber-400 mb-4" width={48} />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Team Selected</h3>
          <p className="text-text-secondary text-sm">Please select a team to continue</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Choose Your Actor</h2>
        <p className="text-text-secondary">
          Create a new AI actor or select from your library
        </p>
      </div>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as CharacterSource)}
        classNames={{
          tabList: "bg-surface-elevated/50 p-1.5 rounded-2xl gap-2 border border-border-base",
          cursor: "bg-accent-400 shadow-lg",
          tab: "px-6 py-2.5 text-text-secondary data-[selected=true]:text-white font-medium rounded-xl transition-all",
          tabContent: "group-data-[selected=true]:text-white",
        }}
        fullWidth
      >
        <Tab
          key="create-new"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="solar:magic-stick-3-bold-duotone" width={18} />
              <span>Create New</span>
            </div>
          }
        >
          <div className="pt-8">
            <CreateCharacterFlow teamId={teamId} onCharacterCreated={handleCharacterCreated} />
          </div>
        </Tab>

        <Tab
          key="my-actors"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="solar:user-circle-bold-duotone" width={18} />
              <span>My Actors</span>
              {myActors.length > 0 && (
                <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
                  {myActors.length}
                </span>
              )}
            </div>
          }
        >
          <div className="pt-8">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size="lg" color="primary" />
              </div>
            ) : myActors.length > 0 ? (
              <CharacterGrid
                characters={myActors}
                selectedId={selectedCharacter?.id}
                onSelect={onCharacterSelect}
              />
            ) : (
              <Card className="bg-gradient-to-br from-surface-elevated to-surface-base border border-border-base border-dashed">
                <CardBody className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-2xl bg-accent-400/10 flex items-center justify-center mb-6">
                    <Icon icon="solar:user-plus-bold-duotone" className="text-accent-400" width={40} />
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary mb-2">No actors yet</h3>
                  <p className="text-text-secondary text-sm mb-6 max-w-sm">
                    Create your first AI actor to start making amazing UGC ads
                  </p>
                  <Button
                    className="bg-accent-400 text-white font-semibold"
                    startContent={<Icon icon="solar:magic-stick-3-bold" width={18} />}
                    onPress={() => setActiveTab("create-new")}
                  >
                    Create Your First Actor
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
            </div>
          }
        >
          <div className="pt-8">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size="lg" color="primary" />
              </div>
            ) : communityActors.length > 0 ? (
              <CharacterGrid
                characters={communityActors}
                selectedId={selectedCharacter?.id}
                onSelect={onCharacterSelect}
                showVariationButton
              />
            ) : (
              <Card className="bg-gradient-to-br from-surface-elevated to-surface-base border border-border-base border-dashed">
                <CardBody className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                    <Icon icon="solar:users-group-rounded-bold-duotone" className="text-purple-400" width={40} />
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary mb-2">Community Coming Soon</h3>
                  <p className="text-text-secondary text-sm max-w-sm">
                    Be the first to share your actors with the community
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
