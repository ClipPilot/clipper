import { cutClip, mergeClips, addTextOverlay } from "./videoEditor.service";
import path from "path";
import fs from "fs";
import { ClipSuggestions } from "../types/ai.types";

export interface ClipServiceOptions {
  customText?: string;
  textPosition?: "top" | "bottom";
}

export const createCombinedClipService = async (
  videoPath: string,
  clipData: ClipSuggestions,
  options: ClipServiceOptions = {}
) => {
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const tempFiles: string[] = [];
  const hookPath = path.join(outDir, "hook_temp.mp4");
  await cutClip(videoPath, hookPath, clipData.hook.start, clipData.hook.end);
  tempFiles.push(hookPath);
  for (let i = 0; i < clipData.main.length; i++) {
    const mainClip = clipData.main[i];
    const mainPath = path.join(outDir, `main_${i}_temp.mp4`);
    await cutClip(videoPath, mainPath, mainClip.start, mainClip.end);
    tempFiles.push(mainPath);
  }
  const mergedPath = path.join(outDir, "merged_temp.mp4");
  await mergeClips(tempFiles, mergedPath);

  // Add text overlay if provided
  const finalPath = path.join(outDir, "combined.mp4");

  if (options.customText) {
    const position = options.textPosition || "top";
    await addTextOverlay(mergedPath, finalPath, options.customText, position);
  } else {
    // No text overlay, just copy the merged file
    fs.copyFileSync(mergedPath, finalPath);
  }

  // Clean up temp files
  tempFiles.push(mergedPath);
  tempFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  return finalPath;
};
