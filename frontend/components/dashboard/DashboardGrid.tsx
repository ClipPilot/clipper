"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  Button,
  Progress,
  Chip,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useAtom, useAtomValue } from "jotai";
import { selectedTeamAtom, userTeamsAtom } from "@/store/auth";
import { useUsageStats } from "@/hooks/useUsageStats";
import { clipsAPI, Clip } from "@/api/clips";
import { faceSwapAPI } from "@/api/ugc/faceSwap";
import { ugcVideoAPI, UGCVideoJob } from "@/api/ugc/video";
import type { FaceSwapJob } from "@/components/ugc-studio/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type WidgetId = "credits" | "team" | "processing" | "quickActions" | "recentClips";

interface WidgetConfig {
  id: WidgetId;
  colSpan: string;
}

const DEFAULT_WIDGET_ORDER: WidgetConfig[] = [
  { id: "credits", colSpan: "col-span-12 lg:col-span-4" },
  { id: "team", colSpan: "col-span-12 lg:col-span-4" },
  { id: "processing", colSpan: "col-span-12 lg:col-span-4" },
  { id: "quickActions", colSpan: "col-span-12" },
  { id: "recentClips", colSpan: "col-span-12" },
];

interface SortableWidgetProps {
  id: string;
  colSpan: string;
  children: React.ReactNode;
  isEditMode: boolean;
}

function SortableWidget({ id, colSpan, children, isEditMode }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`${colSpan} relative`}>
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-2 -right-2 z-50 w-8 h-8 rounded-full bg-surface-dark border border-border-base flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg hover:bg-surface-hover transition-colors"
        >
          <Icon icon="solar:move-to-folder-bold" width={16} className="text-text-secondary" />
        </div>
      )}
      {children}
    </div>
  );
}

