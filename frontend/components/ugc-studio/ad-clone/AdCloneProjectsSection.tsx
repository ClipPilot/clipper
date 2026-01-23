"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Pagination } from "@heroui/react";
import { Icon } from "@iconify/react";
import { adCloneAPI } from "@/api/adClone";
import { connectSocket, joinTeam, leaveTeam } from "@/lib/socket";
import { AdCloneProjectCard, AdCloneProject } from "./AdCloneProjectCard";
import type { AdCloneProjectStatus } from "@/store/adClone";

const PROJECTS_PER_PAGE = 12;

interface AdCloneProjectsSectionProps {
  teamId: number;
}

interface SocketUpdate {
  projectId: string;
  status: AdCloneProjectStatus;
  progress: number;
  progressMessage: string;
  finalVideoUrl?: string;
  error?: string;
}

export function AdCloneProjectsSection({ teamId }: AdCloneProjectsSectionProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<AdCloneProject[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProjects = useCallback(async () => {
    try {
      const offset = (currentPage - 1) * PROJECTS_PER_PAGE;
      const response = await adCloneAPI.listProjects(teamId, PROJECTS_PER_PAGE, offset);
      setProjects(
        response.projects.map((p) => ({
          id: p.id,
          productName: p.productName,
          status: p.status,
          progress: p.progress,
          progressMessage: p.progressMessage,
          thumbnailUrl: p.thumbnailUrl,
          finalVideoUrl: p.finalVideoUrl,
          createdAt: p.createdAt,
        }))
      );
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to fetch ad clone projects:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, currentPage]);

  // Fetch projects on mount and when page changes
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Socket connection for real-time updates
  useEffect(() => {
    const socket = connectSocket();
    joinTeam(teamId);

    const handleProjectUpdate = (update: SocketUpdate) => {
      setProjects((prev) => {
        const idx = prev.findIndex((p) => p.id === update.projectId);
        if (idx === -1) {
          // New project - refetch to get full data
          fetchProjects();
          return prev;
        }
        // Update existing project
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: update.status,
          progress: update.progress,
          progressMessage: update.progressMessage,
          finalVideoUrl: update.finalVideoUrl,
        };
        return updated;
      });
    };

    socket.on("ad-clone-job-update", handleProjectUpdate);

    return () => {
      socket.off("ad-clone-job-update", handleProjectUpdate);
      leaveTeam(teamId);
    };
  }, [teamId, fetchProjects]);

  const handleProjectClick = (project: AdCloneProject) => {
    router.push(`/dashboard/ugc-studio/ad-clone/${project.id}`);
  };

  const totalPages = Math.ceil(total / PROJECTS_PER_PAGE);

  if (isLoading) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 flex items-center justify-center">
          <Icon
            icon="solar:refresh-circle-bold-duotone"
            className="text-3xl text-orange-500 animate-spin"
          />
        </CardBody>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 text-center">
          <Icon
            icon="solar:copy-bold-duotone"
            className="text-4xl text-text-tertiary mx-auto mb-3"
          />
          <p className="text-text-secondary">No ad clones yet</p>
          <p className="text-xs text-text-tertiary mt-1">
            Clone your first ad to get started
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {projects.map((project) => (
          <AdCloneProjectCard
            key={project.id}
            project={project}
            onClick={() => handleProjectClick(project)}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center pt-4">
          <Pagination
            total={totalPages}
            page={currentPage}
            onChange={setCurrentPage}
            color="warning"
            size="sm"
            showControls
          />
        </div>
      )}
    </div>
  );
}
