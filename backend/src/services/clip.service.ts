import { cutClip, mergeClips, addTextOverlay } from "./videoEditor.service";
import path from "path";
import fs from "fs";
import { ClipSuggestions } from "../types/ai.types";

export const createCombinedClipService = async (
  videoPath: string,
  clipData: ClipSuggestions
) => {
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  // Create temp files array to track all clips
  const tempFiles: string[] = [];

  // Cut the hook clip
  const hookPath = path.join(outDir, "hook_temp.mp4");
  await cutClip(videoPath, hookPath, clipData.hook.start, clipData.hook.end);
  tempFiles.push(hookPath);

  // Cut all main clips
  for (let i = 0; i < clipData.main.length; i++) {
    const mainClip = clipData.main[i];
    const mainPath = path.join(outDir, `main_${i}_temp.mp4`);
    await cutClip(videoPath, mainPath, mainClip.start, mainClip.end);
    tempFiles.push(mainPath);
  }

  // Merged clip (no text yet)
  const mergedPath = path.join(outDir, "merged_temp.mp4");

  // Merge all clips (hook + all main clips)
  await mergeClips(tempFiles, mergedPath);

  // Add text overlay with placeholder text and emojis
  const finalPath = path.join(outDir, "combined.mp4");
  const overlayText = "🔥 MUST WATCH 🔥";
  await addTextOverlay(mergedPath, finalPath, overlayText, "top");

  // Clean up temp files (including merged temp)
  tempFiles.push(mergedPath);
  tempFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  return finalPath;
};
