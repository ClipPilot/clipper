import path from "path";
import fs from "fs";
import {
  getGeminiClient,
  getGeminiHelpers,
  uploadVideoToGemini,
  cleanupGeminiResources,
  generateContent,
  generateContentWithVideo,
  GeminiUploadedFile,
  GeminiVideoUploadResult,
  GeminiGenerateOptions,
} from "./gemini.service";
