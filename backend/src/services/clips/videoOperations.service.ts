import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { MOBILE_VIDEO_SETTINGS } from "../../config/ffmpegSettings";
import { getVideoMetadata, getVideoDuration } from "./videoEditor.utils";

export const mergeClipsWithCrossfade = async (
  clips: string[],
  outputPath: string,
  overlapDuration: number = 0.3,
): Promise<string> => {
  console.log(
    `[MERGE-XFADE] Merging ${clips.length} clips with ${overlapDuration}s crossfade`,
  );

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

    offset =
      i === 0
        ? durations[0] - overlapDuration
        : offset + durations[i] - overlapDuration;

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

export const changeSpeed = (
  inputPath: string,
  outputPath: string,
  speed: number,
): Promise<string> => {
  console.log(
    `[SPEED] Changing speed to ${speed}x: ${inputPath} -> ${outputPath}`,
  );

  if (speed <= 0 || speed > 4) {
    return Promise.reject(
      new Error(`Invalid speed: ${speed}. Must be between 0.25 and 4.0`),
    );
  }

  if (!fs.existsSync(inputPath)) {
    return Promise.reject(
      new Error(`[SPEED] Input file does not exist: ${inputPath}`),
    );
  }

  const videoPts = `setpts=PTS/${speed}`;

  let audioFilter: string;
  if (speed >= 0.5 && speed <= 2.0) {
    audioFilter = `atempo=${speed}`;
  } else if (speed < 0.5) {
    const numFilters = Math.ceil(Math.log(0.5 / speed) / Math.log(2)) + 1;
    const filterValue = Math.pow(speed, 1 / numFilters);
    audioFilter = Array(numFilters)
      .fill(`atempo=${filterValue.toFixed(4)}`)
      .join(",");
  } else {
    const numFilters = Math.ceil(Math.log(speed / 2.0) / Math.log(2)) + 1;
    const filterValue = Math.pow(speed, 1 / numFilters);
    audioFilter = Array(numFilters)
      .fill(`atempo=${filterValue.toFixed(4)}`)
      .join(",");
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .complexFilter([`[0:v]${videoPts}[v]`, `[0:a]${audioFilter}[a]`])
      .outputOptions([
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-movflags +faststart",
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(
            new Error(`[SPEED] Output file not created: ${outputPath}`),
          );
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

export const cropVideo = (
  inputPath: string,
  outputPath: string,
  crop: { x: number; y: number; width: number; height: number },
): Promise<string> => {
  console.log(
    `[CROP] Cropping to ${crop.width}x${crop.height} at (${crop.x},${crop.y}): ${inputPath} -> ${outputPath}`,
  );

  if (!fs.existsSync(inputPath)) {
    return Promise.reject(
      new Error(`[CROP] Input file does not exist: ${inputPath}`),
    );
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
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(
            new Error(`[CROP] Output file not created: ${outputPath}`),
          );
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

export const adjustVolume = (
  inputPath: string,
  outputPath: string,
  volume: number,
): Promise<string> => {
  console.log(
    `[VOLUME] Adjusting to ${volume}x: ${inputPath} -> ${outputPath}`,
  );

  if (!fs.existsSync(inputPath)) {
    return Promise.reject(
      new Error(`[VOLUME] Input file does not exist: ${inputPath}`),
    );
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
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(
            new Error(`[VOLUME] Output file not created: ${outputPath}`),
          );
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

export const mixBackgroundMusic = (
  videoPath: string,
  musicPath: string,
  outputPath: string,
  config: {
    originalVolume: number;
    musicVolume: number;
    musicStartTime: number;
    musicTrimStart: number;
    musicTrimEnd: number;
  },
): Promise<string> => {
  console.log(
    `[MIX] Mixing music: video=${videoPath}, music=${musicPath} -> ${outputPath}`,
  );
  console.log(
    `[MIX] Config: originalVol=${config.originalVolume}, musicVol=${config.musicVolume}, startAt=${config.musicStartTime}s`,
  );

  if (!fs.existsSync(videoPath)) {
    return Promise.reject(
      new Error(`[MIX] Video file does not exist: ${videoPath}`),
    );
  }
  if (!fs.existsSync(musicPath)) {
    return Promise.reject(
      new Error(`[MIX] Music file does not exist: ${musicPath}`),
    );
  }

  const musicDuration = config.musicTrimEnd - config.musicTrimStart;
  const delayMs = Math.round(config.musicStartTime * 1000);

  const filterComplex = [
    `[0:a]volume=${config.originalVolume}[original]`,
    `[1:a]atrim=start=${config.musicTrimStart}:end=${config.musicTrimEnd},asetpts=PTS-STARTPTS,volume=${config.musicVolume},adelay=${delayMs}|${delayMs}[music]`,
    `[original][music]amix=inputs=2:duration=first:dropout_transition=2[mixed]`,
  ].join(";");

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(musicPath)
      .complexFilter(filterComplex)
      .outputOptions([
        "-map",
        "0:v",
        "-map",
        "[mixed]",
        "-c:v copy",
        "-c:a aac",
        "-b:a 192k",
        "-ar 44100",
        "-shortest",
        "-movflags +faststart",
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(
            new Error(`[MIX] Output file not created: ${outputPath}`),
          );
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

export const muteAudio = (
  inputPath: string,
  outputPath: string,
): Promise<string> => {
  console.log(`[MUTE] Muting audio: ${inputPath} -> ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    return Promise.reject(
      new Error(`[MUTE] Input file does not exist: ${inputPath}`),
    );
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters("volume=0")
      .outputOptions([
        "-c:v copy",
        "-c:a aac",
        "-b:a 32k",
        "-movflags +faststart",
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(
            new Error(`[MUTE] Output file not created: ${outputPath}`),
          );
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

export interface SegmentConfig {
  id: string;
  startTime: number;
  endTime: number;
  speed: number;
}

export const processSegment = async (
  inputPath: string,
  outputPath: string,
  segment: SegmentConfig,
): Promise<string> => {
  const { startTime, endTime, speed } = segment;
  const duration = endTime - startTime;

  console.log(
    `[SEGMENT] Processing segment ${segment.id}: ${startTime.toFixed(2)}s-${endTime.toFixed(2)}s @ ${speed}x`,
  );

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[SEGMENT] Input file does not exist: ${inputPath}`);
  }

  const videoPts = `setpts=PTS/${speed}`;

  let audioFilter: string;
  if (speed >= 0.5 && speed <= 2.0) {
    audioFilter = `atempo=${speed}`;
  } else if (speed < 0.5) {
    const numFilters = Math.ceil(Math.log(0.5 / speed) / Math.log(2)) + 1;
    const filterValue = Math.pow(speed, 1 / numFilters);
    audioFilter = Array(numFilters)
      .fill(`atempo=${filterValue.toFixed(4)}`)
      .join(",");
  } else {
    const numFilters = Math.ceil(Math.log(speed / 2.0) / Math.log(2)) + 1;
    const filterValue = Math.pow(speed, 1 / numFilters);
    audioFilter = Array(numFilters)
      .fill(`atempo=${filterValue.toFixed(4)}`)
      .join(",");
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .complexFilter([`[0:v]${videoPts}[v]`, `[0:a]${audioFilter}[a]`])
      .outputOptions([
        "-map",
        "[v]",
        "-map",
        "[a]",
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
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(
            new Error(`[SEGMENT] Output file not created: ${outputPath}`),
          );
        }
        const stats = fs.statSync(outputPath);
        console.log(
          `[SEGMENT] Processed ${segment.id}: ${(stats.size / 1024 / 1024).toFixed(2)}MB`,
        );
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(
          `[SEGMENT] Failed processing ${segment.id}: ${err.message}`,
        );
        reject(err);
      });
  });
};

export const concatVideos = (
  inputPaths: string[],
  outputPath: string,
): Promise<string> => {
  console.log(
    `[CONCAT] Concatenating ${inputPaths.length} videos -> ${outputPath}`,
  );

  if (inputPaths.length === 0) {
    return Promise.reject(new Error("[CONCAT] No input files provided"));
  }

  if (inputPaths.length === 1) {
    fs.copyFileSync(inputPaths[0], outputPath);
    return Promise.resolve(outputPath);
  }

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
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (fs.existsSync(concatListPath)) {
          fs.unlinkSync(concatListPath);
        }

        if (!fs.existsSync(outputPath)) {
          return reject(
            new Error(`[CONCAT] Output file not created: ${outputPath}`),
          );
        }
        const stats = fs.statSync(outputPath);
        console.log(
          `[CONCAT] Success: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`,
        );
        resolve(outputPath);
      })
      .on("error", (err) => {
        if (fs.existsSync(concatListPath)) {
          fs.unlinkSync(concatListPath);
        }
        console.error(`[CONCAT] Failed: ${err.message}`);
        reject(err);
      });
  });
};

export const generateBlackSegment = (
  outputPath: string,
  duration: number,
  width: number,
  height: number,
): Promise<string> => {
  console.log(
    `[BLACK] Generating ${duration.toFixed(2)}s black segment (${width}x${height}) -> ${outputPath}`,
  );

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(
        "color=c=black:s=" +
          width +
          "x" +
          height +
          ":r=30:d=" +
          duration.toFixed(4),
      )
      .inputOptions(["-f lavfi"])
      .input("anullsrc=r=48000:cl=stereo")
      .inputOptions(["-f lavfi"])
      .outputOptions([
        "-t",
        duration.toFixed(4),
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-shortest",
        "-movflags +faststart",
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        if (!fs.existsSync(outputPath)) {
          return reject(
            new Error(`[BLACK] Output file not created: ${outputPath}`),
          );
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

export const processSegments = async (
  inputPath: string,
  outputPath: string,
  segments: SegmentConfig[],
  tempDir: string,
): Promise<{ outputPath: string; tempFiles: string[] }> => {
  console.log(
    `[SEGMENTS] Processing ${segments.length} segments from ${inputPath}`,
  );

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[SEGMENTS] Input file does not exist: ${inputPath}`);
  }

  if (segments.length === 0) {
    throw new Error("[SEGMENTS] No segments provided");
  }

  const tempFiles: string[] = [];
  const concatParts: string[] = [];
  const timestamp = Date.now();

  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  const sortedSegments = [...segments].sort(
    (a, b) => a.startTime - b.startTime,
  );

  for (let i = 0; i < sortedSegments.length; i++) {
    const segment = sortedSegments[i];

    if (i > 0) {
      const prevSegment = sortedSegments[i - 1];
      const gapDuration = segment.startTime - prevSegment.endTime;

      if (gapDuration > 0.05) {
        console.log(
          `[SEGMENTS] Gap detected: ${prevSegment.endTime.toFixed(2)}s to ${segment.startTime.toFixed(2)}s (${gapDuration.toFixed(2)}s)`,
        );
        const gapPath = path.join(tempDir, `gap_${i}_${timestamp}.mp4`);
        await generateBlackSegment(gapPath, gapDuration, width, height);
        concatParts.push(gapPath);
        tempFiles.push(gapPath);
      }
    }

    const segmentPath = path.join(tempDir, `segment_${i}_${timestamp}.mp4`);
    await processSegment(inputPath, segmentPath, segment);
    concatParts.push(segmentPath);
    tempFiles.push(segmentPath);
  }

  if (concatParts.length === 1) {
    fs.renameSync(concatParts[0], outputPath);
    tempFiles.pop();
  } else {
    await concatVideos(concatParts, outputPath);
  }

  console.log(
    `[SEGMENTS] All segments processed and concatenated: ${outputPath}`,
  );

  return { outputPath, tempFiles };
};

export interface MediaOverlayItem {
  type: "image" | "video";
  localPath: string;
  startTime: number;
  endTime: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  naturalWidth: number;
  naturalHeight: number;
}

export const applyMediaOverlays = async (
  inputPath: string,
  outputPath: string,
  overlays: MediaOverlayItem[],
): Promise<string> => {
  console.log(
    `[OVERLAY] Applying ${overlays.length} overlay(s): ${inputPath} -> ${outputPath}`,
  );

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[OVERLAY] Input file does not exist: ${inputPath}`);
  }

  if (overlays.length === 0) {
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  const metadata = await getVideoMetadata(inputPath);
  const { width: videoWidth, height: videoHeight } = metadata;

  const inputs: string[] = ["-i", inputPath];
  const filterParts: string[] = [];

  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];

    if (!fs.existsSync(overlay.localPath)) {
      console.warn(
        `[OVERLAY] Overlay file missing, skipping: ${overlay.localPath}`,
      );
      continue;
    }

    inputs.push("-i", overlay.localPath);
    const inputIdx = i + 1;

    const scaledWidth = Math.round(overlay.naturalWidth * overlay.scale);
    const scaledHeight = Math.round(overlay.naturalHeight * overlay.scale);

    const finalWidth = Math.min(scaledWidth, videoWidth);
    const finalHeight = Math.min(scaledHeight, videoHeight);

    const xPixel = Math.round((overlay.x / 100) * videoWidth - finalWidth / 2);
    const yPixel = Math.round(
      (overlay.y / 100) * videoHeight - finalHeight / 2,
    );

    const prevLabel = i === 0 ? "[0:v]" : `[v${i}]`;
    const outLabel = i === overlays.length - 1 ? "[vout]" : `[v${i + 1}]`;

    const overlayLabel = `[ov${i}]`;
    filterParts.push(
      `[${inputIdx}:v]scale=${finalWidth}:${finalHeight},format=rgba,colorchannelmixer=aa=${overlay.opacity}${overlayLabel}`,
    );

    filterParts.push(
      `${prevLabel}${overlayLabel}overlay=${xPixel}:${yPixel}:enable='between(t,${overlay.startTime},${overlay.endTime})'${outLabel}`,
    );
  }

  if (filterParts.length === 0) {
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
