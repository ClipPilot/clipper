import {
  cutClip,
  mergeClips,
  convertToVertical,
  addTextOverlay,
  addTextOverlayAtPosition,
  addPreviewWatermark,
  mixBackgroundMusic,
} from "./videoEditor.service";
import type { FacecamRegion } from "./videoEditor.service";
import type { ConversionMode } from "../../constants/conversionModes";
import type { ActiveSpeakerSegment } from "./speakerSegments.service";
import path from "path";
import fs from "fs";
import { ClipSuggestions, BatchClipSuggestions } from "../../types/ai.types";
import {
  addCaptionsOverlay,
  TranscriptionWord,
  addCaptionsFromData,
} from "./captions.service";
import { applyJumbledMetadata } from "../../utils/videoMetadata";
import { s3Service } from "../s3.service";

// Batch video source for multi-video clip creation
export interface BatchVideoSource {
  videoIndex: number;
  localPath: string;
  transcriptionWords: TranscriptionWord[];
}

export interface ClipServiceOptions {
  customText?: string;
  textPosition?: "top" | "bottom" | "middle";
  textColor?: string;
  textFont?: string;
  textStyle?: "stroke" | "instagram";
  captions?: boolean;
  captionColor?: string;
  captionFont?: string;
  conversionMode?: ConversionMode;
  backgroundMusicS3Key?: string;
  facecamRegion?: FacecamRegion | null;
  activeSpeakerSegments?: ActiveSpeakerSegment[];
  speakerFaceMap?: Map<number, FacecamRegion>;
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
  watermarkedPath: string;
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

const MIN_SEGMENT_DURATION = 0.25;

const validateSegment = (
  segment: { start: number; end: number; text: string },
  name: string
) => {
  if (typeof segment.start !== "number" || typeof segment.end !== "number") {
    throw new Error(
      `${name}: Invalid timestamp types - start: ${typeof segment.start}, end: ${typeof segment.end}`
    );
  }
  if (segment.start < 0) {
    throw new Error(
      `${name}: Start timestamp cannot be negative (${segment.start})`
    );
  }
  if (segment.end <= segment.start) {
    throw new Error(
      `${name}: End (${segment.end}) must be greater than start (${segment.start})`
    );
  }
  const duration = segment.end - segment.start;
  if (duration < MIN_SEGMENT_DURATION) {
    throw new Error(
      `${name}: Segment too short (${duration.toFixed(2)}s) - minimum is ${MIN_SEGMENT_DURATION}s`
    );
  }
};

export const createCombinedClipService = async (
  videoPath: string,
  clipData: ClipSuggestions,
  transcriptionWords: TranscriptionWord[],
  options: ClipServiceOptions = {},
  videoIndex: number = 0,
  onMergedRaw?: (localPath: string) => Promise<ClipServiceOptions | null>,
): Promise<ClipResult> => {
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const tempFiles: string[] = [];
  const jobId = Date.now();

  // Log and validate all segments
  console.log(
    `[Clip ${videoIndex}] Hook: ${clipData.hook.start}s - ${clipData.hook.end}s (${(clipData.hook.end - clipData.hook.start).toFixed(1)}s)`
  );
  validateSegment(clipData.hook, "Hook");

  // Guard against the AI returning main with ONLY the hook repeated (no build-up).
  // The hook→buildup→climax-again structure is fine, but hook→hook-only is broken.
  const hookStart = clipData.hook.start;
  const hookEnd = clipData.hook.end;
  const hasNonHookSegment = clipData.main.some((seg) => {
    const overlapStart = Math.max(seg.start, hookStart);
    const overlapEnd = Math.min(seg.end, hookEnd);
    const overlapDuration = Math.max(0, overlapEnd - overlapStart);
    const segDuration = seg.end - seg.start;
    return segDuration <= 0 || overlapDuration / segDuration < 0.5;
  });
  if (!hasNonHookSegment && clipData.main.length > 0) {
    // Every main segment is just the hook repeated — drop the duplicates
    console.log(
      `[Clip ${videoIndex}] All main segments overlap with hook — dropping duplicates to prevent double-hook`
    );
    clipData.main = clipData.main.filter((seg) => {
      const overlapStart = Math.max(seg.start, hookStart);
      const overlapEnd = Math.min(seg.end, hookEnd);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);
      const segDuration = seg.end - seg.start;
      return segDuration <= 0 || overlapDuration / segDuration < 0.5;
    });
  }

