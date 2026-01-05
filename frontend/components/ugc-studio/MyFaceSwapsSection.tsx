"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardBody, Pagination, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { apiFetch } from "@/lib/apiClient";
import API_URL from "@/config/constants";
import { connectSocket, joinTeam, leaveTeam } from "@/lib/socket";
import { FaceSwapJob } from "./types";
import { FaceSwapDetailModal } from "./FaceSwapDetailModal";
import { FaceSwapJobCard } from "./FaceSwapJobCard";

const JOBS_PER_PAGE = 6;

interface MyFaceSwapsSectionProps {
  teamId: number;
  refreshTrigger?: number;
}

export function MyFaceSwapsSection({
  teamId,
  refreshTrigger,
}: MyFaceSwapsSectionProps) {
  const [jobs, setJobs] = useState<FaceSwapJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<FaceSwapJob | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_URL}/comfy/team/${teamId}/jobs`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchJobs();

    const socket = connectSocket();
    joinTeam(teamId);

    const handleJobUpdate = (update: FaceSwapJob | { id: string; status: "deleted" }) => {
      // Handle deleted jobs from websocket
      if (update.status === "deleted") {
        setJobs((prev) => prev.filter((j) => j.id !== update.id));
        return;
      }
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === update.id);
        if (idx === -1) {
          return [update, ...prev];
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...update };
        return updated;
      });
    };

    socket.on("comfy-job-update", handleJobUpdate);

    return () => {
      socket.off("comfy-job-update", handleJobUpdate);
      leaveTeam(teamId);
    };
  }, [teamId, fetchJobs]);

  useEffect(() => {
    if (refreshTrigger) fetchJobs();
  }, [refreshTrigger, fetchJobs]);

  useEffect(() => {
    if (selectedJob && isModalOpen) {
      const updated = jobs.find((j) => j.id === selectedJob.id);
      if (
        updated &&
        (updated.status !== selectedJob.status ||
          updated.progress !== selectedJob.progress ||
          updated.outputUrl !== selectedJob.outputUrl)
      ) {
        setSelectedJob(updated);
      }
    }
  }, [jobs, selectedJob, isModalOpen]);

  const totalPages = Math.ceil(jobs.length / JOBS_PER_PAGE);
  const paginatedJobs = jobs.slice(
    (currentPage - 1) * JOBS_PER_PAGE,
    currentPage * JOBS_PER_PAGE
  );

  const handleJobClick = (job: FaceSwapJob) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      const response = await apiFetch(`${API_URL}/comfy/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        // Close modal if the deleted job was being viewed
        if (selectedJob?.id === jobId) {
          setIsModalOpen(false);
          setSelectedJob(null);
        }
        addToast({
          title: "Job deleted",
          description: "The face swap job has been deleted.",
          color: "success",
        });
      } else {
        const data = await response.json();
        addToast({
          title: "Delete failed",
          description: data.error || "Failed to delete job.",
          color: "danger",
        });
      }
    } catch (err) {
      console.error("Failed to delete job:", err);
      addToast({
        title: "Delete failed",
        description: "An error occurred while deleting the job.",
        color: "danger",
      });
    }
  }, [selectedJob]);

  if (isLoading) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 flex items-center justify-center">
          <Icon
            icon="solar:refresh-circle-bold-duotone"
            className="text-3xl text-accent-400 animate-spin"
          />
        </CardBody>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 text-center">
          <Icon
            icon="solar:mask-happly-bold-duotone"
            className="text-4xl text-text-tertiary mx-auto mb-3"
          />
          <p className="text-text-secondary">No face swaps yet</p>
          <p className="text-xs text-text-tertiary mt-1">
            Create your first face swap above
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedJobs.map((job) => (
            <FaceSwapJobCard
              key={job.id}
              job={job}
              onClick={() => handleJobClick(job)}
              onDelete={handleDeleteJob}
            />
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center pt-4">
            <Pagination
              total={totalPages}
              page={currentPage}
              onChange={setCurrentPage}
              color="primary"
              size="sm"
              showControls
            />
          </div>
        )}
      </div>
      <FaceSwapDetailModal
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDelete={handleDeleteJob}
      />
    </>
  );
}
