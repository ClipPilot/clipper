import { cutClip, mergeClips, addTextOverlay } from "./videoEditor.service";
import path from "path";
import fs from "fs";
import { ClipSuggestions } from "../types/ai.types";

export interface ClipServiceOptions {
  customText?: string;
  textPosition?: "top" | "bottom" | "middle";
  textColor?: string;
}

export const createCombinedClipService = async (
  videoPath: string,
  clipData: ClipSuggestions,
  options: ClipServiceOptions = {},
  videoIndex: number = 0
) => {
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const tempFiles: string[] = [];
  const hookPath = path.join(outDir, `hook_${videoIndex}_temp.mp4`);
  await cutClip(videoPath, hookPath, clipData.hook.start, clipData.hook.end);
  tempFiles.push(hookPath);

  for (let i = 0; i < clipData.main.length; i++) {
    const mainClip = clipData.main[i];
    const mainPath = path.join(outDir, `main_${videoIndex}_${i}_temp.mp4`);
    await cutClip(videoPath, mainPath, mainClip.start, mainClip.end);
    tempFiles.push(mainPath);
  }

  const mergedPath = path.join(outDir, `merged_${videoIndex}_temp.mp4`);
  await mergeClips(tempFiles, mergedPath);

  const finalPath = path.join(outDir, `combined_${videoIndex}.mp4`);

  if (options.customText) {
    const position = options.textPosition || "top";
    const mappedPosition = position === "middle" ? "center" : position;
    const fillColor = options.textColor || "#FFFFFF";
    const strokeColor = "#000000";
    await addTextOverlay(mergedPath, finalPath, options.customText, mappedPosition, fillColor, strokeColor);
  } else {
    fs.copyFileSync(mergedPath, finalPath);
  }
  tempFiles.push(mergedPath);
  tempFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  return finalPath;
};

export const createMultipleCombinedClipsService = async (
  videoPath: string,
  clipDataArray: ClipSuggestions[],
  options: ClipServiceOptions = {}
): Promise<string[]> => {
  const clipPaths: string[] = [];

  for (let i = 0; i < clipDataArray.length; i++) {
    console.log(`Creating clip ${i + 1} of ${clipDataArray.length}...`);
    const clipPath = await createCombinedClipService(videoPath, clipDataArray[i], options, i);
    clipPaths.push(clipPath);
  }

  return clipPaths;
};