  for (let i = 0; i < clipData.main.length; i++) {
    const seg = clipData.main[i];
    console.log(
      `[Clip ${videoIndex}] Main[${i}]: ${seg.start}s - ${seg.end}s (${(seg.end - seg.start).toFixed(1)}s)`
    );
    validateSegment(seg, `Main[${i}]`);
  }

  const hookPath = path.join(outDir, `hook_${jobId}_${videoIndex}_temp.mp4`);
  await cutClip(videoPath, hookPath, clipData.hook.start, clipData.hook.end);
  tempFiles.push(hookPath);

  for (let i = 0; i < clipData.main.length; i++) {
    const mainClip = clipData.main[i];
    const mainPath = path.join(outDir, `main_${jobId}_${videoIndex}_${i}_temp.mp4`);
    await cutClip(videoPath, mainPath, mainClip.start, mainClip.end);
    tempFiles.push(mainPath);
  }

  const mergedRawPath = path.join(outDir, `merged_raw_${jobId}_${videoIndex}_temp.mp4`);
  await mergeClips(tempFiles, mergedRawPath);

  // Validate merged file before proceeding
  if (!fs.existsSync(mergedRawPath) || fs.statSync(mergedRawPath).size < 1024) {
    throw new Error(`Merged clip is missing or too small (${mergedRawPath})`);
  }

  // If callback provided, run per-clip detection on the merged horizontal clip
  // and override facecam/active-speaker options with the result
  if (onMergedRaw) {
    const detected = await onMergedRaw(mergedRawPath);
    if (detected) {
      if (detected.facecamRegion !== undefined) options.facecamRegion = detected.facecamRegion;
      if (detected.activeSpeakerSegments) options.activeSpeakerSegments = detected.activeSpeakerSegments;
      if (detected.speakerFaceMap) options.speakerFaceMap = detected.speakerFaceMap;
    }
  }

  // Convert horizontal videos to 9:16 using selected conversion mode
  const mergedPath = path.join(outDir, `merged_${jobId}_${videoIndex}_temp.mp4`);
  const activeSpeakerOpts = (options.activeSpeakerSegments && options.speakerFaceMap)
    ? { segments: options.activeSpeakerSegments, speakerFaceMap: options.speakerFaceMap }
    : null;
  await convertToVertical(mergedRawPath, mergedPath, options.conversionMode, options.facecamRegion, activeSpeakerOpts);
  if (fs.existsSync(mergedRawPath) && mergedRawPath !== mergedPath) {
    fs.unlinkSync(mergedRawPath);
  }

  const blankPath = path.join(outDir, `blank_${jobId}_${videoIndex}.mp4`);
  fs.copyFileSync(mergedPath, blankPath);

  const { captionsData, srtContent } = generateCaptionsData(
    clipData,
    transcriptionWords
  );

  const finalPath = path.join(outDir, `combined_${jobId}_${videoIndex}.mp4`);

  let currentVideoPath = mergedPath;

  // Step 1: Apply heading (customText) if provided
  if (options.customText) {
    const headingPath = path.join(outDir, `heading_${jobId}_${videoIndex}_temp.mp4`);
    const position = options.textPosition || "top";
    const mappedPosition = position === "middle" ? "center" : position;
    const fillColor = options.textColor || "#FFFFFF";
    const strokeColor = "#000000";
    const fontName = options.textFont || "Montserrat";
    const textStyle = options.textStyle || "stroke";
    await addTextOverlay(
      currentVideoPath,
      headingPath,
      options.customText,
      mappedPosition,
      fillColor,
      strokeColor,
      fontName,
      textStyle,
    );
    currentVideoPath = headingPath;
    tempFiles.push(headingPath);
  }

