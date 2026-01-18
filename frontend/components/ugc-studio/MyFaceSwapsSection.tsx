"use client";

import { useState, useCallback, useEffect, useImperativeHandle, forwardRef, useRef } from "react";
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
  addOptimisticJob: (tempId: string, message?: string) => void;
  updateOptimisticJob: (tempId: string, realId: string) => void;
  updateOptimisticJobStatus: (tempId: string, message: string) => void;
  failOptimisticJob: (tempId: string, errorMessage: string) => void;
}

export const MyFaceSwapsSection = forwardRef<MyFaceSwapsSectionRef, MyFaceSwapsSectionProps>(function MyFaceSwapsSection({
  teamId,
}, ref) {
  const [jobs, setJobs] = useState<FaceSwapJob[]>([]);
  const [optimisticJobs, setOptimisticJobs] = useState<FaceSwapJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [selectedJob, setSelectedJob] = useState<FaceSwapJob | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fetchingRef = useRef(false);

  const fetchJobs = useCallback(async (page: number = currentPage) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const offset = (page - 1) * JOBS_PER_PAGE;
      const data = await faceSwapAPI.getTeamJobs(teamId, { limit: JOBS_PER_PAGE, offset });
      setJobs(data.jobs || []);
      setTotalJobs(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [teamId, currentPage]);

  // Add an optimistic job with "uploading" status immediately
  const addOptimisticJob = useCallback((tempId: string, message?: string) => {
    const optimisticJob: FaceSwapJob = {
      id: tempId,
      status: "uploading",
      progress: null,
      progressMessage: message || "Uploading files...",
      outputUrl: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      finishedAt: null,
    };
    setOptimisticJobs((prev) => [optimisticJob, ...prev]);
    setTotalJobs((prev) => prev + 1);
  }, []);

  // Update the optimistic job with the real ID and queued status
  const updateOptimisticJob = useCallback((tempId: string, realId: string) => {
    setOptimisticJobs((prev) =>
      prev.map((job) =>
        job.id === tempId
          ? { ...job, id: realId, status: "queued", progressMessage: null }
          : job
      )
    );
  }, []);

  // Update the progress message of an optimistic job
  const updateOptimisticJobStatus = useCallback((tempId: string, message: string) => {
    setOptimisticJobs((prev) =>
      prev.map((job) =>
        job.id === tempId
          ? { ...job, progressMessage: message }
          : job
      )
    );
  }, []);

  // Mark the optimistic job as failed if the API call fails
  const failOptimisticJob = useCallback((tempId: string, errorMessage: string) => {
    setOptimisticJobs((prev) =>
      prev.map((job) =>
        job.id === tempId
          ? { ...job, status: "failed", errorMessage }
          : job
      )
    );
  }, []);

  const refetch = useCallback(async () => {
    await fetchJobs(currentPage);
  }, [fetchJobs, currentPage]);

  useImperativeHandle(ref, () => ({
    refetch,
    addOptimisticJob,
    updateOptimisticJob,
    updateOptimisticJobStatus,
    failOptimisticJob,
  }), [refetch, addOptimisticJob, updateOptimisticJob, updateOptimisticJobStatus, failOptimisticJob]);

  // Fetch when page changes
  useEffect(() => {
    fetchJobs(currentPage);
  }, [currentPage, teamId]);

  // Initial fetch and socket setup
  useEffect(() => {
    const socket = connectSocket();
    joinTeam(teamId);

    const handleJobUpdate = (update: FaceSwapJob | { id: string; status: "deleted" }) => {
      if (update.status === "deleted") {
        setJobs((prev) => prev.filter((j) => j.id !== update.id));
        setOptimisticJobs((prev) => prev.filter((j) => j.id !== update.id));
        setTotalJobs((prev) => Math.max(0, prev - 1));
        return;
      }

      // Check if this is an optimistic job being updated
      setOptimisticJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === update.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...update };
          return updated;
        }
        return prev;
      });

      // Also update in the main jobs list if present
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === update.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...update };
          return updated;
        }
        return prev;
      });
    };

    socket.on("comfy-job-update", handleJobUpdate);

    return () => {
      socket.off("comfy-job-update", handleJobUpdate);
      leaveTeam(teamId);
    };
  }, [teamId]);

  useEffect(() => {
    const allJobs = [...optimisticJobs, ...jobs];
    if (selectedJob && isModalOpen) {
      const updated = allJobs.find((j) => j.id === selectedJob.id);
      if (
        updated &&
        (updated.status !== selectedJob.status ||
          updated.progress !== selectedJob.progress ||
          updated.outputUrl !== selectedJob.outputUrl ||
          updated.clipId !== selectedJob.clipId ||
          updated.title !== selectedJob.title)
      ) {
        setSelectedJob(updated);
      }
    }
  }, [jobs, optimisticJobs, selectedJob, isModalOpen]);

  // Combine optimistic jobs (only on page 1) with fetched jobs
  const displayJobs = currentPage === 1
    ? [...optimisticJobs, ...jobs].slice(0, JOBS_PER_PAGE)
    : jobs;

  // Calculate total pages including optimistic jobs
  const totalWithOptimistic = totalJobs + optimisticJobs.length;
  const totalPages = Math.ceil(totalWithOptimistic / JOBS_PER_PAGE);

  const handleJobClick = (job: FaceSwapJob) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      await faceSwapAPI.deleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setOptimisticJobs((prev) => prev.filter((j) => j.id !== jobId));
      setTotalJobs((prev) => Math.max(0, prev - 1));
      // Close modal if the deleted job was being viewed
      if (selectedJob?.id === jobId) {
        setIsModalOpen(false);
        setSelectedJob(null);
      }
      addToast({
        title: "Job deleted",
        description: "The swap job has been deleted.",
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

  const handleTitleUpdate = useCallback((jobId: string, title: string) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId ? { ...job, title } : job
      )
    );
    setOptimisticJobs((prev) =>
      prev.map((job) =>
        job.id === jobId ? { ...job, title } : job
      )
    );
    // Also update selectedJob if it's the one being edited
    if (selectedJob?.id === jobId) {
      setSelectedJob((prev) => prev ? { ...prev, title } : null);
    }
  }, [selectedJob]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

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

  if (totalWithOptimistic === 0) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 text-center">
          <Icon
            icon="solar:mask-happly-bold-duotone"
            className="text-4xl text-text-tertiary mx-auto mb-3"
          />
          <p className="text-text-secondary">No swaps yet</p>
          <p className="text-xs text-text-tertiary mt-1">
            Create your first swap above
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayJobs.map((job) => (
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
              onChange={handlePageChange}
              color="primary"
              size="sm"
              showControls
              siblings={2}
              boundaries={1}
            />
          </div>
        )}
      </div>
      <FaceSwapDetailModal
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDelete={handleDeleteJob}
        onTitleUpdate={handleTitleUpdate}
      />
    </>
  );
});
