import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { ClipSuggestions } from "../types/ai.types";

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
  defaultColor: string
): string => {
  return words
    .map((w, i) => {
      const color = i === activeIndex ? highlightColor : defaultColor;
      return `{\\c${color}}${w.word}`;
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
Style: Default,${resolvedFont},120,${defaultColor},&H00000000,&H80000000,1,0,0,0,100,100,2,0,1,6,2,2,80,80,280,1

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
          defaultColor
        );

        ass += `Dialogue: 0,${formatTime(currentWord.start)},${formatTime(currentWord.end)},Default,${text}\n`;
      }
    }

    offset += segment.end - segment.start;
  }

  fs.writeFileSync(assPath, ass);

  const fontsDir = path.resolve(__dirname, "../fonts");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`ass=${assPath}:fontsdir=${fontsDir}`)
      .outputOptions(["-c:a copy", "-map_metadata -1"])
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
Style: Default,${resolvedFont},120,${defaultColor},&H00000000,&H80000000,1,0,0,0,100,100,2,0,1,6,2,2,80,80,280,1

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
          return `{\\c${color}}${w}`;
        })
        .join(" ");

      ass += `Dialogue: 0,${formatTime(wordStart)},${formatTime(wordEnd)},Default,${text}\n`;
    }
  }

  fs.writeFileSync(assPath, ass);

  const fontsDir = path.resolve(__dirname, "../fonts");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`ass=${assPath}:fontsdir=${fontsDir}`)
      .outputOptions(["-c:a copy", "-map_metadata -1"])
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
