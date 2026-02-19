"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { Button, Spinner, Card, CardBody, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import { Clip, clipsAPI } from "@/api/clips";
import { canAccessMassPosting } from "@/lib/plans";
import { useMassPosting } from "@/hooks/useMassPosting";
import { intakeAPI } from "@/api/intake";
import {
  LoadingView,
  PendingView,
  RejectedView,
} from "@/components/mass-posting/StatusViews";
import { IntakeForm } from "@/components/mass-posting/IntakeForm";
import AdPostingModal from "@/components/clips/AdPostingModal";

const PAGE_SIZE = 20;

export default function PublishPostsPage() {
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const {
    isApproved,
    isPending,
    isRejected,
    applicationStatus,
    isLoading: statusLoading,
    refetch,
  } = useMassPosting();

  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isAppeal, setIsAppeal] = useState(false);

  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [adPostClip, setAdPostClip] = useState<Clip | null>(null);

  useEffect(() => {
    if (isRejected && selectedTeam?.id) {
      intakeAPI
        .getLatestApplication(selectedTeam.id)
        .then(({ application }) => {
          setRejectionReason(application?.rejection_reason ?? null);
        })
        .catch(() => {});
    }
  }, [isRejected, selectedTeam?.id]);

  const fetchClips = useCallback(
    async (offset = 0, append = false) => {
      if (!selectedTeam?.id) return;
      try {
        if (offset === 0) setIsLoading(true);
        else setIsLoadingMore(true);

        const result = await clipsAPI.getCompletedClips(
          selectedTeam.id,
          PAGE_SIZE,
          offset
        );
        const saved = result.clips.filter(
          (c) => c.saved && c.status === "completed"
        );
        setClips((prev) => (append ? [...prev, ...saved] : saved));
        setHasMore(result.hasMore);
      } catch {
        addToast({
          title: "Failed to load clips",
          color: "danger",
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedTeam?.id]
  );

  useEffect(() => {
    if (isApproved) fetchClips();
  }, [isApproved, fetchClips]);

  if (!canAccessMassPosting(selectedTeam?.plan)) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 max-w-sm">
          <div className="relative">
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-accent-400/10">
              <Icon
                icon="solar:posts-carousel-vertical-bold-duotone"
                className="text-accent-400"
                width={40}
              />
            </div>
            <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full bg-surface-dark border-2 border-surface-dark">
              <Icon
                icon="solar:lock-keyhole-bold"
                className="text-text-tertiary"
                width={14}
              />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-text-primary">
              Publish Posts
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Send your clips directly to social platforms with one click.
              Available on Studio plan and above.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full bg-accent-400 text-white font-semibold"
            onPress={() => router.push("/dashboard/pricing")}
            startContent={<Icon icon="solar:rocket-bold" width={18} />}
          >
            Upgrade to Studio
          </Button>
        </div>
      </div>
    );
  }

  if (statusLoading) {
    return <LoadingView />;
  }

  if (isPending && !showForm) {
    return <PendingView status={applicationStatus} />;
  }

  if (isRejected && !showForm) {
    return (
      <RejectedView
        reason={rejectionReason}
        onAppeal={() => {
          setIsAppeal(true);
          setShowForm(true);
        }}
      />
    );
  }

  if (!isApproved) {
    return (
      <IntakeForm
        teamId={selectedTeam?.id ?? null}
        isAppeal={isAppeal}
        onSubmitted={() => {
          setShowForm(false);
          setIsAppeal(false);
          refetch();
        }}
      />
    );
  }

  const getClipThumbnail = (clip: Clip): string | null => {
    return clip.clipUrl || clip.sourceVideoUrl || null;
  };

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Publish Posts
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Select a clip and send it to your connected platforms
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Icon
              icon="solar:video-library-bold-duotone"
              className="text-text-tertiary"
              width={48}
            />
            <p className="text-text-secondary">
              No completed clips yet. Create some clips first!
            </p>
            <Button
              variant="flat"
              onPress={() => router.push("/dashboard/create-clip")}
              startContent={
                <Icon icon="solar:scissors-bold-duotone" width={18} />
              }
            >
              Create Clips
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {clips.map((clip) => {
                const thumbnail = getClipThumbnail(clip);
                return (
                  <Card
                    key={clip.id}
                    className="bg-surface-base border border-border-base hover:border-accent-400/40 transition-colors group"
                    isPressable
                    onPress={() => setAdPostClip(clip)}
                  >
                    <CardBody className="p-0">
                      <div className="relative aspect-[9/16] bg-surface-elevated rounded-t-lg overflow-hidden">
                        {thumbnail ? (
                          <video
                            src={thumbnail}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon
                              icon="solar:video-frame-bold-duotone"
                              className="text-text-tertiary"
                              width={32}
                            />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              className="bg-accent-400 text-white font-semibold"
                              startContent={
                                <Icon icon="mdi:megaphone" width={16} />
                              }
                              onPress={() => setAdPostClip(clip)}
                            >
                              Post
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-medium text-text-primary truncate">
                          {clip.title || `Clip #${clip.id}`}
                        </p>
                        <p className="text-[10px] text-text-tertiary mt-0.5">
                          {new Date(clip.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="flat"
                  isLoading={isLoadingMore}
                  onPress={() => fetchClips(clips.length, true)}
                >
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {adPostClip && (
        <AdPostingModal
          isOpen={!!adPostClip}
          onClose={() => setAdPostClip(null)}
          clip={adPostClip}
        />
      )}
    </div>
  );
}
