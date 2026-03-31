import * as Sentry from "@sentry/node";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import {
  MOBILE_VIDEO_SETTINGS,
  COMPRESSION,
} from "../../config/ffmpegSettings";
import { getVideoMetadata } from "./videoEditor.utils";

const {
  threshold: COMPRESSION_THRESHOLD,
  targetCrf: TARGET_CRF,
  maxBitrate: MAX_BITRATE,
} = COMPRESSION;

export const compressVideoForUpload = async (
  inputPath: string,
  outputPath: string,
): Promise<{
  path: string;
  compressed: boolean;
  originalSize: number;
  newSize: number;
}> => {
  const originalSize = fs.statSync(inputPath).size;

  if (originalSize < COMPRESSION_THRESHOLD) {
    console.log(
      `[COMPRESS] File ${Math.round(originalSize / 1024 / 1024)}MB below threshold, skipping compression`,
    );
    return {
      path: inputPath,
      compressed: false,
      originalSize,
      newSize: originalSize,
    };
  }

  console.log(
    `[COMPRESS] Compressing ${Math.round(originalSize / 1024 / 1024)}MB video with high quality settings...`,
  );

  try {
    const metadata = await getVideoMetadata(inputPath);
    const currentBitrate = metadata.bitrate ? metadata.bitrate / 1000 : 15000;

    if (currentBitrate <= MAX_BITRATE) {
      console.log(
        `[COMPRESS] Bitrate ${Math.round(currentBitrate)}kbps already good, skipping`,
      );
      return {
        path: inputPath,
        compressed: false,
        originalSize,
        newSize: originalSize,
      };
    }

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          `-crf ${TARGET_CRF}`,
          `-maxrate ${MAX_BITRATE}k`,
          `-bufsize ${MAX_BITRATE * 2}k`,
          ...MOBILE_VIDEO_SETTINGS,
          "-c:a aac",
          "-b:a 192k",
          "-ar 48000",
          "-ac 2",
          "-movflags +faststart",
          "-map_metadata",
          "-1",
        ])
        .save(outputPath)
        .on("progress", (progress) => {
          if (progress.percent && Math.round(progress.percent) % 25 === 0) {
            console.log(
              `[COMPRESS] Progress: ${Math.round(progress.percent)}%`,
            );
          }
        })
        .on("end", () => resolve())
        .on("error", reject);
    });

    const newSize = fs.statSync(outputPath).size;
    const savings = Math.round(((originalSize - newSize) / originalSize) * 100);
    console.log(
      `[COMPRESS] Done: ${Math.round(originalSize / 1024 / 1024)}MB -> ${Math.round(newSize / 1024 / 1024)}MB (${savings}% smaller)`,
    );

    return { path: outputPath, compressed: true, originalSize, newSize };
  } catch (error) {
    console.error("[COMPRESS] Failed, using original:", error);
    Sentry.captureException(error);
    return {
      path: inputPath,
      compressed: false,
      originalSize,
      newSize: originalSize,
    };
  }
};

export const cutClip = (
  input: string,
  output: string,
  start: number,
  end: number,
) => {
  const duration = end - start;
  console.log(
    `[CUT] Cutting ${start.toFixed(3)}s-${end.toFixed(3)}s (${duration.toFixed(1)}s) from ${input} -> ${output}`,
  );

  if (!input || !output) {
    const error = new Error(
      `[CUT] Invalid paths: input="${input}", output="${output}"`,
    );
    console.error(error.message);
    return Promise.reject(error);
  }

  if (!fs.existsSync(input)) {
    const error = new Error(`[CUT] Input file does not exist: ${input}`);
    console.error(error.message);
    return Promise.reject(error);
  }

  if (duration < 0.5) {
    console.warn(
      `[CUT] Segment too short (${duration.toFixed(3)}s), extending end by 1s`,
    );
    end = start + Math.max(duration, 1);
  }

  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .setStartTime(start)
      .setDuration(duration)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-bf 0",
        "-ar 48000",
        "-ac 2",
        "-c:a aac",
        "-b:a 128k",
        "-af",
        "aresample=async=1:first_pts=0",
        "-avoid_negative_ts make_zero",
        "-reset_timestamps 1",
        "-movflags +faststart",
        "-map_metadata",
        "-1",
      ])
      .on("end", () => {
        if (!fs.existsSync(output)) {
          return reject(
            new Error(`Cut clip failed: output file not created at ${output}`),
          );
        }
        const stats = fs.statSync(output);
        if (stats.size < 1000) {
          return reject(
            new Error(
              `Cut clip failed: output file too small (${stats.size} bytes)`,
            ),
          );
        }
        console.log(
          `[CUT] Success: ${output} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`,
        );
        resolve(output);
      })
      .on("error", (err) => {
        console.error(`[CUT] Failed for output "${output}": ${err.message}`);
        reject(err);
      })
      .save(output);
  });
};

