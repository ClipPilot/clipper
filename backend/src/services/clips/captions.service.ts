import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { ClipSuggestions } from "../../types/ai.types";

// Mobile-compatible H.264 encoding settings
const MOBILE_VIDEO_SETTINGS = [
  "-profile:v main",
  "-level 4.0",
  "-pix_fmt yuv420p",
  "-r 30",
  "-g 30",
  "-keyint_min 30",
  "-vsync cfr",
];


export interface TranscriptionWord {
  start: number;
  end: number;
  punctuated_word?: string | undefined;
}

export interface CaptionEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

const WORDS_PER_GROUP = 4;

const FONT_NAME_MAP: Record<string, string> = {
  "Luckiest Guy": "Luckiest Guy",
  "Montserrat": "Montserrat",
  "Everlasting": "Everlasting",
  "Komika": "Komika Hand",
  "Burbank": "Burbank Big Regular",
  "Bebas Neue": "Bebas Neue",
  "Anton": "Anton",
  "Noto Sans Devanagari": "Noto Sans Devanagari",
};

// Script detection patterns and their fallback fonts
// Uses Noto Sans family which provides comprehensive Unicode coverage
const SCRIPT_FONT_MAP: Array<{ pattern: RegExp; font: string }> = [
  // Indic scripts
  { pattern: /[\u0900-\u097F]/, font: "Noto Sans Devanagari" },     // Devanagari (Hindi, Sanskrit, Marathi)
  { pattern: /[\u0980-\u09FF]/, font: "Noto Sans Bengali" },        // Bengali, Assamese
  { pattern: /[\u0A00-\u0A7F]/, font: "Noto Sans Gurmukhi" },       // Punjabi
  { pattern: /[\u0A80-\u0AFF]/, font: "Noto Sans Gujarati" },       // Gujarati
  { pattern: /[\u0B00-\u0B7F]/, font: "Noto Sans Oriya" },          // Odia
  { pattern: /[\u0B80-\u0BFF]/, font: "Noto Sans Tamil" },          // Tamil
  { pattern: /[\u0C00-\u0C7F]/, font: "Noto Sans Telugu" },         // Telugu
  { pattern: /[\u0C80-\u0CFF]/, font: "Noto Sans Kannada" },        // Kannada
  { pattern: /[\u0D00-\u0D7F]/, font: "Noto Sans Malayalam" },      // Malayalam
  { pattern: /[\u0D80-\u0DFF]/, font: "Noto Sans Sinhala" },        // Sinhala

  // East Asian scripts
  { pattern: /[\u4E00-\u9FFF\u3400-\u4DBF]/, font: "Noto Sans SC" }, // Chinese (Simplified)
  { pattern: /[\u3040-\u309F\u30A0-\u30FF]/, font: "Noto Sans JP" }, // Japanese Hiragana/Katakana
  { pattern: /[\uAC00-\uD7AF\u1100-\u11FF]/, font: "Noto Sans KR" }, // Korean Hangul

  // Southeast Asian scripts
  { pattern: /[\u0E00-\u0E7F]/, font: "Noto Sans Thai" },           // Thai
  { pattern: /[\u0E80-\u0EFF]/, font: "Noto Sans Lao" },            // Lao
  { pattern: /[\u0F00-\u0FFF]/, font: "Noto Sans Tibetan" },        // Tibetan
  { pattern: /[\u1000-\u109F]/, font: "Noto Sans Myanmar" },        // Myanmar
  { pattern: /[\u1780-\u17FF]/, font: "Noto Sans Khmer" },          // Khmer

  // Middle Eastern scripts
  { pattern: /[\u0600-\u06FF\u0750-\u077F]/, font: "Noto Sans Arabic" }, // Arabic
  { pattern: /[\u0590-\u05FF]/, font: "Noto Sans Hebrew" },         // Hebrew

  // Other scripts
  { pattern: /[\u0400-\u04FF]/, font: "Noto Sans" },                // Cyrillic (Russian, etc.)
  { pattern: /[\u0370-\u03FF]/, font: "Noto Sans" },                // Greek
  { pattern: /[\u0530-\u058F]/, font: "Noto Sans Armenian" },       // Armenian
  { pattern: /[\u10A0-\u10FF]/, font: "Noto Sans Georgian" },       // Georgian
  { pattern: /[\u1200-\u137F]/, font: "Noto Sans Ethiopic" },       // Ethiopic
];

// Detect the appropriate fallback font for text containing non-Latin scripts
const detectScriptFont = (text: string, defaultFont: string): string => {
  for (const { pattern, font } of SCRIPT_FONT_MAP) {
    if (pattern.test(text)) {
      return font;
    }
  }
  return defaultFont;
};

const resolveFontName = (fontName: string): string => {
  return FONT_NAME_MAP[fontName] || fontName;
};

const formatTime = (t: number) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = (t % 60).toFixed(2);
  return `${h}:${String(m).padStart(2, "0")}:${s.padStart(5, "0")}`;
};

