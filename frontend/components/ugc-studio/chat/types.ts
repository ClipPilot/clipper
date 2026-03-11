export interface ChatAttachment {
  key: string;
  url: string;
  file?: File;
}

export interface BRollShot {
  label: string;
  shotType: "CHARACTER" | "PRODUCT" | "CHARACTER_AND_PRODUCT";
}

export interface InitAgentResult {
  videoType: string;
  isSilent: boolean;
  character: boolean;
  structure: Array<{
    sceneType: string;
    slug: string;
    description: string;
    shots?: BRollShot[];
  }>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  structureResult?: InitAgentResult;
  timestamp: Date;
}

export type ArtifactType = "character" | "voice" | "under-construction";
