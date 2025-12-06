import { cutClip, mergeClips } from "./videoEditor.service";
import path from "path";
import fs from "fs";
import { ClipSuggestions } from "../types/ai.types";

export const createCombinedClipService = async (videoPath: string, clipData: ClipSuggestions) => {
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  // Create temp files
  const hookPath = path.join(outDir, "hook_temp.mp4");
  const mainPath = path.join(outDir, "main_temp.mp4");

  await cutClip(videoPath, hookPath, clipData.hook.start, clipData.hook.end);
  await cutClip(videoPath, mainPath, clipData.main.start, clipData.main.end);

  // Final combined clip
  const finalPath = path.join(outDir, "combined.mp4");

  await mergeClips([hookPath, mainPath], finalPath);

  // Optional: remove temp files
  fs.unlinkSync(hookPath);
  fs.unlinkSync(mainPath);

  return finalPath;
};