export function DashboardGrid() {
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useAtom(selectedTeamAtom);
  const userTeams = useAtomValue(userTeamsAtom);
  const { usageStats, isLoading: statsLoading } = useUsageStats(selectedTeam?.id);
  const [recentClips, setRecentClips] = useState<Clip[]>([]);
  const [pendingClips, setPendingClips] = useState<Clip[]>([]);
  const [pendingFaceSwaps, setPendingFaceSwaps] = useState<FaceSwapJob[]>([]);
  const [pendingUGCJobs, setPendingUGCJobs] = useState<UGCVideoJob[]>([]);
  const [clipsLoading, setClipsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<WidgetConfig[]>(DEFAULT_WIDGET_ORDER);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const saved = localStorage.getItem("dashboard_widget_order");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_WIDGET_ORDER.length) {
          setWidgetOrder(parsed);
        }
      } catch (e) {
        console.error("Failed to parse widget order:", e);
      }
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedTeam?.id) {
        setClipsLoading(false);
        return;
      }
      try {
        const [saved, pending, faceSwapJobs, ugcJobs] = await Promise.all([
          clipsAPI.getSavedClips(selectedTeam.id, 6, 0),
          clipsAPI.getPendingClips(selectedTeam.id),
          faceSwapAPI.getTeamJobs(selectedTeam.id).catch(() => ({ jobs: [] })),
          ugcVideoAPI.listVideoJobs(selectedTeam.id, 20, 0).catch(() => ({ jobs: [] })),
        ]);
        setRecentClips(saved.clips);
        setPendingClips(pending);
        // Filter face swap jobs that are still processing
        const activeFaceSwaps = faceSwapJobs.jobs.filter(
          (job) => job.status === "uploading" || job.status === "queued" || job.status === "running"
        );
        setPendingFaceSwaps(activeFaceSwaps);
        // Filter UGC jobs that are still processing
        const activeUGCJobs = ugcJobs.jobs.filter(
          (job) => job.status === "queued" || job.status === "generating"
        );
        setPendingUGCJobs(activeUGCJobs);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setClipsLoading(false);
      }
    };
    loadData();
  }, [selectedTeam?.id]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWidgetOrder((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem("dashboard_widget_order", JSON.stringify(newOrder));
        return newOrder;
      });
    }
  }, []);

  const resetLayout = useCallback(() => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
    localStorage.removeItem("dashboard_widget_order");
  }, []);

  const usagePercent = usageStats
    ? Math.round((usageStats.clipsCreated / usageStats.limit) * 100)
    : 0;

  const getPlanColor = (plan: string) => {
    switch (plan?.toLowerCase()) {
      case "enterprise": return "secondary";
      case "scale": return "success";
      case "studio": return "primary";
      default: return "default";
    }
  };

  const quickActions = [
    { id: "create", label: "Create Clip", description: "From long video", icon: "solar:scissors-bold", href: "/dashboard/create", color: "#4F47E6" },
    { id: "faceswap", label: "Face Swap", description: "Swap faces in video", icon: "solar:face-scan-circle-bold", href: "/dashboard/ugc-studio/face-swap", color: "#EC4899" },
    { id: "aivideo", label: "AI UGC Video", description: "Generate from script", icon: "solar:magic-stick-3-bold", href: "/dashboard/ugc-studio/ai-video-creator", color: "#22C55E" },
    { id: "library", label: "My Library", description: "View saved clips", icon: "solar:folder-bold", href: "/dashboard/clips", color: "#F59E0B" },
  ];

  const renderWidget = (config: WidgetConfig) => {
    switch (config.id) {
      case "credits":
        return (
          <Card className="h-full bg-surface-base border border-border-base">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:wallet-bold" width={20} className="text-[#4F47E6]" />
                  <span className="font-semibold text-text-primary">Credits</span>
                </div>
                <Chip size="sm" color={getPlanColor(selectedTeam?.plan || "free")} variant="flat">
                  {selectedTeam?.plan || "Free"}
                </Chip>
              </div>
              {statsLoading ? (
                <div className="flex justify-center py-4">
                  <Icon icon="solar:spinner-bold" className="animate-spin text-text-tertiary" width={24} />
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-bold text-text-primary">{usageStats?.remaining ?? 0}</span>
                    <span className="text-sm text-text-tertiary">credits left</span>
                  </div>
                  <Progress
                    value={usagePercent}
                    color={usagePercent >= 90 ? "danger" : usagePercent >= 70 ? "warning" : "primary"}
                    size="sm"
                    className="mb-2"
                  />
                  <p className="text-xs text-text-tertiary">{usageStats?.clipsCreated ?? 0} / {usageStats?.limit ?? 0} used this period</p>
                  {selectedTeam?.plan === "free" && (
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      className="w-full mt-4"
                      onPress={() => router.push("/dashboard/pricing")}
                      startContent={<Icon icon="solar:arrow-up-bold" width={14} />}
                    >
                      Upgrade Plan
                    </Button>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        );

      case "team":
        return (
          <Card className="h-full bg-surface-base border border-border-base">
            <CardBody className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Icon icon="solar:users-group-rounded-bold" width={20} className="text-green-500" />
                <span className="font-semibold text-text-primary">Team</span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <Avatar
                  src={selectedTeam?.logo_url}
                  name={selectedTeam?.name?.charAt(0) || "T"}
                  size="lg"
                  classNames={{ base: "bg-surface-hover", name: "text-text-primary font-semibold" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary truncate">{selectedTeam?.name || "No Team"}</p>
                  <p className="text-xs text-text-tertiary capitalize">{selectedTeam?.role || "member"} · {selectedTeam?.type || "personal"}</p>
                </div>
              </div>
              {userTeams.length > 1 && (
                <Dropdown>
                  <DropdownTrigger>
                    <Button size="sm" variant="flat" className="w-full" endContent={<Icon icon="solar:alt-arrow-down-linear" width={14} />}>
                      Switch Team
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Switch team"
                    onAction={(key) => {
                      const team = userTeams.find((t) => t.id.toString() === key);
                      if (team) setSelectedTeam(team);
                    }}
                  >
                    {userTeams.map((team) => (
                      <DropdownItem
                        key={team.id.toString()}
                        startContent={<Avatar src={team.logo_url} name={team.name.charAt(0)} size="sm" className="w-6 h-6" />}
                        className={team.id === selectedTeam?.id ? "bg-surface-hover" : ""}
                      >
                        {team.name}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              )}
            </CardBody>
          </Card>
        );

      case "processing": {
        const totalPending = pendingClips.length + pendingFaceSwaps.length + pendingUGCJobs.length;

        // Combine all pending items into a unified list
        const allPendingItems: Array<{
          id: string;
          title: string;
          status: string;
          type: "clip" | "faceswap" | "ugc";
          icon: string;
          color: string;
          bgColor: string;
        }> = [
          ...pendingClips.map((clip) => ({
            id: `clip-${clip.id}`,
            title: clip.title || `Clip #${clip.id}`,
            status: clip.status,
            type: "clip" as const,
            icon: "solar:scissors-bold",
            color: "text-cyan-500",
            bgColor: "bg-cyan-500/20",
          })),
          ...pendingFaceSwaps.map((job) => ({
            id: `faceswap-${job.id}`,
            title: job.title || `Face Swap`,
            status: job.status === "running" ? `${job.progress || 0}%` : job.status,
            type: "faceswap" as const,
            icon: "solar:face-scan-circle-bold",
            color: "text-pink-500",
            bgColor: "bg-pink-500/20",
          })),
          ...pendingUGCJobs.map((job) => ({
            id: `ugc-${job.id}`,
            title: job.scriptTitle || "AI Video",
            status: job.status === "generating" ? `${job.progress || 0}%` : job.status,
            type: "ugc" as const,
            icon: "solar:magic-stick-3-bold",
            color: "text-green-500",
            bgColor: "bg-green-500/20",
          })),
        ];

        return (
          <Card className="h-full bg-surface-base border border-border-base">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:layers-bold" width={20} className="text-cyan-500" />
                  <span className="font-semibold text-text-primary">Processing</span>
                </div>
                {totalPending > 0 && (
                  <Chip size="sm" color="primary" variant="flat">{totalPending}</Chip>
                )}
              </div>
              {clipsLoading ? (
                <div className="flex justify-center py-4">
                  <Icon icon="solar:spinner-bold" className="animate-spin text-text-tertiary" width={24} />
                </div>
              ) : totalPending === 0 ? (
                <div className="flex flex-col items-center justify-center py-4">
                  <Icon icon="solar:check-circle-bold" width={40} className="text-success mb-2" />
                  <p className="text-sm text-text-secondary">All caught up!</p>
                  <p className="text-xs text-text-tertiary">No jobs processing</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allPendingItems.slice(0, 4).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-hover">
                      <div className={`w-8 h-8 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                        <Icon icon={item.icon} width={16} className={`${item.color} ${item.status.includes("%") ? "" : "animate-spin"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">{item.title}</p>
                        <p className="text-[10px] text-text-tertiary capitalize">{item.status}</p>
                      </div>
                    </div>
                  ))}
                  {allPendingItems.length > 4 && (
                    <p className="text-xs text-text-tertiary text-center">+{allPendingItems.length - 4} more</p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        );
      }

      case "quickActions":
        return (
          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => router.push(action.href)}
                    className="group flex items-center gap-3 p-4 rounded-xl bg-surface-hover/50 border border-transparent hover:border-border-base hover:bg-surface-hover transition-all text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${action.color}15` }}
                    >
                      <Icon icon={action.icon} width={22} style={{ color: action.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{action.label}</p>
                      <p className="text-xs text-text-tertiary">{action.description}</p>
                    </div>
                    <Icon
                      icon="solar:arrow-right-linear"
                      width={16}
                      className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0"
                    />
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>
        );

      case "recentClips":
        return (
          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:video-library-bold" width={20} className="text-amber-500" />
                  <span className="font-semibold text-text-primary">Recent Clips</span>
                </div>
                {recentClips.length > 0 && (
                  <Button
                    size="sm"
                    variant="light"
                    onPress={() => router.push("/dashboard/clips")}
                    endContent={<Icon icon="solar:arrow-right-linear" width={14} />}
                  >
                    View All
                  </Button>
                )}
              </div>
              {clipsLoading ? (
                <div className="flex justify-center py-8">
                  <Icon icon="solar:spinner-bold" className="animate-spin text-text-tertiary" width={32} />
                </div>
              ) : recentClips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Icon icon="solar:video-library-linear" width={48} className="text-text-tertiary mb-3" />
                  <p className="text-sm text-text-secondary mb-1">No clips yet</p>
                  <p className="text-xs text-text-tertiary mb-4">Create your first clip to get started</p>
                  <Button size="sm" color="primary" onPress={() => router.push("/dashboard/create")}>
                    Create Clip
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {recentClips.map((clip) => (
                    <button
                      key={clip.id}
                      onClick={() => router.push(`/dashboard/clips?clipId=${clip.id}`)}
                      className="relative aspect-[9/16] rounded-xl overflow-hidden bg-surface-hover group"
                    >
                      {clip.clipUrl ? (
                        <video
                          src={clip.clipUrl}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon icon="solar:video-frame-linear" width={24} className="text-text-tertiary" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <p className="text-[10px] text-white truncate w-full">{clip.title || `Clip #${clip.id}`}</p>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                          <Icon icon="solar:play-bold" width={20} className="text-white" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {isEditMode && (
          <Button
            size="sm"
            variant="flat"
            onPress={resetLayout}
            startContent={<Icon icon="solar:refresh-bold" width={14} />}
          >
            Reset Layout
          </Button>
        )}
        <Button
          size="sm"
          variant={isEditMode ? "solid" : "flat"}
          color={isEditMode ? "primary" : "default"}
          onPress={() => setIsEditMode(!isEditMode)}
          startContent={<Icon icon={isEditMode ? "solar:check-bold" : "solar:pen-new-square-bold"} width={14} />}
        >
          {isEditMode ? "Done" : "Customize"}
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgetOrder.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 gap-4">
            {widgetOrder.map((config) => (
              <SortableWidget
                key={config.id}
                id={config.id}
                colSpan={config.colSpan}
                isEditMode={isEditMode}
              >
                {renderWidget(config)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
