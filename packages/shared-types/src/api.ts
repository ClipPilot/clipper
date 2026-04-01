export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export type ClipStatus = "pending" | "completed" | "failed";

export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
