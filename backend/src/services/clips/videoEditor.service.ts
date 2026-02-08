import * as Sentry from "@sentry/node";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import puppeteer from "puppeteer";
import path from "path";
import { MOBILE_VIDEO_SETTINGS, COMPRESSION } from "../../config/ffmpegSettings";

interface VideoMetadata {
  width: number;
  height: number;
  duration?: number;
  bitrate?: number;
}

const getVideoMetadata = (videoPath: string): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(
        (s) => s.codec_type === "video"
      );
      if (!videoStream || !videoStream.width || !videoStream.height) {
        return reject(new Error("Could not get video dimensions"));
      }
      resolve({
        width: videoStream.width,
        height: videoStream.height,
        duration: metadata.format.duration,
        bitrate: metadata.format.bit_rate
          ? parseInt(String(metadata.format.bit_rate))
          : undefined,
      });
    });
  });
};

const { threshold: COMPRESSION_THRESHOLD, targetCrf: TARGET_CRF, maxBitrate: MAX_BITRATE } = COMPRESSION;

export const compressVideoForUpload = async (
  inputPath: string,
  outputPath: string
): Promise<{
  path: string;
  compressed: boolean;
  originalSize: number;
  newSize: number;
}> => {
  const originalSize = fs.statSync(inputPath).size;

  if (originalSize < COMPRESSION_THRESHOLD) {
    console.log(
      `[COMPRESS] File ${Math.round(originalSize / 1024 / 1024)}MB below threshold, skipping compression`
    );
    return {
      path: inputPath,
      compressed: false,
      originalSize,
      newSize: originalSize,
    };
  }

  console.log(
    `[COMPRESS] Compressing ${Math.round(originalSize / 1024 / 1024)}MB video with high quality settings...`
  );

  try {
    const metadata = await getVideoMetadata(inputPath);
    const currentBitrate = metadata.bitrate ? metadata.bitrate / 1000 : 15000;

    // Skip if already reasonably sized
    if (currentBitrate <= MAX_BITRATE) {
      console.log(
        `[COMPRESS] Bitrate ${Math.round(currentBitrate)}kbps already good, skipping`
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
          "-map_metadata", "-1",
        ])
        .save(outputPath)
        .on("progress", (progress) => {
          if (progress.percent && Math.round(progress.percent) % 25 === 0) {
            console.log(
              `[COMPRESS] Progress: ${Math.round(progress.percent)}%`
            );
          }
        })
        .on("end", () => resolve())
        .on("error", reject);
    });

    const newSize = fs.statSync(outputPath).size;
    const savings = Math.round(((originalSize - newSize) / originalSize) * 100);
    console.log(
      `[COMPRESS] Done: ${Math.round(originalSize / 1024 / 1024)}MB -> ${Math.round(newSize / 1024 / 1024)}MB (${savings}% smaller)`
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

export const getVideoDuration = (videoPath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      if (!duration) return reject(new Error("Could not get video duration"));
      resolve(duration);
    });
  });
};

/**
 * Extracts the first frame from a video as a JPG image.
 * Used as a "golden reference" - the first successfully swapped frame
 * becomes the reference for all subsequent chunks to prevent drift.
 */
