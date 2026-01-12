import * as Sentry from "@sentry/node";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import puppeteer from "puppeteer";
import path from "path";

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

const COMPRESSION_THRESHOLD = 200 * 1024 * 1024; // Only compress files > 200MB
const TARGET_CRF = 23; // Quality level (18-28, lower = better quality, 23 is default/good)
const MAX_BITRATE = 12000; // 12 Mbps max bitrate cap

// Mobile-compatible H.264 encoding settings
// profile:v main - Broad device support (especially older iOS/Android)
// level 3.1 - Compatible with most mobile devices
// pix_fmt yuv420p - Required for QuickTime/iOS playback
// g/keyint_min 30 - Keyframe every second for smooth seeking
// vsync cfr - Constant frame rate prevents mobile playback issues
const MOBILE_VIDEO_SETTINGS = [
  "-profile:v main",
  "-level 3.1",
  "-pix_fmt yuv420p",
  "-r 30",
  "-g 30",
  "-keyint_min 30",
  "-vsync cfr",
];

// Generate jumbled metadata to prevent duplicate detection
// Covers: encoder signatures, timestamps, software IDs, handler names, device info, and more
const generateJumbledMetadata = (): string[] => {
  // Encoder signatures (mimics different FFmpeg versions)
  const encoders = ["Lavf58.76.100", "Lavf59.27.100", "Lavf60.3.100", "Lavf60.16.100", "Lavf61.1.100"];
  const handlerNames = ["VideoHandler", "Core Media Video", "Apple Video Media Handler", "ISO Media file"];
  const majorBrands = ["isom", "mp42", "iso5", "avc1", "M4V "];

  // Device signatures (common phones/cameras)
  const devices = [
    { make: "Apple", model: "iPhone 14 Pro" },
    { make: "Apple", model: "iPhone 15 Pro Max" },
    { make: "Apple", model: "iPhone 13" },
    { make: "Samsung", model: "Galaxy S23 Ultra" },
    { make: "Samsung", model: "Galaxy S24" },
    { make: "Google", model: "Pixel 8 Pro" },
    { make: "Google", model: "Pixel 7" },
    { make: "OnePlus", model: "12" },
    { make: "Sony", model: "Xperia 1 V" },
    { make: "", model: "" }, // Sometimes no device info
  ];

  const randomEncoder = encoders[Math.floor(Math.random() * encoders.length)];
  const randomHandler = handlerNames[Math.floor(Math.random() * handlerNames.length)];
  const randomBrand = majorBrands[Math.floor(Math.random() * majorBrands.length)];
  const randomDevice = devices[Math.floor(Math.random() * devices.length)];

  // Random date within past 60 days
  const randomDate = new Date(Date.now() - Math.random() * 86400000 * 60).toISOString();
  // Random unique ID for this render
  const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 8);

  return [
    // Core metadata
    `-metadata`, `encoder=${randomEncoder}`,
    `-metadata`, `creation_time=${randomDate}`,
    `-metadata`, `comment=${randomId}`,
    // Clear identifying info
    `-metadata`, `title=`,
    `-metadata`, `artist=`,
    `-metadata`, `album=`,
    `-metadata`, `description=`,
    `-metadata`, `copyright=`,
    `-metadata`, `author=`,
    // Device identifiers (randomized)
    `-metadata`, `software=`,
    `-metadata`, `make=${randomDevice.make}`,
    `-metadata`, `model=${randomDevice.model}`,
    // Track handler names (important for fingerprinting)
    `-metadata:s:v:0`, `handler_name=${randomHandler}`,
    `-metadata:s:a:0`, `handler_name=SoundHandler`,
    // Container-level brand (MP4 box structure)
    `-brand`, randomBrand,
  ];
};

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
          ...generateJumbledMetadata(),
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

export const cutClip = (
  input: string,
  output: string,
  start: number,
  end: number
) => {
  const duration = end - start;
  console.log(
    `[CUT] Cutting ${start}s-${end}s (${duration.toFixed(1)}s) from ${input}`
  );

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
        ...generateJumbledMetadata(),
      ])
      .save(output)
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
        console.error(`[CUT] Failed: ${err.message}`);
        reject(err);
      })
      .run();
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
        ...generateJumbledMetadata(),
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

