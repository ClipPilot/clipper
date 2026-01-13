"use client";

import { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { Card, CardBody, Pagination, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { connectSocket, joinTeam, leaveTeam } from "@/lib/socket";
import { faceSwapAPI } from "@/api/ugc/faceSwap";
import { FaceSwapJob } from "./types";
import { FaceSwapDetailModal } from "./FaceSwapDetailModal";
import { FaceSwapJobCard } from "./FaceSwapJobCard";

const JOBS_PER_PAGE = 6;

interface MyFaceSwapsSectionProps {
  teamId: number;
}

export interface MyFaceSwapsSectionRef {
  refetch: () => Promise<void>;
}

export const MyFaceSwapsSection = forwardRef<MyFaceSwapsSectionRef, MyFaceSwapsSectionProps>(function MyFaceSwapsSection({
  teamId,
}, ref) {
  const [jobs, setJobs] = useState<FaceSwapJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<FaceSwapJob | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await faceSwapAPI.getTeamJobs(teamId);
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useImperativeHandle(ref, () => ({
    refetch: fetchJobs,
  }), [fetchJobs]);

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
      await faceSwapAPI.deleteJob(jobId);
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
    } catch (err) {
      console.error("Failed to delete job:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to delete job.";
      addToast({
        title: "Delete failed",
        description: errorMessage,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
});