export const extractFirstFrame = (
  videoPath: string,
  outputPath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .setStartTime(0)
      .outputOptions(["-vframes", "1", "-q:v", "2"])
      .output(outputPath)
      .on("end", () => {
        console.log(`[EXTRACT] First frame saved to ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(
          `[EXTRACT] Failed to extract first frame: ${err.message}`
        );
        reject(err);
      })
      .run();
  });
};

export const extractFrameAtTime = (
  videoPath: string,
  outputPath: string,
  timeInSeconds: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .setStartTime(timeInSeconds)
      .outputOptions(["-vframes", "1", "-q:v", "2"])
      .output(outputPath)
      .on("end", () => {
        console.log(`[EXTRACT] Frame at ${timeInSeconds.toFixed(2)}s saved to ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[EXTRACT] Failed to extract frame: ${err.message}`);
        reject(err);
      })
      .run();
  });
};

/**
 * Extracts the last frame from a video as a JPG image.
 * Used for temporal consistency when processing video in chunks -
 * the last frame of chunk N becomes the reference for chunk N+1.
 */
export const extractLastFrame = (
  videoPath: string,
  outputPath: string
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const duration = await getVideoDuration(videoPath);
      // Seek to 0.1s before end to ensure we get a valid frame
      const seekTime = Math.max(0, duration - 0.1);

      ffmpeg(videoPath)
        .setStartTime(seekTime)
        .outputOptions(["-vframes", "1", "-q:v", "2"]) // 1 frame, high quality
        .output(outputPath)
        .on("end", () => {
          console.log(`[EXTRACT] Last frame saved to ${outputPath}`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error(
            `[EXTRACT] Failed to extract last frame: ${err.message}`
          );
          reject(err);
        })
        .run();
    } catch (err) {
      reject(err);
    }
  });
};

export const prependPoseFrame = async (
  videoPath: string,
  imagePath: string,
  outputPath: string
): Promise<string> => {
  console.log(`[PREPEND-FRAME] Adding pose frame to start of ${videoPath}`);
  const { execSync } = require("child_process");

  const tempDir = path.dirname(outputPath);
  const timestamp = Date.now();

  // Get video fps, dimensions, and audio sample rate
  const probeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,width,height -of csv=p=0 "${videoPath}"`;
  const probeResult = execSync(probeCmd, { encoding: "utf-8" }).trim();
  const [width, height, fpsRatio] = probeResult.split(",");
  const [fpsNum, fpsDen] = fpsRatio.split("/");
  const fps = parseInt(fpsNum) / parseInt(fpsDen || "1");
  const frameDuration = 1 / fps;

  // Create 1-frame video from pose image WITH silent audio track
  const oneFrameVideo = path.join(tempDir, `pose_frame_${timestamp}.mp4`);
  const createFrameCmd = `ffmpeg -y -loop 1 -i "${imagePath}" -f lavfi -i anullsrc=r=48000:cl=stereo -c:v libx264 -t ${frameDuration.toFixed(6)} -pix_fmt yuv420p -vf "scale=${width}:${height}" -c:a aac -shortest -r ${fps} "${oneFrameVideo}"`;
  execSync(createFrameCmd, { stdio: "pipe" });

  // Re-encode original video to ensure compatible format
  const reEncodedVideo = path.join(tempDir, `reencoded_${timestamp}.mp4`);
  const reEncodeCmd = `ffmpeg -y -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p -r ${fps} -c:a aac -ar 48000 -ac 2 "${reEncodedVideo}"`;
  execSync(reEncodeCmd, { stdio: "pipe" });

  // Concatenate: pose frame + full original video
  const concatList = path.join(tempDir, `concat_${timestamp}.txt`);
  fs.writeFileSync(concatList, `file '${oneFrameVideo}'\nfile '${reEncodedVideo}'`);
  const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${outputPath}"`;
  execSync(concatCmd, { stdio: "pipe" });

  fs.unlinkSync(oneFrameVideo);
  fs.unlinkSync(reEncodedVideo);
  fs.unlinkSync(concatList);

  console.log(`[PREPEND-FRAME] Done: ${outputPath}`);
  return outputPath;
};

export const cutClip = (
  input: string,
  output: string,
  start: number,
  end: number
) => {
  const duration = end - start;
  console.log(
    `[CUT] Cutting ${start.toFixed(3)}s-${end.toFixed(3)}s (${duration.toFixed(1)}s) from ${input} -> ${output}`
  );

  // Validate paths before starting
  if (!input || !output) {
    const error = new Error(
      `[CUT] Invalid paths: input="${input}", output="${output}"`
    );
    console.error(error.message);
    return Promise.reject(error);
  }

  if (!fs.existsSync(input)) {
    const error = new Error(`[CUT] Input file does not exist: ${input}`);
    console.error(error.message);
    return Promise.reject(error);
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
        "-map_metadata", "-1",
      ])
      .on("end", () => {
        if (!fs.existsSync(output)) {
          return reject(
            new Error(`Cut clip failed: output file not created at ${output}`)
          );
        }
        const stats = fs.statSync(output);
        if (stats.size < 1000) {
          return reject(
            new Error(
              `Cut clip failed: output file too small (${stats.size} bytes)`
            )
          );
        }
        console.log(
          `[CUT] Success: ${output} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`
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
  outputPath: string
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
  outputPath: string
): Promise<string> => {
  console.log(`[REPLACE-AUDIO] Replacing audio in ${videoPath} with ${audioPath}`);
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

const normalizeClip = (input: string, output: string): Promise<string> => {
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
        "-map_metadata", "-1",
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

export const mergeClipsFaceSwap = async (clips: string[], outputPath: string) => {
  console.log(`[MERGE] Merging ${clips.length} clips`);

  for (const clip of clips) {
    if (!fs.existsSync(clip)) {
      throw new Error(`[MERGE] Input clip not found: ${clip}`);
    }
    const stats = fs.statSync(clip);
    console.log(`[MERGE] Input: ${clip} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
  }

  return new Promise((resolve, reject) => {
    const listPath = outputPath + ".txt";
    const content = clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join("\n");
    fs.writeFileSync(listPath, content);

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
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        fs.unlinkSync(listPath);
        const finalStats = fs.statSync(outputPath);
        console.log(`[MERGE] Success: ${outputPath} (${(finalStats.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[MERGE] Failed: ${err.message}`);
        reject(err);
      });
  });
};

export const mergeClipsGpu = mergeClipsFaceSwap;
export const mergeClips = mergeClipsFaceSwap;

export const mergeClipsWithCrossfade = async (
  clips: string[],
  outputPath: string,
  overlapDuration: number = 0.3
): Promise<string> => {
  console.log(`[MERGE-XFADE] Merging ${clips.length} clips with ${overlapDuration}s crossfade`);

  if (clips.length === 0) throw new Error("No clips to merge");
  if (clips.length === 1) {
    fs.copyFileSync(clips[0], outputPath);
    return outputPath;
  }

  for (const clip of clips) {
    if (!fs.existsSync(clip)) {
      throw new Error(`[MERGE-XFADE] Input clip not found: ${clip}`);
    }
  }

  const durations: number[] = [];
  for (const clip of clips) {
    const dur = await getVideoDuration(clip);
    durations.push(dur);
    console.log(`[MERGE-XFADE] ${clip}: ${dur.toFixed(2)}s`);
  }

  const inputs: string[] = [];
  clips.forEach((clip) => {
    inputs.push("-i", clip);
  });

  let videoFilter = "";
  let audioFilter = "";
  let offset = 0;

  for (let i = 0; i < clips.length - 1; i++) {
    const prevLabel = i === 0 ? `[${i}:v]` : `[v${i}]`;
    const nextLabel = `[${i + 1}:v]`;
    const outLabel = i === clips.length - 2 ? "[vout]" : `[v${i + 1}]`;

    offset = i === 0 ? durations[0] - overlapDuration : offset + durations[i] - overlapDuration;

    videoFilter += `${prevLabel}${nextLabel}xfade=transition=fade:duration=${overlapDuration}:offset=${offset.toFixed(3)}${outLabel}`;
    if (i < clips.length - 2) videoFilter += ";";
  }

  offset = 0;
  for (let i = 0; i < clips.length - 1; i++) {
    const prevLabel = i === 0 ? `[${i}:a]` : `[a${i}]`;
    const nextLabel = `[${i + 1}:a]`;
    const outLabel = i === clips.length - 2 ? "[aout]" : `[a${i + 1}]`;

    audioFilter += `${prevLabel}${nextLabel}acrossfade=d=${overlapDuration}:c1=tri:c2=tri${outLabel}`;
    if (i < clips.length - 2) audioFilter += ";";
  }

  const filterComplex = `${videoFilter};${audioFilter}`;
  console.log(`[MERGE-XFADE] Filter: ${filterComplex}`);

  return new Promise((resolve, reject) => {
    const { execSync } = require("child_process");
    const cmd = `ffmpeg -y ${inputs.join(" ")} -filter_complex "${filterComplex}" -map "[vout]" -map "[aout]" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;

    try {
      execSync(cmd, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
      console.log(`[MERGE-XFADE] Success: ${outputPath}`);
      resolve(outputPath);
    } catch (err) {
      console.error(`[MERGE-XFADE] Failed:`, (err as Error).message);
      reject(err);
    }
  });
};

// Map font names to Google Fonts URLs and CSS font-family values
const FONT_CONFIG: Record<string, { url: string; family: string }> = {
  "Luckiest Guy": {
    url: "https://fonts.googleapis.com/css2?family=Luckiest+Guy&display=swap",
    family: "'Luckiest Guy', cursive",
  },
  Montserrat: {
    url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap",
    family: "'Montserrat', sans-serif",
  },
  "Bebas Neue": {
    url: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
    family: "'Bebas Neue', sans-serif",
  },
  Anton: {
    url: "https://fonts.googleapis.com/css2?family=Anton&display=swap",
    family: "'Anton', sans-serif",
  },
};

const generateTextImage = async (
  text: string,
  outputPath: string,
  fillColor: string = "#FFFFFF",
  strokeColor: string = "#000000",
  fontName: string = "Montserrat"
): Promise<void> => {
  // Get font config or fallback to Montserrat
  const fontConfig = FONT_CONFIG[fontName] || FONT_CONFIG["Montserrat"];

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: 1080,
      height: 400,
      deviceScaleFactor: 2,
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="${fontConfig.url}" rel="stylesheet">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              width: 1080px;
              height: 400px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: transparent;
              padding: 30px 50px;
            }
            .text {
              font-size: 52px;
              font-weight: 900;
              font-family: ${fontConfig.family}, 'Apple Color Emoji', sans-serif;
              color: ${fillColor};
              text-align: center;
              -webkit-text-stroke: 6px ${strokeColor};
              paint-order: stroke fill;
              line-height: 1.25;
              letter-spacing: -0.01em;
              word-wrap: break-word;
              overflow-wrap: break-word;
              max-width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="text">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </body>
      </html>
    `;

    await page.setContent(htmlContent);

    await page.screenshot({
      path: outputPath,
      type: "png",
      omitBackground: true,
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Failed to create text image at ${outputPath}`);
    }
  } finally {
    await browser.close();
  }
};

export const addTextOverlayAtPosition = async (
  inputPath: string,
  outputPath: string,
  text: string,
  xPercent: number,
  yPercent: number,
  fontSize: number,
  fillColor: string = "#FFFFFF",
  strokeColor: string = "#000000",
  fontName: string = "Montserrat"
): Promise<string> => {
  const textImagePath = path.join(
    path.dirname(outputPath),
    `text_pos_${Date.now()}.png`
  );

  // Get font config or fallback to Montserrat
  const fontConfig = FONT_CONFIG[fontName] || FONT_CONFIG["Montserrat"];

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 400, deviceScaleFactor: 2 });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <link href="${fontConfig.url}" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: 1080px;
              height: 400px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: transparent;
              padding: 20px;
            }
            .text {
              font-size: ${fontSize}px;
              font-weight: 900;
              font-family: ${fontConfig.family}, 'Apple Color Emoji', sans-serif;
              color: ${fillColor};
              text-align: center;
              -webkit-text-stroke: 4px ${strokeColor};
              paint-order: stroke fill;
              line-height: 1.2;
              max-width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="text">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </body>
      </html>
    `;

    await page.setContent(htmlContent);
    await page.screenshot({
      path: textImagePath,
      type: "png",
      omitBackground: true,
    });
    await browser.close();

    const xPos = `(W*${xPercent / 100})-(w/2)`;
    const yPos = `(H*${yPercent / 100})-(h/2)`;

    return new Promise<string>((resolve, reject) => {
      ffmpeg(inputPath)
        .input(textImagePath)
        .complexFilter([`overlay=${xPos}:${yPos}`])
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          ...MOBILE_VIDEO_SETTINGS,
          "-c:a aac",
          "-b:a 128k",
          "-ar 48000",
          "-movflags +faststart",
          "-map_metadata", "-1",
        ])
        .save(outputPath)
        .on("end", () => {
          if (fs.existsSync(textImagePath)) fs.unlinkSync(textImagePath);
          resolve(outputPath);
        })
        .on("error", (err) => {
          if (fs.existsSync(textImagePath)) fs.unlinkSync(textImagePath);
          reject(err);
        });
    });
  } catch (err) {
    if (fs.existsSync(textImagePath)) fs.unlinkSync(textImagePath);
    throw err;
  }
};

export const addPreviewWatermark = async (
  inputPath: string,
  outputPath: string
): Promise<string> => {
  // Use the Cuttr logo from assets
  const logoPath = path.join(__dirname, "../templates/assets/cuttr-logo.png");

  if (!fs.existsSync(logoPath)) {
    throw new Error(`Cuttr logo not found at ${logoPath}`);
  }

  // Get video dimensions and duration
  const metadata = await getVideoMetadata(inputPath);
  const duration = metadata.duration || 10;
  const halfDuration = duration / 2;

  // Bigger watermark (35% instead of 22%) and more visible (65% opacity)
  const logoSize = Math.round(Math.min(metadata.width, metadata.height) * 0.35);
  const margin = Math.round(Math.min(metadata.width, metadata.height) * 0.04);

  // Watermark moves halfway through the video:
  // First half: bottom-right corner
  // Second half: top-left corner
  // This makes it harder to crop out or remove with simple editing
  // Using dynamic x/y expressions that change based on time
  const xExpr = `if(lt(t,${halfDuration}),W-w-${margin},${margin})`;
  const yExpr = `if(lt(t,${halfDuration}),H-h-${margin},${margin})`;

  return new Promise<string>((resolve, reject) => {
    ffmpeg(inputPath)
      .input(logoPath)
      .complexFilter([
        // Scale logo and set opacity to 65%
        `[1:v]scale=${logoSize}:-1,format=rgba,colorchannelmixer=aa=0.65[logo]`,
        // Single overlay with dynamic position based on time
        `[0:v][logo]overlay=x='${xExpr}':y='${yExpr}':format=auto`,
      ])
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-movflags +faststart",
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        resolve(outputPath);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

export const addTextOverlay = async (
  inputPath: string,
  outputPath: string,
  text: string,
  position: "top" | "center" | "bottom" = "top",
  fillColor: string = "#FFFFFF",
  strokeColor: string = "#000000",
  fontName: string = "Montserrat"
): Promise<string> => {
  const textImagePath = path.join(
    path.dirname(outputPath),
    `text_overlay_${Date.now()}.png`
  );

  try {
    console.log("Generating text image with:", text);
    await generateTextImage(
      text,
      textImagePath,
      fillColor,
      strokeColor,
      fontName
    );
    console.log("Text image created at:", textImagePath);

    if (!fs.existsSync(textImagePath)) {
      throw new Error(`Text image was not created at ${textImagePath}`);
    }

    const yPosition =
      position === "top"
        ? "H*0.05"
        : position === "center"
          ? "(H-h)/2"
          : "H-h-H*0.1";

    return new Promise<string>((resolve, reject) => {
      ffmpeg(inputPath)
        .input(textImagePath)
        .complexFilter([`overlay=(W-w)/2:${yPosition}`])
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          ...MOBILE_VIDEO_SETTINGS,
          "-c:a aac",
          "-b:a 128k",
          "-ar 48000",
          "-movflags +faststart",
          "-map_metadata", "-1",
        ])
        .save(outputPath)
        .on("end", () => {
          if (fs.existsSync(textImagePath)) {
            fs.unlinkSync(textImagePath);
          }
          console.log("Text overlay completed successfully");
          resolve(outputPath);
        })
        .on("error", (err) => {
          if (fs.existsSync(textImagePath)) {
            fs.unlinkSync(textImagePath);
          }
          console.error("Error adding text overlay:", err);
          reject(err);
        });
    });
  } catch (err) {
    if (fs.existsSync(textImagePath)) {
      fs.unlinkSync(textImagePath);
    }
    console.error("Error in addTextOverlay:", err);
    throw err;
  }
};

// =============================================================================
// VIDEO EDITOR: New Operations for CapCut-like editing
// =============================================================================

/**
 * Change video playback speed.
 * Uses setpts filter for video and atempo for audio.
 * atempo only supports 0.5-2.0 range, so we chain multiple filters for wider range.
 */
export const changeSpeed = (
  inputPath: string,
  outputPath: string,
  speed: number
): Promise<string> => {
  console.log(`[SPEED] Changing speed to ${speed}x: ${inputPath} -> ${outputPath}`);

  if (speed <= 0 || speed > 4) {
    return Promise.reject(new Error(`Invalid speed: ${speed}. Must be between 0.25 and 4.0`));
  }

  if (!fs.existsSync(inputPath)) {
    return Promise.reject(new Error(`[SPEED] Input file does not exist: ${inputPath}`));
  }

  // Video: setpts=PTS/speed (inverse because higher speed = lower PTS)
  const videoPts = `setpts=PTS/${speed}`;

  // Audio: atempo only supports 0.5-2.0, so chain filters for wider range
  let audioFilter: string;
  if (speed >= 0.5 && speed <= 2.0) {
    audioFilter = `atempo=${speed}`;
  } else if (speed < 0.5) {
    // Chain multiple atempo filters for very slow speeds
    // 0.25x = atempo=0.5,atempo=0.5
    const numFilters = Math.ceil(Math.log(0.5 / speed) / Math.log(2)) + 1;
    const filterValue = Math.pow(speed, 1 / numFilters);
    audioFilter = Array(numFilters).fill(`atempo=${filterValue.toFixed(4)}`).join(",");
  } else {
    // Chain multiple atempo filters for very fast speeds
    // 4x = atempo=2.0,atempo=2.0
    const numFilters = Math.ceil(Math.log(speed / 2.0) / Math.log(2)) + 1;
    const filterValue = Math.pow(speed, 1 / numFilters);
    audioFilter = Array(numFilters).fill(`atempo=${filterValue.toFixed(4)}`).join(",");
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .complexFilter([
        `[0:v]${videoPts}[v]`,
        `[0:a]${audioFilter}[a]`,
      ])
      .outputOptions([
        "-map", "[v]",
        "-map", "[a]",
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-movflags +faststart",
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error(`[SPEED] Output file not created: ${outputPath}`));
        }
        console.log(`[SPEED] Success: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[SPEED] Failed: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Crop video to specified dimensions.
 */
export const cropVideo = (
  inputPath: string,
  outputPath: string,
  crop: { x: number; y: number; width: number; height: number }
): Promise<string> => {
  console.log(`[CROP] Cropping to ${crop.width}x${crop.height} at (${crop.x},${crop.y}): ${inputPath} -> ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    return Promise.reject(new Error(`[CROP] Input file does not exist: ${inputPath}`));
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-movflags +faststart",
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error(`[CROP] Output file not created: ${outputPath}`));
        }
        console.log(`[CROP] Success: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[CROP] Failed: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Change video to a specific aspect ratio.
 * Crops the video to fit the new ratio (removes content, no letterboxing).
 */
export const changeAspectRatio = async (
  inputPath: string,
  outputPath: string,
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5"
): Promise<string> => {
  console.log(`[ASPECT] Changing to ${aspectRatio}: ${inputPath} -> ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    return Promise.reject(new Error(`[ASPECT] Input file does not exist: ${inputPath}`));
  }

  // Get current video dimensions
  const metadata = await getVideoMetadata(inputPath);
  const { width: srcWidth, height: srcHeight } = metadata;

  // Calculate target dimensions based on aspect ratio
  let targetWidth: number;
  let targetHeight: number;
  const ratioMap: Record<string, number> = {
    "9:16": 9 / 16,
    "16:9": 16 / 9,
    "1:1": 1,
    "4:5": 4 / 5,
  };
  const targetRatio = ratioMap[aspectRatio];
  const srcRatio = srcWidth / srcHeight;

  if (srcRatio > targetRatio) {
    // Source is wider than target, crop width
    targetHeight = srcHeight;
    targetWidth = Math.round(srcHeight * targetRatio);
  } else {
    // Source is taller than target, crop height
    targetWidth = srcWidth;
    targetHeight = Math.round(srcWidth / targetRatio);
  }

  // Center the crop
  const cropX = Math.round((srcWidth - targetWidth) / 2);
  const cropY = Math.round((srcHeight - targetHeight) / 2);

  return cropVideo(inputPath, outputPath, {
    x: cropX,
    y: cropY,
    width: targetWidth,
    height: targetHeight,
  });
};

/**
 * Adjust audio volume.
 * @param volume - Volume multiplier (0 = mute, 1 = normal, 2 = double)
 */
export const adjustVolume = (
  inputPath: string,
  outputPath: string,
  volume: number
): Promise<string> => {
  console.log(`[VOLUME] Adjusting to ${volume}x: ${inputPath} -> ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    return Promise.reject(new Error(`[VOLUME] Input file does not exist: ${inputPath}`));
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(`volume=${volume}`)
      .outputOptions([
        "-c:v copy",
        "-c:a aac",
        "-b:a 192k",
        "-ar 44100",
        "-movflags +faststart",
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error(`[VOLUME] Output file not created: ${outputPath}`));
        }
        console.log(`[VOLUME] Success: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[VOLUME] Failed: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Mix background music with video audio.
 */
export const mixBackgroundMusic = (
  videoPath: string,
  musicPath: string,
  outputPath: string,
  config: {
    originalVolume: number; // 0-1
    musicVolume: number; // 0-1
    musicStartTime: number; // Offset in video timeline where music starts
    musicTrimStart: number; // Where to start in the music file
    musicTrimEnd: number; // Where to end in the music file
  }
): Promise<string> => {
  console.log(`[MIX] Mixing music: video=${videoPath}, music=${musicPath} -> ${outputPath}`);
  console.log(`[MIX] Config: originalVol=${config.originalVolume}, musicVol=${config.musicVolume}, startAt=${config.musicStartTime}s`);

  if (!fs.existsSync(videoPath)) {
    return Promise.reject(new Error(`[MIX] Video file does not exist: ${videoPath}`));
  }
  if (!fs.existsSync(musicPath)) {
    return Promise.reject(new Error(`[MIX] Music file does not exist: ${musicPath}`));
  }

  // Calculate music duration and delay
  const musicDuration = config.musicTrimEnd - config.musicTrimStart;
  const delayMs = Math.round(config.musicStartTime * 1000);

  // Build filter complex
  // 1. Adjust original audio volume
  // 2. Trim and adjust music volume, add delay
  // 3. Mix both audio streams
  const filterComplex = [
    // Video audio with volume adjustment
    `[0:a]volume=${config.originalVolume}[original]`,
    // Music: trim, adjust volume, and add delay
    `[1:a]atrim=start=${config.musicTrimStart}:end=${config.musicTrimEnd},asetpts=PTS-STARTPTS,volume=${config.musicVolume},adelay=${delayMs}|${delayMs}[music]`,
    // Mix both audio streams, use video duration as reference
    `[original][music]amix=inputs=2:duration=first:dropout_transition=2[mixed]`,
  ].join(";");

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(musicPath)
      .complexFilter(filterComplex)
      .outputOptions([
        "-map", "0:v",
        "-map", "[mixed]",
        "-c:v copy",
        "-c:a aac",
        "-b:a 192k",
        "-ar 44100",
        "-shortest",
        "-movflags +faststart",
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error(`[MIX] Output file not created: ${outputPath}`));
        }
        console.log(`[MIX] Success: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[MIX] Failed: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Mute video audio completely.
 */
export const muteAudio = (
  inputPath: string,
  outputPath: string
): Promise<string> => {
  console.log(`[MUTE] Muting audio: ${inputPath} -> ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    return Promise.reject(new Error(`[MUTE] Input file does not exist: ${inputPath}`));
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters("volume=0")
      .outputOptions([
        "-c:v copy",
        "-c:a aac",
        "-b:a 32k", // Low bitrate since it's silent
        "-movflags +faststart",
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error(`[MUTE] Output file not created: ${outputPath}`));
        }
        console.log(`[MUTE] Success: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[MUTE] Failed: ${err.message}`);
        reject(err);
      });
  });
};

// =============================================================================
// SEGMENT PROCESSING: Cut, speed adjust, and concatenate multiple segments
// =============================================================================

export interface SegmentConfig {
  id: string;
  startTime: number;
  endTime: number;
  speed: number;
}

/**
 * Process a single segment: cut and apply speed change.
 * Returns the path to the processed segment.
 */
export const processSegment = async (
  inputPath: string,
  outputPath: string,
  segment: SegmentConfig
): Promise<string> => {
  const { startTime, endTime, speed } = segment;
  const duration = endTime - startTime;

  console.log(`[SEGMENT] Processing segment ${segment.id}: ${startTime.toFixed(2)}s-${endTime.toFixed(2)}s @ ${speed}x`);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[SEGMENT] Input file does not exist: ${inputPath}`);
  }

  // Build video filter: setpts for speed
  const videoPts = `setpts=PTS/${speed}`;

  // Build audio filter: atempo (chain for extreme speeds)
  let audioFilter: string;
  if (speed >= 0.5 && speed <= 2.0) {
    audioFilter = `atempo=${speed}`;
  } else if (speed < 0.5) {
    const numFilters = Math.ceil(Math.log(0.5 / speed) / Math.log(2)) + 1;
    const filterValue = Math.pow(speed, 1 / numFilters);
    audioFilter = Array(numFilters).fill(`atempo=${filterValue.toFixed(4)}`).join(",");
  } else {
    const numFilters = Math.ceil(Math.log(speed / 2.0) / Math.log(2)) + 1;
    const filterValue = Math.pow(speed, 1 / numFilters);
    audioFilter = Array(numFilters).fill(`atempo=${filterValue.toFixed(4)}`).join(",");
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .complexFilter([
        `[0:v]${videoPts}[v]`,
        `[0:a]${audioFilter}[a]`,
      ])
      .outputOptions([
        "-map", "[v]",
        "-map", "[a]",
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-avoid_negative_ts make_zero",
        "-reset_timestamps 1",
        "-movflags +faststart",
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error(`[SEGMENT] Output file not created: ${outputPath}`));
        }
        const stats = fs.statSync(outputPath);
        console.log(`[SEGMENT] Processed ${segment.id}: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[SEGMENT] Failed processing ${segment.id}: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Concatenate multiple video files into one.
 * Uses FFmpeg concat demuxer for efficient lossless concatenation.
 */
export const concatVideos = (
  inputPaths: string[],
  outputPath: string
): Promise<string> => {
  console.log(`[CONCAT] Concatenating ${inputPaths.length} videos -> ${outputPath}`);

  if (inputPaths.length === 0) {
    return Promise.reject(new Error("[CONCAT] No input files provided"));
  }

  if (inputPaths.length === 1) {
    // Just copy the single file
    fs.copyFileSync(inputPaths[0], outputPath);
    return Promise.resolve(outputPath);
  }

  // Create a concat list file
  const concatListPath = outputPath.replace(".mp4", "_concat_list.txt");
  const concatListContent = inputPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(concatListPath, concatListContent);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-movflags +faststart",
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        // Clean up concat list
        if (fs.existsSync(concatListPath)) {
          fs.unlinkSync(concatListPath);
        }

        if (!fs.existsSync(outputPath)) {
          return reject(new Error(`[CONCAT] Output file not created: ${outputPath}`));
        }
        const stats = fs.statSync(outputPath);
        console.log(`[CONCAT] Success: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        // Clean up concat list on error
        if (fs.existsSync(concatListPath)) {
          fs.unlinkSync(concatListPath);
        }
        console.error(`[CONCAT] Failed: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Generate a black video with silence for a given duration.
 * Matches the source video's dimensions for seamless concatenation.
 */
export const generateBlackSegment = (
  outputPath: string,
  duration: number,
  width: number,
  height: number
): Promise<string> => {
  console.log(`[BLACK] Generating ${duration.toFixed(2)}s black segment (${width}x${height}) -> ${outputPath}`);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input("color=c=black:s=" + width + "x" + height + ":r=30:d=" + duration.toFixed(4))
      .inputOptions(["-f lavfi"])
      .input("anullsrc=r=48000:cl=stereo")
      .inputOptions(["-f lavfi"])
      .outputOptions([
        "-t", duration.toFixed(4),
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-shortest",
        "-movflags +faststart",
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error(`[BLACK] Output file not created: ${outputPath}`));
        }
        console.log(`[BLACK] Success: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[BLACK] Failed: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Process multiple segments: cut each segment from source, apply per-segment speed,
 * generate black video for gaps between segments, and concatenate in order.
 */
export const processSegments = async (
  inputPath: string,
  outputPath: string,
  segments: SegmentConfig[],
  tempDir: string
): Promise<{ outputPath: string; tempFiles: string[] }> => {
  console.log(`[SEGMENTS] Processing ${segments.length} segments from ${inputPath}`);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[SEGMENTS] Input file does not exist: ${inputPath}`);
  }

  if (segments.length === 0) {
    throw new Error("[SEGMENTS] No segments provided");
  }

  const tempFiles: string[] = [];
  const concatParts: string[] = []; // Ordered list of video parts (segments + gaps)
  const timestamp = Date.now();

  // Get source video dimensions for generating matching black segments
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  // Sort segments by startTime to detect gaps
  const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);

  // Process each segment and detect gaps between them
  for (let i = 0; i < sortedSegments.length; i++) {
    const segment = sortedSegments[i];

    // Check for gap before this segment
    if (i > 0) {
      const prevSegment = sortedSegments[i - 1];
      const gapDuration = segment.startTime - prevSegment.endTime;

      if (gapDuration > 0.05) { // Ignore tiny gaps from floating point
        console.log(`[SEGMENTS] Gap detected: ${prevSegment.endTime.toFixed(2)}s to ${segment.startTime.toFixed(2)}s (${gapDuration.toFixed(2)}s)`);
        const gapPath = path.join(tempDir, `gap_${i}_${timestamp}.mp4`);
        await generateBlackSegment(gapPath, gapDuration, width, height);
        concatParts.push(gapPath);
        tempFiles.push(gapPath);
      }
    }

    // Process the actual segment
    const segmentPath = path.join(tempDir, `segment_${i}_${timestamp}.mp4`);
    await processSegment(inputPath, segmentPath, segment);
    concatParts.push(segmentPath);
    tempFiles.push(segmentPath);
  }

  // Concatenate all parts (segments + gaps)
  if (concatParts.length === 1) {
    fs.renameSync(concatParts[0], outputPath);
    tempFiles.pop();
  } else {
    await concatVideos(concatParts, outputPath);
  }

  console.log(`[SEGMENTS] All segments processed and concatenated: ${outputPath}`);

  return { outputPath, tempFiles };
};