  // Step 1b: Mix background music if provided
  if (options.backgroundMusicS3Key) {
    const musicTempPath = path.join(outDir, `music_${jobId}_${videoIndex}_temp.mp3`);
    const musicMixedPath = path.join(outDir, `music_mixed_${jobId}_${videoIndex}_temp.mp4`);
    try {
      await s3Service.downloadFile(options.backgroundMusicS3Key, musicTempPath);
      await mixBackgroundMusic(currentVideoPath, musicTempPath, musicMixedPath, {
        originalVolume: 1,
        musicVolume: 0.3,
        musicStartTime: 0,
        musicTrimStart: 0,
        musicTrimEnd: 60,
      });
      currentVideoPath = musicMixedPath;
      tempFiles.push(musicMixedPath);
    } catch (musicErr) {
      console.warn(`[Clip ${videoIndex}] Background music mixing failed, skipping:`, musicErr);
    } finally {
      if (fs.existsSync(musicTempPath)) fs.unlinkSync(musicTempPath);
    }
  }

  // Step 2: Apply captions on top if enabled
  if (options.captions) {
    await addCaptionsOverlay(
      currentVideoPath,
      finalPath,
      clipData,
      transcriptionWords,
      options.captionColor,
      options.captionFont
    );
  } else {
    // No captions - copy current video to final path
    fs.copyFileSync(currentVideoPath, finalPath);
  }

  // Step 3: Apply jumbled metadata to final video
  const metadataPath = path.join(outDir, `metadata_${jobId}_${videoIndex}_temp.mp4`);
  await applyJumbledMetadata(finalPath, metadataPath);
  fs.renameSync(metadataPath, finalPath);

  const watermarkedPath = path.join(outDir, `watermarked_${jobId}_${videoIndex}.mp4`);
  fs.copyFileSync(finalPath, watermarkedPath);

  tempFiles.push(mergedPath);
  tempFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  return { finalPath, blankPath, watermarkedPath, captionsData, srtContent };
};

const processWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  const pending = items.map((item, index) => ({ item, index }));

  const runWorker = async () => {
    while (pending.length > 0) {
      const task = pending.shift();
      if (!task) break;
      results[task.index] = await processor(task.item, task.index);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker()
  );

  await Promise.all(workers);
  return results;
};

export const createMultipleCombinedClipsService = async (
  videoPath: string,
  clipDataArray: ClipSuggestions[],
  transcriptionWords: TranscriptionWord[],
  options: ClipServiceOptions = {}
): Promise<ClipResult[]> => {
  const CONCURRENCY = 2;
  console.log(
    `Creating ${clipDataArray.length} clips with concurrency of ${CONCURRENCY}...`
  );

  return processWithConcurrency(
    clipDataArray,
    CONCURRENCY,
    async (clipData, i) => {
      console.log(`Creating clip ${i + 1} of ${clipDataArray.length}...`);
      return createCombinedClipService(
        videoPath,
        clipData,
        transcriptionWords,
        options,
        i
      );
    }
  );
};

export const regenerateClipWithCaptions = async (
  blankVideoPath: string,
  captionsData: CaptionEntry[],
  captionColor: string = "#FFD600",
  captionFont: string = "Montserrat"
): Promise<string> => {
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const outputPath = path.join(outDir, `regenerated_${Date.now()}.mp4`);
  await addCaptionsFromData(
    blankVideoPath,
    outputPath,
    captionsData,
    captionColor,
    captionFont
  );

  return outputPath;
};

export interface TextOverlayOptions {
  text: string;
  color: string;
  font: string;
  x: number;
  y: number;
  fontSize: number;
  style?: "stroke" | "instagram";
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
    "#000000",
    overlay.font,
    overlay.style || "stroke"
  );

  return outputPath;
};

/**
 * Generate captions data from batch clip suggestions using multiple source videos
 */
