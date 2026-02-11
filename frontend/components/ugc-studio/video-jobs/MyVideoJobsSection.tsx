"use client";

import {
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Pagination, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ugcVideoAPI, UGCVideoJob } from "@/api/ugc/video";
import { connectSocket, joinTeam, leaveTeam } from "@/lib/socket";
import { VideoJobCard } from "./VideoJobCard";

const JOBS_PER_PAGE = 12;

interface MyVideoJobsSectionProps {
  teamId: number;
}

export interface MyVideoJobsSectionRef {
  refetch: () => Promise<void>;
}

interface SocketUpdate {
  jobId: string;
  status: "queued" | "generating" | "completed" | "failed";
  progress: number;
  progressMessage: string;
  currentScene?: number;
  totalScenes?: number;
  finalVideoUrl?: string;
  finalVideoKey?: string;
  totalDurationSeconds?: number;
  error?: string;
}

export const MyVideoJobsSection = forwardRef<
  MyVideoJobsSectionRef,
  MyVideoJobsSectionProps
>(function MyVideoJobsSection({ teamId }, ref) {
  const router = useRouter();
  const [jobs, setJobs] = useState<UGCVideoJob[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const offset = (currentPage - 1) * JOBS_PER_PAGE;
      const response = await ugcVideoAPI.listVideoJobs(
        teamId,
        JOBS_PER_PAGE,
        offset
      );
      setJobs(response.jobs);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to fetch video jobs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, currentPage]);

  useImperativeHandle(
    ref,
    () => ({
      refetch: fetchJobs,
    }),
    [fetchJobs]
  );

  // Fetch jobs on mount and when page changes
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Socket connection for real-time updates
  useEffect(() => {
    const socket = connectSocket();
    joinTeam(teamId);

    const handleJobUpdate = (update: SocketUpdate) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === update.jobId);
        if (idx === -1) {
          // New job - refetch to get full data
          fetchJobs();
          return prev;
        }
        // Update existing job
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: update.status,
          progress: update.progress,
          progressMessage: update.progressMessage,
          finalVideoUrl: update.finalVideoUrl,
          totalDurationSeconds: update.totalDurationSeconds,
          errorMessage: update.error,
        };
        return updated;
      });
    };

    socket.on("ugc-video-job-update", handleJobUpdate);

    return () => {
      socket.off("ugc-video-job-update", handleJobUpdate);
      leaveTeam(teamId);
    };
  }, [teamId, fetchJobs]);

  const handleConfirmDelete = async () => {
    if (!deletingJobId) return;
    setIsDeleting(true);
    try {
      await ugcVideoAPI.deleteVideoJob(deletingJobId);
      setJobs((prev) => prev.filter((j) => j.id !== deletingJobId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      console.error("Failed to delete video job:", err);
    } finally {
      setIsDeleting(false);
      setDeletingJobId(null);
    }
  };

  const handleJobClick = (job: UGCVideoJob) => {
    // Navigate to the job edit/view page
    router.push(`/dashboard/ugc-studio/ai-video-creator/${job.id}`);
  };

  const totalPages = Math.ceil(total / JOBS_PER_PAGE);

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
            icon="solar:video-frame-play-bold-duotone"
            className="text-4xl text-text-tertiary mx-auto mb-3"
          />
          <p className="text-text-secondary">No videos yet</p>
          <p className="text-xs text-text-tertiary mt-1">
            Create your first UGC video above
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {jobs.map((job) => (
          <VideoJobCard
            key={job.id}
            job={job}
            onClick={() => handleJobClick(job)}
            onDelete={() => setDeletingJobId(job.id)}
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

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deletingJobId} onClose={() => !isDeleting && setDeletingJobId(null)} size="sm">
        <ModalContent>
          <ModalHeader className="text-text-primary">Delete Video</ModalHeader>
          <ModalBody>
            <p className="text-text-secondary">
              Are you sure you want to delete this video? This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setDeletingJobId(null)} isDisabled={isDeleting}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleConfirmDelete} isLoading={isDeleting}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
});