export const mergeClipsGpu = async (clips: string[], outputPath: string) => {
  console.log(`[MERGE-GPU] Merging ${clips.length} clips`);

  for (const clip of clips) {
    if (!fs.existsSync(clip)) {
      throw new Error(`[MERGE-GPU] Input clip not found: ${clip}`);
    }
    const stats = fs.statSync(clip);
    console.log(`[MERGE-GPU] Input: ${clip} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
  }

  const normalizedClips: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const normPath = clips[i].replace(/\.mp4$/, `_norm.mp4`);
    await normalizeClip(clips[i], normPath);
    normalizedClips.push(normPath);
  }

  return new Promise((resolve, reject) => {
    const listPath = outputPath + ".txt";
    const content = normalizedClips
      .map((c) => `file '${c.replace(/'/g, "'\\''")}'`)
      .join("\n");
    fs.writeFileSync(listPath, content);

    ffmpeg()
      .input(listPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions([
        "-c copy",
        "-fflags +genpts",
        "-movflags +faststart",
        ...generateJumbledMetadata(),
      ])
      .save(outputPath)
      .on("end", () => {
        fs.unlinkSync(listPath);
        normalizedClips.forEach((c) => fs.existsSync(c) && fs.unlinkSync(c));
        const finalStats = fs.statSync(outputPath);
        console.log(`[MERGE-GPU] Success: ${outputPath} (${(finalStats.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[MERGE-GPU] Failed: ${err.message}`);
        normalizedClips.forEach((c) => fs.existsSync(c) && fs.unlinkSync(c));
        reject(err);
      });
  });
};

export const mergeClips = async (clips: string[], outputPath: string) => {
  console.log(`[MERGE] Merging ${clips.length} clips...`);

  // Verify all input clips exist
  for (const clip of clips) {
    if (!fs.existsSync(clip)) {
      throw new Error(`[MERGE] Input clip not found: ${clip}`);
    }
    const stats = fs.statSync(clip);
    console.log(
      `[MERGE] Input: ${clip} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`
    );
  }

  const firstClip = clips[0];
  let metadata;
  try {
    metadata = await getVideoMetadata(firstClip);
    console.log(
      `[MERGE] First clip dimensions: ${metadata.width}x${metadata.height}`
    );
  } catch (err) {
    console.error(`[MERGE] Failed to get metadata for ${firstClip}:`, err);
    throw err;
  }
  const isHorizontal = metadata.width > metadata.height;

  return new Promise((resolve, reject) => {
    const listPath = outputPath + ".txt";
    const content = clips
      .map((c) => `file '${c.replace(/'/g, "'\\''")}'`)
      .join("\n");

    fs.writeFileSync(listPath, content);

    const ffmpegCmd = ffmpeg()
      .input(listPath)
      .inputOptions(["-f concat", "-safe 0"]);

    if (isHorizontal) {
      ffmpegCmd
        .complexFilter([
          {
            filter: "scale",
            options: {
              w: 1080,
              h: 1920,
              force_original_aspect_ratio: "increase",
            },
            inputs: "0:v",
            outputs: "bg1",
          },
          {
            filter: "crop",
            options: { w: 1080, h: 1920 },
            inputs: "bg1",
            outputs: "bg2",
          },
          {
            filter: "gblur",
            options: { sigma: 20 },
            inputs: "bg2",
            outputs: "bg",
          },
          {
            filter: "scale",
            options: {
              w: 1080,
              h: -2,
            },
            inputs: "0:v",
            outputs: "fg",
          },
          {
            filter: "overlay",
            options: {
              x: "(W-w)/2",
              y: "(H-h)/2",
            },
            inputs: ["bg", "fg"],
            outputs: "v",
          },
        ])
        .outputOptions([
          "-map [v]",
          "-map 0:a?",
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          ...MOBILE_VIDEO_SETTINGS,
          "-bf 0",
          "-movflags +faststart",
          "-c:a aac",
          "-b:a 128k",
          "-ar 48000",
          "-ac 2",
          ...generateJumbledMetadata(),
        ]);
    } else {
      ffmpegCmd.outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-bf 0",
        "-movflags +faststart",
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-ac 2",
        ...generateJumbledMetadata(),
      ]);
    }

    ffmpegCmd
      .save(outputPath)
      .on("end", () => {
        fs.unlinkSync(listPath);
        resolve(outputPath);
      })
      .on("error", (err) => reject(err));
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
          ...generateJumbledMetadata(),
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
        ...generateJumbledMetadata(),
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
          ...generateJumbledMetadata(),
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
