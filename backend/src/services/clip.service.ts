import { cutClip, mergeClips, addTextOverlay, addTextOverlayAtPosition } from "./videoEditor.service";
import path from "path";
import fs from "fs";
import { ClipSuggestions } from "../types/ai.types";
import { addCaptionsOverlay, TranscriptionWord, addCaptionsFromData } from "./captions.service";

export interface ClipServiceOptions {
  customText?: string;
  textPosition?: "top" | "bottom" | "middle";
  textColor?: string;
  captions?: boolean;
  captionColor?: string;
}

export interface CaptionEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface ClipResult {
  finalPath: string;
  blankPath: string;
  captionsData: CaptionEntry[];
  srtContent: string;
}

const formatSrtTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

const generateCaptionsData = (
  clipData: ClipSuggestions,
  words: TranscriptionWord[]
): { captionsData: CaptionEntry[]; srtContent: string } => {
  const captionsData: CaptionEntry[] = [];
  const WORDS_PER_GROUP = 4;
  let offset = 0;
  let index = 1;

  const allSegments = [clipData.hook, ...clipData.main];

  for (const segment of allSegments) {
    const segmentWords = words.filter(
      (w) => w.start >= segment.start && w.end <= segment.end
    );

    for (let i = 0; i < segmentWords.length; i += WORDS_PER_GROUP) {
      const group = segmentWords.slice(i, i + WORDS_PER_GROUP);
      if (group.length === 0) continue;

      const startTime = offset + (group[0].start - segment.start);
      const endTime = offset + (group[group.length - 1].end - segment.start);
      const text = group.map((w) => w.punctuated_word || "").join(" ");

      captionsData.push({ index, startTime, endTime, text });
      index++;
    }

    offset += segment.end - segment.start;
  }

  const srtContent = captionsData
    .map(
      (entry) =>
        `${entry.index}\n${formatSrtTime(entry.startTime)} --> ${formatSrtTime(entry.endTime)}\n${entry.text}\n`
    )
    .join("\n");

  return { captionsData, srtContent };
};

export const createCombinedClipService = async (
  videoPath: string,
  clipData: ClipSuggestions,
  transcriptionWords: TranscriptionWord[],
  options: ClipServiceOptions = {},
  videoIndex: number = 0
): Promise<ClipResult> => {
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

  const blankPath = path.join(outDir, `blank_${videoIndex}.mp4`);
  fs.copyFileSync(mergedPath, blankPath);

  const { captionsData, srtContent } = generateCaptionsData(
    clipData,
    transcriptionWords
  );

  const finalPath = path.join(outDir, `combined_${videoIndex}.mp4`);

  if (options.captions) {
    await addCaptionsOverlay(
      mergedPath,
      finalPath,
      clipData,
      transcriptionWords,
      options.captionColor
    );
  } else if (options.customText) {
    const position = options.textPosition || "top";
    const mappedPosition = position === "middle" ? "center" : position;
    const fillColor = options.textColor || "#FFFFFF";
    const strokeColor = "#000000";
    await addTextOverlay(
      mergedPath,
      finalPath,
      options.customText,
      mappedPosition,
      fillColor,
      strokeColor
    );
  } else {
    fs.copyFileSync(mergedPath, finalPath);
  }

  tempFiles.push(mergedPath);
  tempFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  return { finalPath, blankPath, captionsData, srtContent };
};

export const createMultipleCombinedClipsService = async (
  videoPath: string,
  clipDataArray: ClipSuggestions[],
  transcriptionWords: TranscriptionWord[],
  options: ClipServiceOptions = {}
): Promise<ClipResult[]> => {
  const results: ClipResult[] = [];

  for (let i = 0; i < clipDataArray.length; i++) {
    console.log(`Creating clip ${i + 1} of ${clipDataArray.length}...`);
    const result = await createCombinedClipService(
      videoPath,
      clipDataArray[i],
      transcriptionWords,
      options,
      i
    );
    results.push(result);
  }

  return results;
};

export const regenerateClipWithCaptions = async (
  blankVideoPath: string,
  captionsData: CaptionEntry[],
  captionColor: string = "#FFD600"
): Promise<string> => {
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const outputPath = path.join(outDir, `regenerated_${Date.now()}.mp4`);
  await addCaptionsFromData(blankVideoPath, outputPath, captionsData, captionColor);

  return outputPath;
};

export interface TextOverlayOptions {
  text: string;
  color: string;
  x: number;
  y: number;
  fontSize: number;
}

export const regenerateClipWithTextOverlay = async (
  blankVideoPath: string,
  overlay: TextOverlayOptions
): Promise<string> => {
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const outputPath = path.join(outDir, `text_overlay_${Date.now()}.mp4`);
  await addTextOverlayAtPosition(
    blankVideoPath,
    outputPath,
    overlay.text,
    overlay.x,
    overlay.y,
    overlay.fontSize,
    overlay.color,
    "#000000"
  );

  return outputPath;
};
