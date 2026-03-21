"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { adminAPI, Team } from "@/lib/api";

type FileStatus = "queued" | "uploading" | "done" | "error";

interface UploadFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  s3Key: string | null;
  error: string | null;
  speed: number;
  startedAt: number;
}

interface ClipOptions {
  numberOfVideos: number;
  promptType: string;
  conversionMode: string;
  length: number | null;
  hookLength: number | null;
  textPrompt: string;
  captions: boolean;
  captionColor: string;
  captionFont: string;
  autoHeading: boolean;
  customText: string;
  headingInstructions: string;
  textStyle: string;
  textColor: string;
  textFont: string;
  textPosition: string;
  textBgColor: string;
}

interface JobInfo {
  rawVideoPublicIds: string[];
  fileName: string;
  clipIds: number[];
}

type PageState = "setup" | "processing" | "complete";

const COLORS = [
  { name: "white", hex: "#FFFFFF" },
  { name: "black", hex: "#000000" },
  { name: "red", hex: "#FF0000" },
  { name: "orange", hex: "#FF6B00" },
  { name: "yellow", hex: "#FFD600" },
  { name: "green", hex: "#00FF00" },
  { name: "teal", hex: "#00D4AA" },
  { name: "blue", hex: "#0084FF" },
  { name: "purple", hex: "#7B2CBF" },
  { name: "pink", hex: "#FF006E" },
];

const FONTS = ["Proxima Nova", "Montserrat", "Luckiest Guy", "Everlasting", "Komika", "Burbank", "Bebas Neue", "Anton"];

const MAX_CONCURRENT = 5;
const MULTIPART_THRESHOLD = 15 * 1024 * 1024;

const MIME_MAP: Record<string, string> = {
  "video/mp4": "video/mp4",
  "video/quicktime": "video/quicktime",
  "video/x-msvideo": "video/x-msvideo",
  "video/x-matroska": "video/x-matroska",
  "video/webm": "video/webm",
};

const EXT_MIME: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
};

