import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { ClipSuggestions } from "../types/ai.types";

export interface TranscriptionWord {
  start: number;
  end: number;
  punctuated_word?: string | undefined;
}

const formatTime = (t: number) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = (t % 60).toFixed(2);
  return `${h}:${String(m).padStart(2, "0")}:${s.padStart(5, "0")}`;
};

export const addCaptionsOverlay = async (
  inputPath: string,
  outputPath: string,
  clipData: ClipSuggestions,
  words: TranscriptionWord[]
): Promise<void> => {
  const assPath = path.join(
    path.dirname(outputPath),
    `captions_${Date.now()}.ass`
  );

  let ass = `
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Montserrat,64,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,2,60,60,140,1

[Events]
Format: Layer,Start,End,Style,Text
`;

  let offset = 0;

  const allSegments = [clipData.hook, ...clipData.main];

  for (const segment of allSegments) {
    const segmentWords = words.filter(
      w => w.start >= segment.start && w.end <= segment.end
    );

    for (const word of segmentWords) {
      const start = offset + (word.start - segment.start);
      const end = offset + (word.end - segment.start);

      ass += `Dialogue: 0,${formatTime(start)},${formatTime(end)},Default,${word.punctuated_word}\n`;
    }

    offset += segment.end - segment.start;
  }

  fs.writeFileSync(assPath, ass);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`ass=${assPath}`)
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
