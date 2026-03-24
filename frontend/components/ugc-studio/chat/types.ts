export interface ChatAttachment {
  key: string;
  url: string;
  file?: File;
  uploading?: boolean;
}

export interface BRollShot {
  label: string;
  shotType: "CHARACTER" | "PRODUCT" | "CHARACTER_AND_PRODUCT";
}

export interface InitAgentResult {
  videoType: string;
  isSilent: boolean;
  character: boolean;
  targetAudience: string;
  structure: Array<{
    sceneType: string;
    slug: string;
    description: string;
    shots?: BRollShot[];
  }>;
}

export interface ScriptAgentShot {
  label: string;
  shotType: "CHARACTER" | "PRODUCT" | "CHARACTER_AND_PRODUCT";
  action: string;
  imageGenPrompt: string;
  cinematicPrompt: string;
  durationSeconds: number;
  productImageNeeded: boolean;
}

export interface ScriptAgentScene {
  sceneNumber: number;
  slug: string;
  sceneType: "a-roll" | "b-roll" | "visual";
  storyBeat: string;
  dialogue: string;
  isSilent: boolean;
  duration: number;
  action: string;
  imageGenPrompt: string;
  cinematicPrompt: string;
  ambientSound: string | null;
  shots: ScriptAgentShot[];
}

export interface ScriptAgentResult {
  title: string;
  targetAudience: string;
  totalDuration: number;
  scenes: ScriptAgentScene[];
}

export interface ChatVideoAttachment {
  name: string;
  preview?: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  videoAttachment?: ChatVideoAttachment;
  structureResult?: InitAgentResult;
  timestamp: Date;
}

export type ArtifactType = "character" | "voice" | "script";