function getContentType(file: File): string | null {
  if (MIME_MAP[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return EXT_MIME[ext] || null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return bytesPerSec.toFixed(0) + " B/s";
  if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1) + " KB/s";
  return (bytesPerSec / (1024 * 1024)).toFixed(1) + " MB/s";
}

function formatEta(file: UploadFile): string {
  if (file.speed <= 0 || file.progress >= 100) return "";
  const remaining = file.file.size * (1 - file.progress / 100);
  const seconds = Math.ceil(remaining / file.speed);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h${Math.ceil((seconds % 3600) / 60)}m`;
}

const BATCH_KEY = "clip-factory-batch";
const TEAM_KEY = "clip-factory-team";

interface PersistedBatch {
  team: Team;
  jobs: JobInfo[];
  publicIds: string[];
}

function saveBatch(team: Team, jobs: JobInfo[]) {
  const data: PersistedBatch = { team, jobs, publicIds: jobs.flatMap((j) => j.rawVideoPublicIds) };
  localStorage.setItem(BATCH_KEY, JSON.stringify(data));
}

function loadBatch(): PersistedBatch | null {
  try {
    const raw = localStorage.getItem(BATCH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearBatch() {
  localStorage.removeItem(BATCH_KEY);
}

function saveTeam(team: Team) {
  localStorage.setItem(TEAM_KEY, JSON.stringify(team));
}

function loadTeam(): Team | null {
  try {
    const raw = localStorage.getItem(TEAM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function ClipFactoryPage() {
  const restored = useRef(loadBatch());

  const [pageState, setPageState] = useState<PageState>(() => restored.current ? "processing" : "setup");

  // Team selection
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(() => restored.current?.team ?? loadTeam());
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Upload
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  // Options
  const [options, setOptions] = useState<ClipOptions>({
    numberOfVideos: 3,
    promptType: "viral",
    conversionMode: "standard",
    length: null,
    hookLength: null,
    textPrompt: "",
    captions: true,
    captionColor: "#FFFFFF",
    captionFont: "Proxima Nova",
    autoHeading: true,
    customText: "",
    headingInstructions: "",
    textStyle: "instagram",
    textColor: "#FFFFFF",
    textFont: "Proxima Nova",
    textPosition: "top",
    textBgColor: "white",
  });

  // Processing
  const [jobs, setJobs] = useState<JobInfo[]>(() => restored.current?.jobs ?? []);
  const [statusData, setStatusData] = useState<Awaited<ReturnType<typeof adminAPI.getClipFactoryStatus>> | null>(null);
  const [error, setError] = useState("");
  const [startLoading, setStartLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Active jobs
  const [activeJobs, setActiveJobs] = useState<{ rawVideoPublicId: string; fileName: string; clips: { clipId: number; status: string; title: string | null }[] }[]>([]);
  const [activeJobsLoading, setActiveJobsLoading] = useState(false);

  // Team search
  const fetchTeams = useCallback(async (search: string) => {
    setTeamsLoading(true);
    try {
      const result = await adminAPI.getTeams({ search, limit: 20 });
      setTeams(result.teams);
    } catch {
      // ignore
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchTeams(teamSearch), 300);
    return () => clearTimeout(timer);
  }, [teamSearch, fetchTeams]);

  async function fetchActiveJobs(teamId: number) {
    setActiveJobsLoading(true);
    try {
      const res = await adminAPI.getClipFactoryActiveJobs(teamId);
      setActiveJobs(res.jobs);
    } catch {
      setActiveJobs([]);
    } finally {
      setActiveJobsLoading(false);
    }
  }

  // File handling
  function addFiles(fileList: FileList | File[]) {
    const newFiles: UploadFile[] = [];
    const arr = Array.from(fileList);
    for (const file of arr) {
      const ct = getContentType(file);
      if (!ct) continue;
      newFiles.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        status: "queued",
        progress: 0,
        s3Key: null,
        error: null,
        speed: 0,
        startedAt: 0,
      });
    }
    if (newFiles.length === 0) return;
    setFiles((prev) => [...prev, ...newFiles]);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  // Upload logic
  async function uploadFile(uploadFile: UploadFile): Promise<{ s3Key: string } | null> {
    if (!selectedTeam) return null;
    const ct = getContentType(uploadFile.file);
    if (!ct) return null;

    const uploadStart = Date.now();
    setFiles((prev) => prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "uploading" as FileStatus, progress: 0, startedAt: uploadStart, speed: 0 } : f)));

    try {
      if (uploadFile.file.size > MULTIPART_THRESHOLD) {
        return await uploadMultipart(uploadFile, ct);
      }

      const { uploadUrl, s3Key } = await adminAPI.getClipFactoryPresignedUrl(
        selectedTeam.id,
        uploadFile.file.name,
        ct,
      );

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", ct);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            const elapsed = (Date.now() - uploadStart) / 1000;
            const speed = elapsed > 0 ? e.loaded / elapsed : 0;
            setFiles((prev) => prev.map((f) => (f.id === uploadFile.id ? { ...f, progress: pct, speed } : f)));
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(uploadFile.file);
      });

      setFiles((prev) => prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "done" as FileStatus, progress: 100, s3Key } : f)));
      return { s3Key };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setFiles((prev) => prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "error" as FileStatus, error: msg } : f)));
      return null;
    }
  }

  async function uploadMultipart(uploadFile: UploadFile, ct: string): Promise<{ s3Key: string } | null> {
    if (!selectedTeam) return null;

    const { uploadId, s3Key, chunkSize, totalParts, partUrls } = await adminAPI.initiateClipFactoryMultipart(
      selectedTeam.id,
      uploadFile.file.name,
      ct,
      uploadFile.file.size,
    );

    const parts: { partNumber: number; etag: string }[] = [];
    let uploadedBytes = 0;
    const mpStart = Date.now();
    const PARALLEL_CHUNKS = 4;

    const queue = [...partUrls];
    let cursor = 0;

    async function chunkWorker() {
      while (cursor < queue.length) {
        if (abortRef.current) return;
        const idx = cursor++;
        const part = queue[idx];
        if (!part) break;

        const { partNumber, uploadUrl } = part;
        const start = (partNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, uploadFile.file.size);
        const chunk = uploadFile.file.slice(start, end);

        const response = await fetch(uploadUrl, { method: "PUT", body: chunk });
        if (!response.ok) throw new Error(`Part ${partNumber} failed`);

        const etag = response.headers.get("ETag") || "";
        parts.push({ partNumber, etag });
        uploadedBytes += end - start;

        const pct = Math.round((uploadedBytes / uploadFile.file.size) * 100);
        const elapsed = (Date.now() - mpStart) / 1000;
        const speed = elapsed > 0 ? uploadedBytes / elapsed : 0;
        setFiles((prev) => prev.map((f) => (f.id === uploadFile.id ? { ...f, progress: pct, speed } : f)));
      }
    }

    const workers = Array.from({ length: Math.min(PARALLEL_CHUNKS, queue.length) }, () => chunkWorker());
    await Promise.all(workers);

    if (abortRef.current) return null;

    parts.sort((a, b) => a.partNumber - b.partNumber);
    await adminAPI.completeClipFactoryMultipart(s3Key, uploadId, parts);
    setFiles((prev) => prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "done" as FileStatus, progress: 100, s3Key } : f)));
    return { s3Key };
  }

  async function startUpload() {
    setIsUploading(true);
    abortRef.current = false;
    const queue = [...files.filter((f) => f.status === "queued")];
    let cursor = 0;

    async function worker() {
      while (cursor < queue.length && !abortRef.current) {
        const file = queue[cursor++];
        if (!file) break;
        await uploadFile(file);
      }
    }

    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, () => worker());
    await Promise.all(workers);
    setIsUploading(false);
  }

  // Start processing
  async function handleStart() {
    if (!selectedTeam) return;
    setError("");
    setStartLoading(true);

    const uploadedFiles = files.filter((f) => f.status === "done" && f.s3Key);
    if (uploadedFiles.length === 0) {
      setError("No uploaded files to process");
      setStartLoading(false);
      return;
    }

    const videos = uploadedFiles.map((f) => ({
      s3Key: f.s3Key!,
      originalFileName: f.file.name,
      fileSize: f.file.size,
    }));

    const apiOptions: Record<string, unknown> = {
      numberOfVideos: options.numberOfVideos,
      promptType: options.promptType,
      conversionMode: options.conversionMode === "facecam" ? "gaming" : options.conversionMode,
      captions: options.captions,
      autoHeading: options.autoHeading,
    };

    if (options.length) apiOptions.length = options.length;
    if (options.hookLength) apiOptions.hookLength = options.hookLength;
    if (options.textPrompt) apiOptions.textPrompt = options.textPrompt;
    if (options.captions) {
      apiOptions.captionColor = options.captionColor;
      apiOptions.captionFont = options.captionFont;
    }
    if (options.autoHeading) {
      apiOptions.textStyle = options.textStyle;
      apiOptions.textColor = options.textColor;
      apiOptions.textFont = options.textFont;
      apiOptions.textPosition = options.textPosition;
      if (options.headingInstructions) apiOptions.headingInstructions = options.headingInstructions;
      if (options.textStyle === "instagram" && options.textBgColor) apiOptions.textBgColor = options.textBgColor;
    }
    if (options.customText) {
      apiOptions.customText = options.customText;
      apiOptions.autoHeading = false;
    }

    try {
      const result = await adminAPI.startClipFactory(selectedTeam.id, videos, apiOptions);
      setJobs(result.jobs);
      setPageState("processing");
      saveBatch(selectedTeam, result.jobs);
      startPolling(result.jobs.flatMap((j) => j.rawVideoPublicIds), selectedTeam.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setStartLoading(false);
    }
  }

  function startPolling(publicIds: string[], teamId: number) {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const data = await adminAPI.getClipFactoryStatus(publicIds, teamId);
        setStatusData(data);
        if (data.status === "completed" || data.status === "failed" || data.status === "partial") {
          if (pollRef.current) clearInterval(pollRef.current);
          clearBatch();
          setPageState("complete");
        }
      } catch {
        // keep polling
      }
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
  }

  useEffect(() => {
    if (restored.current) {
      startPolling(restored.current.publicIds, restored.current.team.id);
    } else {
      const persistedTeam = loadTeam();
      if (persistedTeam) fetchActiveJobs(persistedTeam.id);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleReset() {
    if (pollRef.current) clearInterval(pollRef.current);
    clearBatch();
    setPageState("setup");
    setFiles([]);
    setJobs([]);
    setStatusData(null);
    setError("");
  }

  // Computed
  const uploadedCount = files.filter((f) => f.status === "done").length;
  const totalSize = files.reduce((s, f) => s + f.file.size, 0);
  const canStart = uploadedCount > 0 && !isUploading && selectedTeam !== null;

  // ---- RENDER ----

  if (pageState === "processing" || pageState === "complete") {
    const progress = statusData?.progress || { total: 0, completed: 0, failed: 0, pending: 0 };
    const pct = progress.total > 0 ? Math.round(((progress.completed + progress.failed) / progress.total) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Clip Factory</h1>
            <p className="text-text-secondary mt-1">
              {pageState === "processing" ? "Processing clips..." : "Batch complete"}
              {selectedTeam && <span className="text-text-tertiary"> — {selectedTeam.name}</span>}
            </p>
          </div>
          {pageState === "complete" && (
            <button onClick={handleReset} className="px-4 py-2.5 rounded-lg bg-emerald text-black font-semibold hover:bg-emerald-light transition-colors">
              New Batch
            </button>
          )}
        </div>

        {/* Overall Progress */}
        <div className="p-4 rounded-xl bg-surface border border-border">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text-secondary">{progress.completed} completed · {progress.failed} failed · {progress.pending} pending</span>
            <span className="text-text-primary font-semibold">{pct}%</span>
          </div>
          <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
            <div className="h-full bg-emerald rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Per-video status */}
        <div className="space-y-3">
          {jobs.map((job) => {
            const allClips = statusData
              ? statusData.videos
                  .filter((v) => job.rawVideoPublicIds.includes(v.rawVideoPublicId))
                  .flatMap((v) => v.clips)
              : job.clipIds.map((id) => ({ clipId: id, status: "pending", title: null, downloadUrl: null, errorMessage: null }));

            const doneCount = allClips.filter((c) => c.status === "completed").length;
            const failedCount = allClips.filter((c) => c.status === "failed").length;
            const jobStatus = doneCount + failedCount === allClips.length
              ? (failedCount === allClips.length ? "failed" : "completed")
              : "processing";

            return (
              <div key={job.fileName} className="p-4 rounded-xl bg-surface border border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-text-primary font-medium truncate mr-3">{job.fileName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-text-tertiary text-xs">{doneCount}/{allClips.length}</span>
                    <StatusBadge status={jobStatus} />
                  </div>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {allClips.map((clip, idx) => (
                    <div key={clip.clipId || idx} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-surface-elevated">
                      <span className="text-text-secondary">
                        {clip.title || `Clip #${idx + 1}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={clip.status} small />
                        {clip.downloadUrl && (
                          <a href={clip.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-emerald hover:underline text-xs">
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // SETUP STATE
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Clip Factory</h1>
        <p className="text-text-secondary mt-1">Mass-generate clips into any workspace</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Team Selection */}
      <div className="p-4 rounded-xl bg-surface border border-border">
        <label className="block text-sm font-semibold text-text-primary mb-2">Workspace</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search teams..."
            value={selectedTeam ? selectedTeam.name : teamSearch}
            onChange={(e) => {
              setTeamSearch(e.target.value);
              setSelectedTeam(null);
              setTeamDropdownOpen(true);
            }}
            onFocus={() => setTeamDropdownOpen(true)}
            className="w-full px-3 py-2.5 rounded-lg bg-surface-elevated border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary"
          />
          {teamDropdownOpen && teams.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg bg-surface-elevated border border-border shadow-lg">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTeam(t);
                    saveTeam(t);
                    setTeamDropdownOpen(false);
                    setTeamSearch("");
                    fetchActiveJobs(t.id);
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-surface-hover transition-colors flex justify-between items-center"
                >
                  <span className="text-text-primary">{t.name}</span>
                  <span className="text-xs text-text-tertiary capitalize">{t.plan}</span>
                </button>
              ))}
              {teamsLoading && <div className="px-3 py-2 text-text-tertiary text-sm">Loading...</div>}
            </div>
          )}
        </div>
      </div>

      {/* Active Jobs */}
      {selectedTeam && activeJobs.length > 0 && (
        <div className="p-4 rounded-xl bg-surface border border-border">
          <label className="block text-sm font-semibold text-text-primary mb-3">
            Active Jobs
            <span className="text-text-tertiary font-normal ml-2">{activeJobs.reduce((n, j) => n + j.clips.length, 0)} clips pending</span>
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activeJobs.map((job) => (
              <div key={job.rawVideoPublicId} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-elevated">
                <span className="text-text-primary text-sm truncate flex-1 mr-3">{job.fileName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 text-xs">{job.clips.length} pending</span>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedTeam && activeJobsLoading && (
        <div className="flex justify-center py-3">
          <div className="animate-spin w-5 h-5 border-2 border-emerald border-t-transparent rounded-full" />
        </div>
      )}

      {/* Video Upload */}
      <div className="p-4 rounded-xl bg-surface border border-border">
        <label className="block text-sm font-semibold text-text-primary mb-2">
          Videos
          {files.length > 0 && <span className="text-text-tertiary font-normal ml-2">{files.length} files · {formatBytes(totalSize)}</span>}
        </label>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-emerald"); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove("border-emerald"); }}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-emerald"); addFiles(e.dataTransfer.files); }}
          className="border-2 border-dashed border-border rounded-lg p-8 text-center transition-colors"
        >
          <p className="text-text-secondary mb-3">Drag & drop videos here, or</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors text-sm">
              Select Files
            </button>
            <button onClick={() => folderInputRef.current?.click()} className="px-4 py-2 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:bg-surface-hover transition-colors text-sm">
              Select Folder
            </button>
          </div>
          <input ref={fileInputRef} type="file" multiple accept="video/*" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          {/* @ts-expect-error webkitdirectory is valid */}
          <input ref={folderInputRef} type="file" multiple webkitdirectory="true" directory="true" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-elevated text-sm">
                <span className="text-text-primary flex-1 truncate">{f.file.name}</span>
                <span className="text-text-tertiary text-xs">{formatBytes(f.file.size)}</span>
                {f.status === "uploading" && (
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-surface rounded-full overflow-hidden">
                      <div className="h-full bg-emerald rounded-full transition-all" style={{ width: `${f.progress}%` }} />
                    </div>
                    <span className="text-text-secondary text-xs w-10 text-right">{f.progress}%</span>
                    {f.speed > 0 && <span className="text-blue-400 text-xs">{formatSpeed(f.speed)}</span>}
                    {f.speed > 0 && <span className="text-text-tertiary text-xs">{formatEta(f)}</span>}
                  </div>
                )}
                {f.status === "done" && <span className="text-emerald text-xs">Done</span>}
                {f.status === "error" && <span className="text-red-400 text-xs" title={f.error || ""}>Failed</span>}
                {f.status === "queued" && (
                  <button onClick={() => removeFile(f.id)} className="text-text-tertiary hover:text-red-400 text-xs">Remove</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        {files.some((f) => f.status === "queued") && (
          <button
            onClick={startUpload}
            disabled={isUploading || !selectedTeam}
            className="mt-3 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50 text-sm"
          >
            {isUploading ? `Uploading... (${uploadedCount}/${files.length})` : `Upload ${files.filter((f) => f.status === "queued").length} files`}
          </button>
        )}

        {/* Overall upload progress */}
        {isUploading && (
          <div className="mt-3 p-3 rounded-lg bg-surface-elevated border border-border">
            <div className="flex justify-between text-xs text-text-secondary mb-1.5">
              <span>{uploadedCount} of {files.length} files uploaded</span>
              <span>{Math.round((uploadedCount / files.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
              <div className="h-full bg-emerald rounded-full transition-all" style={{ width: `${Math.round((uploadedCount / files.length) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Clip Settings */}
      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <label className="block text-sm font-semibold text-text-primary">Clip Settings</label>

        <div className="grid grid-cols-2 gap-4">
          {/* Clips per video */}
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Clips per video</label>
            <input
              type="number"
              min={1}
              max={100}
              value={options.numberOfVideos}
              onChange={(e) => setOptions({ ...options, numberOfVideos: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) })}
              className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary text-sm"
            />
          </div>

          {/* Style */}
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Style</label>
            <select
              value={options.promptType}
              onChange={(e) => setOptions({ ...options, promptType: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary text-sm"
            >
              <option value="viral">Viral</option>
              <option value="business">Business</option>
              <option value="general">General</option>
              <option value="gaming">Gaming</option>
            </select>
          </div>

          {/* Camera mode */}
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Camera mode</label>
            <select
              value={options.conversionMode}
              onChange={(e) => setOptions({ ...options, conversionMode: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary text-sm"
            >
              <option value="standard">Standard</option>
              <option value="facecam">Facecam</option>
              <option value="speaker-zoom">Speaker Zoom</option>
              <option value="center-crop">Center Crop</option>
              <option value="active-speaker">Active Speaker</option>
            </select>
          </div>

          {/* Clip length */}
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Clip length (s)</label>
            <input
              type="number"
              min={10}
              max={180}
              placeholder="AI decides"
              value={options.length ?? ""}
              onChange={(e) => setOptions({ ...options, length: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary text-sm"
            />
          </div>

          {/* Hook length */}
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Hook length (s)</label>
            <input
              type="number"
              min={2}
              max={15}
              placeholder="AI decides"
              value={options.hookLength ?? ""}
              onChange={(e) => setOptions({ ...options, hookLength: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary text-sm"
            />
          </div>
        </div>

        {/* Custom prompt */}
        <div>
          <label className="block text-xs text-text-tertiary mb-1">Custom prompt</label>
          <textarea
            placeholder="Optional custom instructions for clip selection..."
            value={options.textPrompt}
            onChange={(e) => setOptions({ ...options, textPrompt: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary text-sm resize-none"
          />
        </div>

        {/* Captions */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-text-primary">Captions</label>
            <button
              onClick={() => setOptions({ ...options, captions: !options.captions })}
              className={`w-10 h-5 rounded-full transition-colors relative ${options.captions ? "bg-emerald" : "bg-surface-elevated border border-border"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${options.captions ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {options.captions && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-tertiary mb-1.5">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setOptions({ ...options, captionColor: c.hex })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${options.captionColor === c.hex ? "border-emerald scale-110" : "border-border"}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1">Font</label>
                <select
                  value={options.captionFont}
                  onChange={(e) => setOptions({ ...options, captionFont: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary text-sm"
                >
                  {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Heading */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-text-primary">Auto Heading</label>
            <button
              onClick={() => setOptions({ ...options, autoHeading: !options.autoHeading })}
              className={`w-10 h-5 rounded-full transition-colors relative ${options.autoHeading ? "bg-emerald" : "bg-surface-elevated border border-border"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${options.autoHeading ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {options.autoHeading && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-tertiary mb-1">Heading instructions</label>
                <textarea
                  placeholder="Guide AI heading generation..."
                  value={options.headingInstructions}
                  onChange={(e) => setOptions({ ...options, headingInstructions: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">Style</label>
                  <select
                    value={options.textStyle}
                    onChange={(e) => setOptions({ ...options, textStyle: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary text-sm"
                  >
                    <option value="stroke">Stroke</option>
                    <option value="instagram">Instagram</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">Position</label>
                  <select
                    value={options.textPosition}
                    onChange={(e) => setOptions({ ...options, textPosition: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary text-sm"
                  >
                    <option value="top">Top</option>
                    <option value="middle">Middle</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">Font</label>
                  <select
                    value={options.textFont}
                    onChange={(e) => setOptions({ ...options, textFont: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary text-sm"
                  >
                    {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                {options.textStyle === "instagram" && (
                  <div>
                    <label className="block text-xs text-text-tertiary mb-1">BG Color</label>
                    <select
                      value={options.textBgColor}
                      onChange={(e) => setOptions({ ...options, textBgColor: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald outline-none text-text-primary text-sm"
                    >
                      <option value="">None</option>
                      <option value="black">Black</option>
                      <option value="white">White</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1.5">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setOptions({ ...options, textColor: c.hex })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${options.textColor === c.hex ? "border-emerald scale-110" : "border-border"}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Custom heading override */}
          <div className="mt-3">
            <label className="block text-xs text-text-tertiary mb-1">Custom heading text (overrides auto)</label>
            <input
              type="text"
              placeholder="Leave empty for AI-generated"
              value={options.customText}
              onChange={(e) => setOptions({ ...options, customText: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary text-sm"
            />
          </div>
        </div>
      </div>

      {/* Start button */}
      <div className="flex items-center justify-between">
        <p className="text-text-tertiary text-sm">
          {uploadedCount > 0
            ? `${uploadedCount} video${uploadedCount > 1 ? "s" : ""} ready · ${uploadedCount * options.numberOfVideos} clips will be generated`
            : "Upload videos to get started"}
        </p>
        <button
          onClick={handleStart}
          disabled={!canStart || startLoading}
          className="px-6 py-3 rounded-lg bg-emerald text-black font-bold hover:bg-emerald-light transition-colors disabled:opacity-50"
        >
          {startLoading ? "Starting..." : "Start Processing"}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const colors: Record<string, string> = {
    completed: "bg-emerald/10 border-emerald/20 text-emerald",
    failed: "bg-red-500/10 border-red-500/20 text-red-400",
    processing: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    pending: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  };

  const cls = colors[status] || colors.pending;
  const sizeClass = small ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span className={`inline-flex font-medium rounded-lg border ${cls} ${sizeClass}`}>
      {status}
    </span>
  );
}
