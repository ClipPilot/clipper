import * as Sentry from "@sentry/node";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import puppeteer from "puppeteer";
import path from "path";
import { MOBILE_VIDEO_SETTINGS, COMPRESSION } from "../../config/ffmpegSettings";
import type { ConversionMode } from "../../constants/conversionModes";
import type { ActiveSpeakerSegment } from "./speakerSegments.service";

export interface FacecamRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
        "-map_metadata", "-1",
      ])
      .save(outputPath)
      .on("stderr", (line: string) => { stderrLog += line + "\n"; })
      .on("end", () => {
        if (settled) return;
        settled = true;
        try { if (fs.existsSync(listPath)) fs.unlinkSync(listPath); } catch {}
        if (!fs.existsSync(outputPath)) {
          reject(new Error(`[MERGE] FFmpeg reported success but output file missing: ${outputPath}`));
          return;
        }
        console.log(`[MERGE] Success: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)}MB)`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        if (settled) return;
        settled = true;
        try { if (fs.existsSync(listPath)) fs.unlinkSync(listPath); } catch {}
        reject(err);
      });
  });
};

export const mergeClipsGpu = mergeClipsFaceSwap;
export const mergeClips = mergeClipsFaceSwap;

/**
 * Convert a horizontal video to 9:16 with a blurred background.
 * If the video is already vertical (height >= width), it's returned as-is.
 */
