import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

export interface VideoJobState {
  status: string;
  progress: number;
  progressMessage: string | null;
  finalVideoUrl?: string;
  clipId?: number | null;
  error?: string;
}

export interface UseVideoJobStatusConfig<T extends VideoJobState> {
  jobId: string;
  teamId: number | undefined;
  fetchStatus: (id: string) => Promise<T>;
  finalizeVideo: (id: string, teamId: number) => Promise<{ clipId: number }>;
  generatingStatuses: string[];
  onInitialFetch?: (status: T) => void;
}

export interface UseVideoJobStatusReturn<T extends VideoJobState> {
  status: T | null;
  loading: boolean;
  error: string | null;
  isFinalizing: boolean;
  isGenerating: boolean;
  handleSocketUpdate: (update: VideoJobState) => void;
  retryFinalize: () => void;
}

export function useVideoJobStatus<T extends VideoJobState>({
  jobId,
  teamId,
  fetchStatus,
  finalizeVideo,
  generatingStatuses,
  onInitialFetch,
}: UseVideoJobStatusConfig<T>): UseVideoJobStatusReturn<T> {
  const router = useRouter();

  const [status, setStatus] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const hasAutoFinalized = useRef(false);

  const fetchStatusRef = useRef(fetchStatus);
  const finalizeVideoRef = useRef(finalizeVideo);
  const onInitialFetchRef = useRef(onInitialFetch);
  fetchStatusRef.current = fetchStatus;
  finalizeVideoRef.current = finalizeVideo;
  onInitialFetchRef.current = onInitialFetch;

  const isGenerating = generatingStatuses.includes(status?.status ?? "");

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchStatusRef.current(jobId);
        if (cancelled) return;
        setStatus(result);
        onInitialFetchRef.current?.(result);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch job data:", err);
        setError(err instanceof Error ? err.message : "Failed to load job");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [jobId]);

  const handleSocketUpdate = useCallback(
    async (update: VideoJobState) => {
      if (update.status === "completed" && update.clipId) {
        router.push(`/dashboard/clips/${update.clipId}/edit`);
        return;
      }

      if (update.status === "completed" && !update.finalVideoUrl) {
        try {
          const fullStatus = await fetchStatusRef.current(jobId);
          setStatus(fullStatus);
        } catch (err) {
          console.error("Failed to fetch completed status:", err);
          setStatus(update as T);
        }
      } else {
        setStatus((prev) =>
          prev
            ? { ...prev, ...update, finalVideoUrl: update.finalVideoUrl || prev.finalVideoUrl } as T
            : update as T
        );
      }
    },
    [jobId, router]
  );

  useEffect(() => {
    if (!isGenerating) return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await fetchStatusRef.current(jobId);
        setStatus(result);
        if (result.status === "completed" || result.status === "failed") {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error("Failed to poll status:", err);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [isGenerating, jobId]);

  useEffect(() => {
    const autoFinalize = async () => {
      if (
        status?.status !== "completed" ||
        !teamId ||
        hasAutoFinalized.current ||
        isFinalizing
      )
        return;

      if (status.clipId) {
        router.push(`/dashboard/clips/${status.clipId}/edit`);
        return;
      }

      if (!status.finalVideoUrl) return;

      hasAutoFinalized.current = true;
      setIsFinalizing(true);
      setError(null);

      try {
        const response = await finalizeVideoRef.current(jobId, teamId);
        router.push(`/dashboard/clips/${response.clipId}/edit`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save to library");
        setIsFinalizing(false);
        hasAutoFinalized.current = false;
      }
    };

    autoFinalize();
  }, [status, teamId, jobId, router, isFinalizing]);

  const retryFinalize = useCallback(() => {
    hasAutoFinalized.current = false;
    setError(null);
  }, []);

  return {
    status,
    loading,
    error,
    isFinalizing,
    isGenerating,
    handleSocketUpdate,
    retryFinalize,
  };
}