const hexToAssBgr = (hex: string): string => {
  const cleanHex = hex.replace("#", "");
  const r = cleanHex.substring(0, 2);
  const g = cleanHex.substring(2, 4);
  const b = cleanHex.substring(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
};

interface TimedWord {
  word: string;
  start: number;
  end: number;
}

const buildHighlightedText = (
  words: TimedWord[],
  activeIndex: number,
  highlightColor: string,
  defaultColor: string,
  defaultFont: string
): string => {
  return words
    .map((w, i) => {
      const color = i === activeIndex ? highlightColor : defaultColor;
      const font = detectScriptFont(w.word, defaultFont);
      return `{\\fn${font}\\c${color}}${w.word}`;
    })
    .join(" ");
};

export const addCaptionsOverlay = async (
  inputPath: string,
  outputPath: string,
  clipData: ClipSuggestions,
  words: TranscriptionWord[],
  captionColor: string = "#FFD600",
  captionFont: string = "Montserrat",
): Promise<void> => {
  const assPath = path.join(
    path.dirname(outputPath),
    `captions_${Date.now()}.ass`
  );

  const resolvedFont = resolveFontName(captionFont);
  const highlightColor = hexToAssBgr(captionColor);
  const defaultColor = "&H00FFFFFF";

  // Caption styling optimized for 9:16 vertical video (1080x1920)
  // Font size 120 is readable on mobile, outline 6px for visibility
  // MarginV 280 positions captions in lower third but above safe zone
  let ass = `
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${resolvedFont},120,${defaultColor},&H00000000,&H80000000,1,0,0,0,100,100,2,0,1,6,2,2,80,80,280,0

[Events]
Format: Layer,Start,End,Style,Text
`;

  let offset = 0;

  const allSegments = [clipData.hook, ...clipData.main];

  for (const segment of allSegments) {
    const segmentWords = words.filter(
      w => w.start >= segment.start && w.end <= segment.end
    );

    // Group words into chunks
    for (let i = 0; i < segmentWords.length; i += WORDS_PER_GROUP) {
      const group = segmentWords.slice(i, i + WORDS_PER_GROUP);

      // Convert to timed words with offset applied
      const timedGroup: TimedWord[] = group.map(w => ({
        word: w.punctuated_word || "",
        start: offset + (w.start - segment.start),
        end: offset + (w.end - segment.start),
      }));

      // For each word in the group, create a dialogue event highlighting that word
      for (let j = 0; j < timedGroup.length; j++) {
        const currentWord = timedGroup[j];
        const text = buildHighlightedText(
          timedGroup,
          j,
          highlightColor,
          defaultColor,
          resolvedFont
        );

        ass += `Dialogue: 0,${formatTime(currentWord.start)},${formatTime(currentWord.end)},Default,${text}\n`;
      }
    }

    offset += segment.end - segment.start;
  }

  fs.writeFileSync(assPath, ass, "utf-8");

  const fontsDir = path.resolve(__dirname, "../../fonts");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`ass=${assPath}:fontsdir=${fontsDir}`)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-movflags +faststart",
      ])
      .save(outputPath)
      .on("end", () => {
        fs.unlinkSync(assPath);
        resolve();
      })
      .on("error", err => {
        fs.unlinkSync(assPath);
        reject(err);
      });
  });
};

export function convertWordsToCaptionEntries(
  words: TranscriptionWord[],
  wordsPerGroup: number = WORDS_PER_GROUP
): CaptionEntry[] {
  const entries: CaptionEntry[] = [];

  for (let i = 0; i < words.length; i += wordsPerGroup) {
    const group = words.slice(i, i + wordsPerGroup);
    if (group.length === 0) continue;

    entries.push({
      index: entries.length,
      startTime: group[0].start,
      endTime: group[group.length - 1].end,
      text: group.map(w => w.punctuated_word || "").join(" "),
    });
  }

  return entries;
}

export function generateSrtFromCaptions(captions: CaptionEntry[]): string {
  const formatSrtTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
  };

  return captions
    .map(
      c =>
        `${c.index + 1}\n${formatSrtTime(c.startTime)} --> ${formatSrtTime(c.endTime)}\n${c.text}\n`
    )
    .join("\n");
}

export const addCaptionsFromData = async (
  inputPath: string,
  outputPath: string,
  captionsData: CaptionEntry[],
  captionColor: string = "#FFD600",
  captionFont: string = "Montserrat",
): Promise<void> => {
  const assPath = path.join(
    path.dirname(outputPath),
    `captions_${Date.now()}.ass`
  );

  const resolvedFont = resolveFontName(captionFont);
  const highlightColor = hexToAssBgr(captionColor);
  const defaultColor = "&H00FFFFFF";

  // Caption styling optimized for 9:16 vertical video (1080x1920)
  // Font size 120 is readable on mobile, outline 6px for visibility
  // MarginV 280 positions captions in lower third but above safe zone
  let ass = `
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${resolvedFont},120,${defaultColor},&H00000000,&H80000000,1,0,0,0,100,100,2,0,1,6,2,2,80,80,280,0

[Events]
Format: Layer,Start,End,Style,Text
`;

  for (const entry of captionsData) {
    const words = entry.text.split(" ");
    const wordDuration = (entry.endTime - entry.startTime) / words.length;

    for (let i = 0; i < words.length; i++) {
      const wordStart = entry.startTime + i * wordDuration;
      const wordEnd = entry.startTime + (i + 1) * wordDuration;

      const text = words
        .map((w, idx) => {
          const color = idx === i ? highlightColor : defaultColor;
          const font = detectScriptFont(w, resolvedFont);
          return `{\\fn${font}\\c${color}}${w}`;
        })
        .join(" ");

      ass += `Dialogue: 0,${formatTime(wordStart)},${formatTime(wordEnd)},Default,${text}\n`;
    }
  }

  fs.writeFileSync(assPath, ass, "utf-8");

  const fontsDir = path.resolve(__dirname, "../../fonts");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`ass=${assPath}:fontsdir=${fontsDir}`)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-movflags +faststart",
      ])
      .save(outputPath)
      .on("end", () => {
        fs.unlinkSync(assPath);
        resolve();
      })
      .on("error", err => {
        fs.unlinkSync(assPath);
        reject(err);
      });
  });
};