export const convertToVerticalBlur = async (
  inputPath: string,
  outputPath: string,
): Promise<string> => {
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  // Already vertical or square — skip conversion
  if (height >= width) {
    console.log(`[VERTICAL] Already vertical (${width}x${height}), skipping`);
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  console.log(`[VERTICAL] Converting horizontal ${width}x${height} to 9:16 with blur background`);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .complexFilter([
        // Blurred background: scale up to fill 1080x1920, crop, blur
        {
          filter: "scale",
          options: { w: 1080, h: 1920, force_original_aspect_ratio: "increase" },
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
          options: { sigma: 15 },
          inputs: "bg2",
          outputs: "bg",
        },
        // Foreground: scale to fill 1080 width, maintain aspect ratio
        {
          filter: "scale",
          options: { w: 1080, h: -2 },
          inputs: "0:v",
          outputs: "fg",
        },
        // Center foreground on blurred background
        {
          filter: "overlay",
          options: { x: "(W-w)/2", y: "(H-h)/2" },
          inputs: ["bg", "fg"],
          outputs: "v",
        },
      ])
      .outputOptions([
        "-map", "[v]",
        "-map", "0:a?",
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
        console.log(`[VERTICAL] Converted to 9:16: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[VERTICAL] Conversion failed: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Convert a horizontal video to 9:16 gaming layout:
 * Facecam on top half, center-cropped gameplay on bottom half.
 * Requires a facecam bounding box from the facecam-detect Lambda.
 */
export const convertToGamingVertical = async (
  inputPath: string,
  outputPath: string,
  facecam: FacecamRegion,
): Promise<string> => {
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  if (height >= width) {
    console.log(`[GAMING] Already vertical (${width}x${height}), skipping`);
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  console.log(`[GAMING] Converting ${width}x${height} to gaming layout (facecam: ${JSON.stringify(facecam)})`);

  const fcX = Math.max(0, Math.min(facecam.x, width - 1));
  const fcY = Math.max(0, Math.min(facecam.y, height - 1));
  const fcW = Math.min(facecam.w, width - fcX);
  const fcH = Math.min(facecam.h, height - fcY);

  // Scale facecam proportionally to 1080 width — pure resize, no distortion
  let faceOutH = Math.round(fcH * (1080 / fcW));
  faceOutH += faceOutH % 2;
  const gameOutH = 1920 - faceOutH;

  console.log(`[GAMING] Face crop: ${fcW}x${fcH} at (${fcX},${fcY}) → 1080x${faceOutH}, gameplay: 1080x${gameOutH}`);

  // Center-crop gameplay from the full frame to fill remaining space
  const gameplayAR = 1080 / gameOutH;
  let gpW: number, gpH: number, gpX: number, gpY: number;
  if (width / height > gameplayAR) {
    gpH = height; gpW = Math.round(height * gameplayAR);
    gpX = Math.round((width - gpW) / 2); gpY = 0;
  } else {
    gpW = width; gpH = Math.round(width / gameplayAR);
    gpX = 0; gpY = Math.round((height - gpH) / 2);
  }

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .complexFilter([
        `[0:v]crop=${fcW}:${fcH}:${fcX}:${fcY},scale=1080:${faceOutH}[cam]`,
        `[0:v]crop=${gpW}:${gpH}:${gpX}:${gpY},scale=1080:${gameOutH}[game]`,
        `[cam][game]vstack=inputs=2[v]`,
      ])
      .outputOptions([
        "-map", "[v]",
        "-map", "0:a?",
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
        console.log(`[GAMING] Converted to gaming layout: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[GAMING] Conversion failed: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Convert a horizontal video to 9:16 by cropping a region centered on a face.
 * Good for talking-head / speaker content where you want to zoom into the speaker.
 */
export const convertToSpeakerZoom = async (
  inputPath: string,
  outputPath: string,
  faceRegion: FacecamRegion,
): Promise<string> => {
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  if (height >= width) {
    console.log(`[SPEAKER-ZOOM] Already vertical (${width}x${height}), skipping`);
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  // Calculate a 9:16 crop centered on the face
  const targetRatio = 9 / 16;
  let cropW: number;
  let cropH: number;

  // Start with the full height and calculate width from ratio
  cropH = height;
  cropW = Math.round(height * targetRatio);

  // If that's wider than the source, constrain by width
  if (cropW > width) {
    cropW = width;
    cropH = Math.round(width / targetRatio);
  }

  // Center the crop on the face's center X position
  const faceCenterX = faceRegion.x + faceRegion.w / 2;
  let cropX = Math.round(faceCenterX - cropW / 2);
  cropX = Math.max(0, Math.min(cropX, width - cropW));

  // Center vertically on the face as well
  const faceCenterY = faceRegion.y + faceRegion.h / 2;
  let cropY = Math.round(faceCenterY - cropH / 2);
  cropY = Math.max(0, Math.min(cropY, height - cropH));

  console.log(`[SPEAKER-ZOOM] Cropping ${cropW}x${cropH} at (${cropX},${cropY}) centered on face, then scaling to 1080x1920`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .complexFilter([
        {
          filter: "crop",
          options: { w: cropW, h: cropH, x: cropX, y: cropY },
          inputs: "0:v",
          outputs: "cropped",
        },
        {
          filter: "scale",
          options: { w: 1080, h: 1920 },
          inputs: "cropped",
          outputs: "v",
        },
      ])
      .outputOptions([
        "-map", "[v]",
        "-map", "0:a?",
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
        console.log(`[SPEAKER-ZOOM] Converted: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[SPEAKER-ZOOM] Failed: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Convert a horizontal video to 9:16 via center crop (no blur, no letterbox).
 * Thin wrapper around changeAspectRatio.
 */
export const convertToCenterCrop = async (
  inputPath: string,
  outputPath: string,
): Promise<string> => {
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  if (height >= width) {
    console.log(`[CENTER-CROP] Already vertical (${width}x${height}), skipping`);
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  console.log(`[CENTER-CROP] Cropping ${width}x${height} to 9:16`);
  return changeAspectRatio(inputPath, outputPath, "9:16");
};

/**
 * Convert a horizontal video to 9:16 with dynamic active speaker zoom.
 *
 * For each speaker segment, crops a 9:16 region centered on that speaker's face,
 * then concatenates all segments. Uses trim→crop→scale per segment with concat demuxer.
 */
export const convertToActiveSpeakerZoom = async (
  inputPath: string,
  outputPath: string,
  segments: ActiveSpeakerSegment[],
  speakerFaceMap: Map<number, FacecamRegion>,
): Promise<string> => {
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  if (height >= width) {
    console.log(`[ACTIVE-SPEAKER] Already vertical (${width}x${height}), skipping`);
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  console.log(`[ACTIVE-SPEAKER] Processing ${segments.length} speaker segments from ${width}x${height}`);

  // Calculate 9:16 crop dimensions (same logic as speaker-zoom)
  const targetRatio = 9 / 16;
  let cropW: number;
  let cropH: number;

  cropH = height;
  cropW = Math.round(height * targetRatio);

  if (cropW > width) {
    cropW = width;
    cropH = Math.round(width / targetRatio);
  }

  const tempDir = path.dirname(outputPath);
  const timestamp = Date.now();
  const segmentPaths: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const face = speakerFaceMap.get(seg.speaker);

    if (!face) {
      console.warn(`[ACTIVE-SPEAKER] No face for speaker ${seg.speaker}, using center crop`);
    }

    // Center crop on the speaker's face (or center of frame if no face)
    const faceCenterX = face ? face.x + face.w / 2 : width / 2;
    const faceCenterY = face ? face.y + face.h / 2 : height / 2;

    let cropX = Math.round(faceCenterX - cropW / 2);
    cropX = Math.max(0, Math.min(cropX, width - cropW));

    let cropY = Math.round(faceCenterY - cropH / 2);
    cropY = Math.max(0, Math.min(cropY, height - cropH));

    const segmentPath = path.join(tempDir, `as_seg_${i}_${timestamp}.mp4`);
    const duration = seg.end - seg.start;

    console.log(`[ACTIVE-SPEAKER] Segment ${i}: speaker=${seg.speaker} ${seg.start.toFixed(2)}s-${seg.end.toFixed(2)}s crop=(${cropX},${cropY}) ${cropW}x${cropH}`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(seg.start)
        .setDuration(duration)
        .complexFilter([
          {
            filter: "crop",
            options: { w: cropW, h: cropH, x: cropX, y: cropY },
            inputs: "0:v",
            outputs: "cropped",
          },
          {
            filter: "scale",
            options: { w: 1080, h: 1920 },
            inputs: "cropped",
            outputs: "v",
          },
        ])
        .outputOptions([
          "-map", "[v]",
          "-map", "0:a?",
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
        ])
        .save(segmentPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });

    segmentPaths.push(segmentPath);
  }

  // Concatenate all segments
  if (segmentPaths.length === 1) {
    fs.renameSync(segmentPaths[0], outputPath);
  } else {
    const concatListPath = path.join(tempDir, `as_concat_${timestamp}.txt`);
    const concatContent = segmentPaths
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    fs.writeFileSync(concatListPath, concatContent);

    await new Promise<void>((resolve, reject) => {
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
        ])
        .save(outputPath)
        .on("end", () => {
          try {
            if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
          } catch { /* best effort cleanup */ }
          resolve();
        })
        .on("error", (err) => {
          try {
            if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
          } catch { /* best effort cleanup */ }
          reject(err);
        });
    });

    // Clean up segment temp files
    for (const p of segmentPaths) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }

  console.log(`[ACTIVE-SPEAKER] Converted: ${outputPath}`);
  return outputPath;
};

/**
 * Dispatcher: convert horizontal video to vertical using the specified mode.
 * Falls back to blurred-bg when face detection returns null for modes that need it.
 */
export const convertToVertical = async (
  inputPath: string,
  outputPath: string,
  mode?: ConversionMode,
  facecamRegion?: FacecamRegion | null,
  activeSpeakerOptions?: {
    segments: ActiveSpeakerSegment[];
    speakerFaceMap: Map<number, FacecamRegion>;
  } | null,
): Promise<string> => {
  const effectiveMode = mode || "standard";

  switch (effectiveMode) {
    case "center-crop":
      return convertToCenterCrop(inputPath, outputPath);

    case "gaming":
      if (facecamRegion) {
        return convertToGamingVertical(inputPath, outputPath, facecamRegion);
      }
      console.warn("[VERTICAL] Gaming mode but no facecam detected — falling back to standard");
      return convertToVerticalBlur(inputPath, outputPath);

    case "speaker-zoom":
      if (facecamRegion) {
        return convertToSpeakerZoom(inputPath, outputPath, facecamRegion);
      }
      console.warn("[VERTICAL] Speaker-zoom mode but no face region — falling back to standard");
      return convertToVerticalBlur(inputPath, outputPath);

    case "active-speaker":
      if (activeSpeakerOptions && activeSpeakerOptions.segments.length > 1) {
        return convertToActiveSpeakerZoom(
          inputPath, outputPath,
          activeSpeakerOptions.segments,
          activeSpeakerOptions.speakerFaceMap,
        );
      }
      // Fallback: single speaker with face → static zoom, no face → blurred bg
      if (facecamRegion) {
        console.warn("[VERTICAL] Active-speaker but single speaker/face — falling back to speaker-zoom");
        return convertToSpeakerZoom(inputPath, outputPath, facecamRegion);
      }
      console.warn("[VERTICAL] Active-speaker but no faces detected — falling back to standard");
      return convertToVerticalBlur(inputPath, outputPath);

    case "standard":
    default:
      return convertToVerticalBlur(inputPath, outputPath);
  }
};

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
// Local fonts use @font-face with the TTF/OTF files bundled in dist/fonts/
interface FontConfig {
  url?: string; // Google Fonts URL (omit for local fonts)
  family: string;
  localFile?: string; // filename in fonts/ dir for @font-face
}

const FONT_CONFIG: Record<string, FontConfig> = {
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
  Everlasting: {
    family: "'Everlasting', cursive",
    localFile: "Everlasting.ttf",
  },
  Komika: {
    family: "'Komika', sans-serif",
    localFile: "Komika.ttf",
  },
  Burbank: {
    family: "'Burbank', sans-serif",
    localFile: "Burbank.otf",
  },
};

const EMOJI_FONT = "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji'";

const MAC_RENDERER_URL = process.env.MAC_RENDERER_URL || "";

/**
 * Render HTML to PNG via the remote Mac renderer, or fall back to local Puppeteer.
 * When MAC_RENDERER_URL is set, sends HTML to the Mac for Apple-native font rendering.
 */
async function renderHtmlToPng(
  html: string,
  outputPath: string,
  opts: { width?: number; height?: number; deviceScaleFactor?: number } = {}
): Promise<void> {
  const { width = 1080, height = 400, deviceScaleFactor = 1 } = opts;

  if (MAC_RENDERER_URL) {
    try {
      const response = await fetch(`${MAC_RENDERER_URL}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, width, height, deviceScaleFactor }),
        signal: AbortSignal.timeout(15_000),
      });

      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        console.log(`[renderHtmlToPng] Rendered via Mac renderer`);
        return;
      }
      console.warn(`[renderHtmlToPng] Mac renderer returned ${response.status}, falling back to local`);
    } catch (err: any) {
      console.warn(`[renderHtmlToPng] Mac renderer unavailable (${err.message}), falling back to local`);
    }
  }

  // Fallback: local Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.setContent(html);
    await page.evaluate("document.fonts.ready");
    await page.screenshot({ path: outputPath, type: "png", omitBackground: true });
  } finally {
    await browser.close();
  }
}

function buildFontFaceCSS(fontConfig: FontConfig): string {
  if (!fontConfig.localFile) return "";
  const fontPath = path.join(__dirname, "../../fonts", fontConfig.localFile);
  if (!fs.existsSync(fontPath)) return "";
  const fontData = fs.readFileSync(fontPath);
  const base64 = fontData.toString("base64");
  const ext = fontConfig.localFile.endsWith(".otf") ? "opentype" : "truetype";
  const familyName = fontConfig.family.replace(/'/g, "").split(",")[0].trim();
  return `@font-face { font-family: '${familyName}'; src: url(data:font/${ext};base64,${base64}) format('${ext}'); font-weight: 900; }`;
}

const generateTextImage = async (
  text: string,
  outputPath: string,
  fillColor: string = "#FFFFFF",
  strokeColor: string = "#000000",
  fontName: string = "Montserrat",
  style: "stroke" | "instagram" = "stroke"
): Promise<void> => {
  // Get font config or fallback to Montserrat
  const fontConfig = FONT_CONFIG[fontName] || FONT_CONFIG["Montserrat"];
  const fontFaceCSS = buildFontFaceCSS(fontConfig);
  const googleFontLink = fontConfig.url
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
       <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
       <link href="${fontConfig.url}" rel="stylesheet">`
    : "";

  const isInstagram = style === "instagram";

  const textStyle = isInstagram
    ? `color: #FFFFFF;
       background: rgba(0, 0, 0, 0.85);
       padding: 12px 28px;
       border-radius: 8px;
       display: inline-block;`
    : `color: ${fillColor};
       -webkit-text-stroke: 6px ${strokeColor};
       paint-order: stroke fill;`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        ${googleFontLink}
        <style>
          ${fontFaceCSS}
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
            font-family: ${fontConfig.family}, ${EMOJI_FONT}, sans-serif;
            text-align: center;
            line-height: 1.25;
            letter-spacing: -0.01em;
            word-wrap: break-word;
            overflow-wrap: break-word;
            max-width: 100%;
            ${textStyle}
          }
        </style>
      </head>
      <body>
        <div class="text">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      </body>
    </html>
  `;

  await renderHtmlToPng(htmlContent, outputPath, { width: 1080, height: 400, deviceScaleFactor: 1 });

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Failed to create text image at ${outputPath}`);
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
  fontName: string = "Montserrat",
  style: "stroke" | "instagram" = "stroke"
): Promise<string> => {
  const textImagePath = path.join(
    path.dirname(outputPath),
    `text_pos_${Date.now()}.png`
  );

  // Get font config or fallback to Montserrat
  const fontConfig = FONT_CONFIG[fontName] || FONT_CONFIG["Montserrat"];
  const fontFaceCSS = buildFontFaceCSS(fontConfig);
  const googleFontLink = fontConfig.url
    ? `<link href="${fontConfig.url}" rel="stylesheet">`
    : "";
  const isInstagram = style === "instagram";

  try {
    const textStyle = isInstagram
      ? `color: #FFFFFF;
         background: rgba(0, 0, 0, 0.85);
         padding: 10px 24px;
         border-radius: 8px;
         display: inline-block;`
      : `color: ${fillColor};
         -webkit-text-stroke: 4px ${strokeColor};
         paint-order: stroke fill;`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          ${googleFontLink}
          <style>
            ${fontFaceCSS}
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
              font-family: ${fontConfig.family}, ${EMOJI_FONT}, sans-serif;
              text-align: center;
              line-height: 1.2;
              max-width: 100%;
              ${textStyle}
            }
          </style>
        </head>
        <body>
          <div class="text">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </body>
      </html>
    `;

    await renderHtmlToPng(htmlContent, textImagePath, { width: 1080, height: 400, deviceScaleFactor: 1 });

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
  fontName: string = "Montserrat",
  style: "stroke" | "instagram" = "stroke"
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
      fontName,
      style
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

// =============================================================================
// MEDIA OVERLAY: Composite images/videos on top of the main video
// =============================================================================

export interface MediaOverlayItem {
  type: "image" | "video";
  localPath: string;
  startTime: number;
  endTime: number;
  x: number; // percentage 0-100
  y: number;
  scale: number;
  opacity: number;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Apply media overlays (images/videos) on top of a video.
 * Uses FFmpeg complexFilter with overlay + enable for time-gating.
 * Same pattern as addPreviewWatermark but with user-specified positioning.
 */
export const applyMediaOverlays = async (
  inputPath: string,
  outputPath: string,
  overlays: MediaOverlayItem[]
): Promise<string> => {
  console.log(`[OVERLAY] Applying ${overlays.length} overlay(s): ${inputPath} -> ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[OVERLAY] Input file does not exist: ${inputPath}`);
  }

  if (overlays.length === 0) {
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  // Get video metadata for calculating pixel positions
  const metadata = await getVideoMetadata(inputPath);
  const { width: videoWidth, height: videoHeight } = metadata;

  // Build FFmpeg command with inputs and complex filter
  const inputs: string[] = ["-i", inputPath];
  const filterParts: string[] = [];

  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];

    if (!fs.existsSync(overlay.localPath)) {
      console.warn(`[OVERLAY] Overlay file missing, skipping: ${overlay.localPath}`);
      continue;
    }

    inputs.push("-i", overlay.localPath);
    const inputIdx = i + 1; // 0 is the main video

    // Calculate scaled overlay dimensions
    const scaledWidth = Math.round(overlay.naturalWidth * overlay.scale);
    const scaledHeight = Math.round(overlay.naturalHeight * overlay.scale);

    // Clamp overlay size to video dimensions
    const finalWidth = Math.min(scaledWidth, videoWidth);
    const finalHeight = Math.min(scaledHeight, videoHeight);

    // Position: convert percentage to pixel, center the overlay
    const xPixel = Math.round((overlay.x / 100) * videoWidth - finalWidth / 2);
    const yPixel = Math.round((overlay.y / 100) * videoHeight - finalHeight / 2);

    // Input label for this overlay
    const prevLabel = i === 0 ? "[0:v]" : `[v${i}]`;
    const outLabel = i === overlays.length - 1 ? "[vout]" : `[v${i + 1}]`;

    // Scale + set opacity for this overlay input
    const overlayLabel = `[ov${i}]`;
    filterParts.push(
      `[${inputIdx}:v]scale=${finalWidth}:${finalHeight},format=rgba,colorchannelmixer=aa=${overlay.opacity}${overlayLabel}`
    );

    // Apply overlay with time-gating using enable
    filterParts.push(
      `${prevLabel}${overlayLabel}overlay=${xPixel}:${yPixel}:enable='between(t,${overlay.startTime},${overlay.endTime})'${outLabel}`
    );
  }

  if (filterParts.length === 0) {
    // All overlays were missing, just copy
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  const filterComplex = filterParts.join(";");
  console.log(`[OVERLAY] Filter: ${filterComplex}`);

  return new Promise<string>((resolve, reject) => {
    const { execSync } = require("child_process");
    const inputArgs = inputs.join(" ");
    const cmd = `ffmpeg -y ${inputArgs} -filter_complex "${filterComplex}" -map "[vout]" -map "0:a?" -c:v libx264 -preset fast -crf 23 ${MOBILE_VIDEO_SETTINGS.join(" ")} -c:a aac -b:a 128k -ar 48000 -movflags +faststart "${outputPath}"`;

    try {
      execSync(cmd, { stdio: "pipe", maxBuffer: 100 * 1024 * 1024 });
      console.log(`[OVERLAY] Success: ${outputPath}`);
      resolve(outputPath);
    } catch (err) {
      console.error(`[OVERLAY] Failed:`, (err as Error).message);
      reject(err);
    }
  });
};

// =============================================================================
// COMMENT OVERLAY: Generate social media comment images via Puppeteer
// =============================================================================

export interface CommentOverlayConfig {
  platform: "tiktok" | "youtube" | "instagram";
  username: string;
  commentText: string;
  profilePicturePath?: string; // Local file path (downloaded from S3)
  likesCount: number;
  isVerified: boolean;
  timeAgo?: string;
}

const formatLikesCount = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
};

const hashColor = (str: string): string => {
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const VERIFIED_BADGE_SVG = {
  tiktok: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#20D5EC"/><path d="M8.5 13.5L5 10l1.4-1.4 2.1 2.1 4.6-4.6L14.5 7.5l-6 6z" fill="#fff"/></svg>`,
  youtube: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#aaa"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  instagram: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#3897F0"/><path d="M8.5 13.5L5 10l1.4-1.4 2.1 2.1 4.6-4.6L14.5 7.5l-6 6z" fill="#fff"/></svg>`,
};

const HEART_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

const THUMBS_UP_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#aaa" xmlns="http://www.w3.org/2000/svg"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>`;

const getDefaultAvatarDataUri = (_username: string): string => {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><circle cx="36" cy="36" r="36" fill="#C4C4C4"/><path d="M36 36c5.4 0 9.6-4.2 9.6-9.6S41.4 16.8 36 16.8 26.4 21 26.4 26.4 30.6 36 36 36zm0 4.8c-6.4 0-19.2 3.2-19.2 9.6v2.4c0 1.32 1.08 2.4 2.4 2.4h33.6c1.32 0 2.4-1.08 2.4-2.4v-2.4c0-6.4-12.8-9.6-19.2-9.6z" fill="#fff"/></svg>`
  )}`;
};

const getCommentHtml = (
  config: CommentOverlayConfig,
  profilePicSrc: string
): string => {
  const { platform, username, commentText, likesCount, isVerified, timeAgo } = config;
  const likes = formatLikesCount(likesCount);
  const badge = isVerified ? VERIFIED_BADGE_SVG[platform] : "";
  const safeUsername = escapeHtml(username);
  const safeComment = escapeHtml(commentText);
  const time = escapeHtml(timeAgo || "2h");

  if (platform === "tiktok") {
    return `
      <!DOCTYPE html><html><head><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 800px; background: transparent; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        .comment { background: rgba(255,255,255,0.95); border-radius: 16px; padding: 16px 20px; display: inline-flex; flex-direction: column; gap: 10px; max-width: 760px; }
        .header { color: #8A8A8A; font-size: 16px; font-weight: 600; }
        .content { display: flex; align-items: center; gap: 14px; }
        .avatar { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .text { color: #000; font-size: 20px; font-weight: 700; line-height: 1.3; word-wrap: break-word; flex: 1; min-width: 0; }
      </style></head><body>
        <div class="comment">
          <div class="header">Reply to @${safeUsername}'s comment</div>
          <div class="content">
            <img class="avatar" src="${profilePicSrc}" />
            <div class="text">${safeComment}</div>
          </div>
        </div>
      </body></html>
    `;
  }

  if (platform === "youtube") {
    return `
      <!DOCTYPE html><html><head><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 800px; background: transparent; padding: 16px; font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .comment { background: rgba(28,28,28,0.92); border-radius: 12px; padding: 14px 16px; display: inline-flex; align-items: flex-start; gap: 12px; max-width: 760px; }
        .avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .body { flex: 1; min-width: 0; }
        .username-row { display: flex; align-items: center; gap: 6px; }
        .username { color: #aaa; font-size: 13px; font-weight: 500; }
        .time { color: #717171; font-size: 12px; }
        .text { color: #fff; font-size: 14px; margin-top: 4px; line-height: 1.4; word-wrap: break-word; }
        .actions { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
        .actions span { color: #aaa; font-size: 12px; }
      </style></head><body>
        <div class="comment">
          <img class="avatar" src="${profilePicSrc}" />
          <div class="body">
            <div class="username-row"><span class="username">@${safeUsername}</span>${badge}<span class="time">${time}</span></div>
            <div class="text">${safeComment}</div>
            <div class="actions">${THUMBS_UP_SVG}<span>${likes}</span></div>
          </div>
        </div>
      </body></html>
    `;
  }

  // Instagram
  return `
    <!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { width: 800px; background: transparent; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .comment { background: rgba(0,0,0,0.6); border-radius: 20px; padding: 12px 16px; display: inline-flex; align-items: flex-start; gap: 10px; max-width: 760px; }
      .avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
      .body { flex: 1; min-width: 0; }
      .username-row { display: flex; align-items: center; gap: 4px; }
      .username { color: #fff; font-size: 13px; font-weight: 600; }
      .time { color: rgba(255,255,255,0.4); font-size: 12px; }
      .text { color: #fff; font-size: 13px; margin-top: 3px; line-height: 1.35; word-wrap: break-word; }
      .likes { display: flex; flex-direction: column; align-items: center; gap: 1px; margin-left: 8px; flex-shrink: 0; }
      .likes svg { width: 16px; height: 16px; fill: rgba(255,255,255,0.7); }
      .likes span { color: rgba(255,255,255,0.6); font-size: 11px; }
    </style></head><body>
      <div class="comment">
        <img class="avatar" src="${profilePicSrc}" />
        <div class="body">
          <div class="username-row"><span class="username">${safeUsername}</span>${badge}<span class="time">${time}</span></div>
          <div class="text">${safeComment}</div>
        </div>
        <div class="likes">${HEART_ICON_SVG}<span>${likes}</span></div>
      </div>
    </body></html>
  `;
};

/**
 * Generate a social media comment overlay image using Puppeteer.
 * Returns the rendered dimensions (CSS pixels) for FFmpeg positioning.
 */
export const generateCommentImage = async (
  config: CommentOverlayConfig,
  outputPath: string
): Promise<{ width: number; height: number }> => {
  console.log(`[COMMENT] Generating ${config.platform} comment image for @${config.username}`);

  // Build profile picture data URI
  let profilePicSrc = getDefaultAvatarDataUri(config.username);
  if (config.profilePicturePath && fs.existsSync(config.profilePicturePath)) {
    const imageBuffer = fs.readFileSync(config.profilePicturePath);
    const ext = path.extname(config.profilePicturePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    profilePicSrc = `data:${mime};base64,${imageBuffer.toString("base64")}`;
  }

  const htmlContent = getCommentHtml(config, profilePicSrc);

  // Try Mac renderer first (render-and-measure returns PNG + dimensions in headers)
  if (MAC_RENDERER_URL) {
    try {
      const response = await fetch(`${MAC_RENDERER_URL}/render-and-measure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: htmlContent,
          selector: ".comment",
          width: 800,
          height: 400,
          deviceScaleFactor: 2,
          padding: 32,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        const dimensions = {
          width: parseInt(response.headers.get("X-Render-Width") || "800", 10),
          height: parseInt(response.headers.get("X-Render-Height") || "200", 10),
        };
        console.log(`[COMMENT] Generated via Mac renderer: ${dimensions.width}x${dimensions.height}px`);
        return dimensions;
      }
      console.warn(`[COMMENT] Mac renderer returned ${response.status}, falling back to local`);
    } catch (err: any) {
      console.warn(`[COMMENT] Mac renderer unavailable (${err.message}), falling back to local`);
    }
  }

  // Fallback: local Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 400, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const commentEl = await page.$(".comment");
    let dimensions = { width: 800, height: 200 };
    if (commentEl) {
      const box = await commentEl.boundingBox();
      if (box) {
        dimensions = { width: Math.ceil(box.width) + 32, height: Math.ceil(box.height) + 32 };
      }
    }

    await page.screenshot({
      path: outputPath,
      type: "png",
      omitBackground: true,
      clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height },
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Failed to create comment image at ${outputPath}`);
    }

    console.log(`[COMMENT] Generated ${config.platform} comment: ${dimensions.width}x${dimensions.height}px -> ${outputPath}`);
    return dimensions;
  } finally {
    await browser.close();
  }
};