export const extractAudio = (
  videoPath: string,
  outputPath: string,
): Promise<string> => {
  console.log(`[EXTRACT-AUDIO] Extracting audio from ${videoPath}`);
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(44100)
      .audioChannels(2)
      .output(outputPath)
      .on("end", () => {
        console.log(`[EXTRACT-AUDIO] Audio saved to ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[EXTRACT-AUDIO] Failed: ${err.message}`);
        reject(err);
      })
      .run();
  });
};

export const replaceAudioInVideo = (
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<string> => {
  console.log(
    `[REPLACE-AUDIO] Replacing audio in ${videoPath} with ${audioPath}`,
  );
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v copy",
        "-c:a aac",
        "-ar 44100",
        "-ac 2",
        "-b:a 192k",
        "-map 0:v:0",
        "-map 1:a:0",
        "-shortest",
      ])
      .output(outputPath)
      .on("end", () => {
        console.log(`[REPLACE-AUDIO] Audio replaced, saved to ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[REPLACE-AUDIO] Failed: ${err.message}`);
        reject(err);
      })
      .run();
  });
};

export const normalizeClip = (input: string, output: string): Promise<string> => {
  console.log(`[NORMALIZE] Processing: ${input}`);
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-bf 0",
        "-sc_threshold 0",
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-ac 2",
        "-fflags +genpts+igndts",
        "-avoid_negative_ts make_zero",
        "-reset_timestamps 1",
        "-start_at_zero",
        "-movflags +faststart",
        "-map_metadata",
        "-1",
      ])
      .save(output)
      .on("end", () => {
        console.log(`[NORMALIZE] Done: ${output}`);
        resolve(output);
      })
      .on("error", (err) => {
        console.error(`[NORMALIZE] Failed: ${err.message}`);
        reject(err);
      });
  });
};

export const mergeClipsFaceSwap = async (
  clips: string[],
  outputPath: string,
) => {
  console.log(`[MERGE] Merging ${clips.length} clips`);

  for (const clip of clips) {
    if (!fs.existsSync(clip)) {
      throw new Error(`[MERGE] Input clip not found: ${clip}`);
    }
    const stats = fs.statSync(clip);
    console.log(
      `[MERGE] Input: ${clip} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`,
    );
  }

  return new Promise((resolve, reject) => {
    const listPath = outputPath + ".txt";
    const content = clips
      .map((c) => `file '${c.replace(/'/g, "'\\''")}'`)
      .join("\n");
    fs.writeFileSync(listPath, content);

    let stderrLog = "";

    let settled = false;

    ffmpeg()
      .input(listPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-bf 0",
        "-sc_threshold 0",
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-ac 2",
        "-fflags +genpts",
        "-avoid_negative_ts make_zero",
        "-movflags +faststart",
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("stderr", (line: string) => {
        stderrLog += line + "\n";
      })
      .on("end", () => {
        if (settled) return;
        settled = true;
        try {
          if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
        } catch {}
        if (!fs.existsSync(outputPath)) {
          reject(
            new Error(
              `[MERGE] FFmpeg reported success but output file missing: ${outputPath}`,
            ),
          );
          return;
        }
        console.log(
          `[MERGE] Success: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)}MB)`,
        );
        resolve(outputPath);
      })
      .on("error", (err) => {
        if (settled) return;
        settled = true;
        try {
          if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
        } catch {}
        reject(err);
      });
  });
};

export const mergeClipsGpu = mergeClipsFaceSwap;
export const mergeClips = mergeClipsFaceSwap;
