export interface UploadedFile {
  file: File;
  preview: string;
}

export interface SpliceSegment {
  url: string;
  type: "processed" | "original";
  start: number;
  end: number;
}

export interface FaceSwapJob {
  id: string;
  status: "uploading" | "pending_upload" | "queued" | "running" | "completed" | "failed";
  progress: number | null;
  progressMessage: string | null;
  outputUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
  spliceSegments?: SpliceSegment[] | null;
  clipId?: number | null;
  title?: string | null;
  shareToken?: string | null;
}

export interface SelectedCharacter {
  type: "example" | "uploaded" | "saved";
  src: string;
  file?: File;
  savedFaceId?: number;
  imageKey?: string;
  voiceId?: string;
  voiceName?: string;
}

export const EXAMPLE_CHARACTERS = [
  { id: 1, src: "/characters/1.jpg" },
  { id: 2, src: "/characters/2.jpg" },
  { id: 3, src: "/characters/3.jpg" },
  { id: 4, src: "/characters/4.jpg" },
  { id: 5, src: "/characters/5.jpg" },
  { id: 6, src: "/characters/6.jpg" },
  { id: 7, src: "/characters/7.jpg" },
  { id: 8, src: "/characters/8.jpg" },
  { id: 9, src: "/characters/9.jpg" },
  { id: 10, src: "/characters/10.jpg" },
  { id: 11, src: "/characters/11.jpg" },
  { id: 12, src: "/characters/12.jpg" },
];

export function getStatusColor(status: FaceSwapJob["status"]) {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "running":
    case "uploading":
    case "pending_upload":
      return "primary";
    default:
      return "default";
  }
}

export function getStatusIcon(status: FaceSwapJob["status"]) {
  switch (status) {
    case "completed":
      return "solar:check-circle-bold";
    case "failed":
      return "solar:close-circle-bold";
    case "running":
      return "solar:refresh-circle-bold-duotone";
    case "uploading":
    case "pending_upload":
      return "solar:upload-bold-duotone";
    default:
      return "solar:clock-circle-bold";
  }
}

export function formatDuration(start: string, end: string | null): string {
  if (!end) return "In progress";
  const duration = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
  if (duration < 60) return `${Math.round(duration)}s`;
  return `${Math.floor(duration / 60)}m ${Math.round(duration % 60)}s`;
}