const generateBatchCaptionsData = (
  clipData: BatchClipSuggestions,
  videoSources: BatchVideoSource[]
): { captionsData: CaptionEntry[]; srtContent: string } => {
  const captionsData: CaptionEntry[] = [];
  const WORDS_PER_GROUP = 4;
  let offset = 0;
  let index = 1;

  const allSegments = [clipData.hook, ...clipData.main];

  for (const segment of allSegments) {
    // Find the source video for this segment
    const source = videoSources.find(
      (v) => v.videoIndex === segment.sourceVideoIndex
    );
    if (!source) {
      console.warn(
        `Source video ${segment.sourceVideoIndex} not found for segment, skipping captions`
      );
      offset += segment.end - segment.start;
      continue;
    }

    const segmentWords = source.transcriptionWords.filter(
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

/**
 * Create a combined clip from multiple source videos
 * Each segment can come from a different source video identified by sourceVideoIndex
 */
export const createBatchCombinedClipService = async (
  videoSources: BatchVideoSource[],
  clipData: BatchClipSuggestions,
  options: ClipServiceOptions = {},
  outputIndex: number = 0,
  onMergedRaw?: (localPath: string) => Promise<ClipServiceOptions | null>,
): Promise<ClipResult> => {
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const tempFiles: string[] = [];
  const jobId = Date.now();

  // Cut hook from its source video
  const hookSource = videoSources.find(
    (v) => v.videoIndex === clipData.hook.sourceVideoIndex
  );
  if (!hookSource) {
    throw new Error(
      `Source video ${clipData.hook.sourceVideoIndex} not found for hook`
    );
  }

  const hookPath = path.join(outDir, `batch_hook_${jobId}_${outputIndex}_temp.mp4`);
  await cutClip(
    hookSource.localPath,
    hookPath,
    clipData.hook.start,
    clipData.hook.end
  );
  tempFiles.push(hookPath);

  // Guard against main with ONLY the hook repeated (same source video)
  const batchHookStart = clipData.hook.start;
  const batchHookEnd = clipData.hook.end;
  const batchHookSource = clipData.hook.sourceVideoIndex;
  const batchHasNonHookSegment = clipData.main.some((seg) => {
    if (seg.sourceVideoIndex !== batchHookSource) return true;
    const overlapStart = Math.max(seg.start, batchHookStart);
    const overlapEnd = Math.min(seg.end, batchHookEnd);
    const overlapDuration = Math.max(0, overlapEnd - overlapStart);
    const segDuration = seg.end - seg.start;
    return segDuration <= 0 || overlapDuration / segDuration < 0.5;
  });
  if (!batchHasNonHookSegment && clipData.main.length > 0) {
    console.log(
      `[Batch Clip ${outputIndex}] All main segments overlap with hook — dropping duplicates`
    );
    clipData.main = clipData.main.filter((seg) => {
      if (seg.sourceVideoIndex !== batchHookSource) return true;
      const overlapStart = Math.max(seg.start, batchHookStart);
      const overlapEnd = Math.min(seg.end, batchHookEnd);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);
      const segDuration = seg.end - seg.start;
      return segDuration <= 0 || overlapDuration / segDuration < 0.5;
    });
  }

  // Cut main segments from their respective source videos
  for (let i = 0; i < clipData.main.length; i++) {
    const mainClip = clipData.main[i];
    const mainSource = videoSources.find(
      (v) => v.videoIndex === mainClip.sourceVideoIndex
    );
    if (!mainSource) {
      throw new Error(
        `Source video ${mainClip.sourceVideoIndex} not found for main segment ${i}`
      );
    }

    const mainPath = path.join(
      outDir,
      `batch_main_${jobId}_${outputIndex}_${i}_temp.mp4`
    );
    await cutClip(mainSource.localPath, mainPath, mainClip.start, mainClip.end);
    tempFiles.push(mainPath);
  }

  // Merge all clips
  const mergedRawPath = path.join(outDir, `batch_merged_raw_${jobId}_${outputIndex}_temp.mp4`);
  await mergeClips(tempFiles, mergedRawPath);

  // If callback provided, run per-clip detection on the merged horizontal clip
  if (onMergedRaw) {
    const detected = await onMergedRaw(mergedRawPath);
    if (detected) {
      if (detected.facecamRegion !== undefined) options.facecamRegion = detected.facecamRegion;
      if (detected.activeSpeakerSegments) options.activeSpeakerSegments = detected.activeSpeakerSegments;
      if (detected.speakerFaceMap) options.speakerFaceMap = detected.speakerFaceMap;
    }
  }

  // Convert horizontal videos to 9:16 using selected conversion mode
  const mergedPath = path.join(outDir, `batch_merged_${jobId}_${outputIndex}_temp.mp4`);
  const batchActiveSpeakerOpts = (options.activeSpeakerSegments && options.speakerFaceMap)
    ? { segments: options.activeSpeakerSegments, speakerFaceMap: options.speakerFaceMap }
    : null;
  await convertToVertical(mergedRawPath, mergedPath, options.conversionMode, options.facecamRegion, batchActiveSpeakerOpts);
  if (fs.existsSync(mergedRawPath) && mergedRawPath !== mergedPath) {
    fs.unlinkSync(mergedRawPath);
  }

  const blankPath = path.join(outDir, `batch_blank_${jobId}_${outputIndex}.mp4`);
  fs.copyFileSync(mergedPath, blankPath);

  const { captionsData, srtContent } = generateBatchCaptionsData(
    clipData,
    videoSources
  );

  const finalPath = path.join(outDir, `batch_combined_${jobId}_${outputIndex}.mp4`);

  let currentVideoPath = mergedPath;

  // Step 1: Apply heading (customText) if provided
  if (options.customText) {
    const headingPath = path.join(
      outDir,
      `batch_heading_${jobId}_${outputIndex}_temp.mp4`
    );
    const position = options.textPosition || "top";
    const mappedPosition = position === "middle" ? "center" : position;
    const fillColor = options.textColor || "#FFFFFF";
    const strokeColor = "#000000";
    const fontName = options.textFont || "Montserrat";
    const textStyle = options.textStyle || "stroke";
    await addTextOverlay(
      currentVideoPath,
      headingPath,
      options.customText,
      mappedPosition,
      fillColor,
      strokeColor,
      fontName,
      textStyle,
    );
    currentVideoPath = headingPath;
    tempFiles.push(headingPath);
  }

  // Step 1b: Mix background music if provided
  if (options.backgroundMusicS3Key) {
    const musicTempPath = path.join(outDir, `batch_music_${jobId}_${outputIndex}_temp.mp3`);
    const musicMixedPath = path.join(outDir, `batch_music_mixed_${jobId}_${outputIndex}_temp.mp4`);
    try {
      await s3Service.downloadFile(options.backgroundMusicS3Key, musicTempPath);
      await mixBackgroundMusic(currentVideoPath, musicTempPath, musicMixedPath, {
        originalVolume: 1,
        musicVolume: 0.3,
        musicStartTime: 0,
        musicTrimStart: 0,
        musicTrimEnd: 60,
      });
      currentVideoPath = musicMixedPath;
      tempFiles.push(musicMixedPath);
    } catch (musicErr) {
      console.warn(`[Batch Clip ${outputIndex}] Background music mixing failed, skipping:`, musicErr);
    } finally {
      if (fs.existsSync(musicTempPath)) fs.unlinkSync(musicTempPath);
    }
  }

  // Step 2: Apply captions on top if enabled
  if (options.captions && captionsData.length > 0) {
    await addCaptionsFromData(
      currentVideoPath,
      finalPath,
      captionsData,
      options.captionColor,
      options.captionFont
    );
  } else {
    // No captions - copy current video to final path
    fs.copyFileSync(currentVideoPath, finalPath);
  }

  // Step 3: Apply jumbled metadata to final video
  const metadataPath = path.join(
    outDir,
    `batch_metadata_${jobId}_${outputIndex}_temp.mp4`
  );
  await applyJumbledMetadata(finalPath, metadataPath);
  fs.renameSync(metadataPath, finalPath);

  const watermarkedPath = path.join(
    outDir,
    `batch_watermarked_${jobId}_${outputIndex}.mp4`
  );
  // WATERMARK DISABLED - just copy the file
  fs.copyFileSync(finalPath, watermarkedPath);

  tempFiles.push(mergedPath);
  tempFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  return { finalPath, blankPath, watermarkedPath, captionsData, srtContent };
};

/**
 * Create multiple batch clips from multiple source videos
 */
export const createMultipleBatchClipsService = async (
  videoSources: BatchVideoSource[],
  clipDataArray: BatchClipSuggestions[],
  options: ClipServiceOptions = {}
): Promise<ClipResult[]> => {
  const CONCURRENCY = 2;
  console.log(
    `Creating ${clipDataArray.length} batch clips with concurrency of ${CONCURRENCY}...`
  );

  return processWithConcurrency(
    clipDataArray,
    CONCURRENCY,
    async (clipData, i) => {
      console.log(`Creating batch clip ${i + 1} of ${clipDataArray.length}...`);
      return createBatchCombinedClipService(videoSources, clipData, options, i);
    }
  );
};
