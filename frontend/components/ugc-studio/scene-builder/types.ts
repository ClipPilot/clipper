import type { UGCScene } from "../script/types";

export interface SupportingImage {
  key: string;
  url: string;
  file?: File;
}

export interface SceneImageGeneration {
  jobId: string;
  status: "queued" | "generating" | "regenerating" | "completed" | "failed";
  progress: number;
  progressMessage: string;
  generatedImages?: GeneratedImage[];
  error?: string;
}

export interface GeneratedImage {
  key: string;
  url: string;
  index: number;
}

export interface SceneBuilderScene extends UGCScene {
  userRefinement?: string;
  supportingImages?: SupportingImage[];
  generation?: SceneImageGeneration;
  imageKey?: string;
  imageUrl?: string;
}
