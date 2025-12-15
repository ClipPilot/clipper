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
  captionColor: string = "#FFD600", // Default to yellow for highlight
  captionFont: string = "Montserrat",
): Promise<void> => {
  const assPath = path.join(
    path.dirname(outputPath),
    `captions_${Date.now()}.ass`
  );

  const highlightColor = hexToAssBgr(captionColor);
  const defaultColor = "&H00FFFFFF"; // White in ASS BGR format

  // Style uses white as default, we'll override with inline tags for highlighting
  let ass = `
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${captionFont},100,${defaultColor},&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,5,0,2,60,60,180,1

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

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`ass=${assPath}:fontsdir=${path.resolve("src/fonts")}`)
      .outputOptions(["-c:a copy"])
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

  const highlightColor = hexToAssBgr(captionColor);
  const defaultColor = "&H00FFFFFF";

  let ass = `
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${captionFont},100,${defaultColor},&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,5,0,2,60,60,180,1

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

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`ass=${assPath}:fontsdir=${path.resolve("src/fonts")}`)
      .outputOptions(["-c:a copy"])
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
