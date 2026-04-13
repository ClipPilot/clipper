import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { MOBILE_VIDEO_SETTINGS } from "../../config/ffmpegSettings";
import type { ConversionMode } from "../../constants/conversionModes";
import type { ActiveSpeakerSegment } from "./speakerSegments.service";
import type { FacecamRegion } from "./videoEditor.utils";
import { getVideoMetadata } from "./videoEditor.utils";

export const convertToVerticalBlur = async (
  inputPath: string,
  outputPath: string,
): Promise<string> => {
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  if (height >= width) {
    console.log(`[VERTICAL] Already vertical (${width}x${height}), skipping`);
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  console.log(
    `[VERTICAL] Converting horizontal ${width}x${height} to 9:16 with blur background`,
  );

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
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
          options: { sigma: 15 },
          inputs: "bg2",
          outputs: "bg",
        },
        {
          filter: "scale",
          options: { w: 1080, h: -2 },
          inputs: "0:v",
          outputs: "fg",
        },
        {
          filter: "overlay",
          options: { x: "(W-w)/2", y: "(H-h)/2" },
          inputs: ["bg", "fg"],
          outputs: "v",
        },
      ])
      .outputOptions([
        "-map",
        "[v]",
        "-map",
        "0:a?",
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

export const convertToGamingVertical = async (
  inputPath: string,
  outputPath: string,
  facecam: FacecamRegion,
): Promise<{ outputPath: string; facecamHeight: number }> => {
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  if (height >= width) {
    console.log(`[GAMING] Already vertical (${width}x${height}), skipping`);
    fs.copyFileSync(inputPath, outputPath);
    return { outputPath, facecamHeight: 0 };
  }

  console.log(
    `[GAMING] Converting ${width}x${height} to gaming layout (facecam: ${JSON.stringify(facecam)})`,
  );

  let fcX = Math.max(0, Math.min(facecam.x, width - 1));
  const fcY = Math.max(0, Math.min(facecam.y, height - 1));
  let fcW = Math.min(facecam.w, width - fcX);
  const fcH = Math.min(facecam.h, height - fcY);

  const facecamHeightRatio = fcH / height;
  const maxFaceH = Math.min(Math.round(facecamHeightRatio * 1920), 960);

  const faceScale = Math.min(1080 / fcW, maxFaceH / fcH);
  let faceOutW = Math.round(fcW * faceScale);
  let faceOutH = Math.round(fcH * faceScale);
  faceOutW += faceOutW % 2;
  faceOutH += faceOutH % 2;
  const gameOutH = 1920 - faceOutH;

  console.log(
    `[GAMING] Face crop: ${fcW}x${fcH} at (${fcX},${fcY}) → ${faceOutW}x${faceOutH} (scale=${faceScale.toFixed(2)}), gameplay: 1080x${gameOutH}`,
  );

  const gameplayAR = 1080 / gameOutH;
  let gpW: number, gpH: number, gpX: number, gpY: number;
  if (width / height > gameplayAR) {
    gpH = height;
    gpW = Math.round(height * gameplayAR);
    gpX = Math.round((width - gpW) / 2);
    gpY = 0;
  } else {
    gpW = width;
    gpH = Math.round(width / gameplayAR);
    gpX = 0;
    gpY = Math.round((height - gpH) / 2);
  }

  const overlapsX = gpX < fcX + fcW && gpX + gpW > fcX;
  const overlapsY = gpY < fcY + fcH && gpY + gpH > fcY;

  if (overlapsX && overlapsY) {
    const origX = gpX;
    const origY = gpY;
    const candidates: { x: number; y: number }[] = [];

    const rightX = fcX + fcW;
    if (rightX + gpW <= width) candidates.push({ x: rightX, y: origY });

    const leftX = fcX - gpW;
    if (leftX >= 0) candidates.push({ x: leftX, y: origY });

    const downY = fcY + fcH;
    if (downY + gpH <= height) candidates.push({ x: origX, y: downY });

    const upY = fcY - gpH;
    if (upY >= 0) candidates.push({ x: origX, y: upY });

    if (candidates.length > 0) {
      const best = candidates.reduce((a, b) => {
        const distA = (a.x - origX) ** 2 + (a.y - origY) ** 2;
        const distB = (b.x - origX) ** 2 + (b.y - origY) ** 2;
        return distA < distB ? a : b;
      });
      gpX = best.x;
      gpY = best.y;
    }
  }

  console.log(
    `[GAMING] Gameplay: center-crop ${gpW}x${gpH} at (${gpX},${gpY}), facecam overlap shift: ${overlapsX && overlapsY}`,
  );

  const needsBlur = faceOutW < 1080;
  const camFilters = needsBlur
    ? [
        `[0:v]crop=${fcW}:${fcH}:${fcX}:${fcY},scale=1080:${faceOutH}:force_original_aspect_ratio=increase,crop=1080:${faceOutH},gblur=sigma=15[cambg]`,
        `[0:v]crop=${fcW}:${fcH}:${fcX}:${fcY},scale=${faceOutW}:${faceOutH}[camfg]`,
        `[cambg][camfg]overlay=(W-w)/2:0[cam]`,
      ]
    : [`[0:v]crop=${fcW}:${fcH}:${fcX}:${fcY},scale=1080:${faceOutH}[cam]`];

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .complexFilter([
        ...camFilters,
        `[0:v]crop=${gpW}:${gpH}:${gpX}:${gpY},scale=1080:${gameOutH}[game]`,
        `[cam][game]vstack=inputs=2[v]`,
      ])
      .outputOptions([
        "-map",
        "[v]",
        "-map",
        "0:a?",
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
        console.log(`[GAMING] Converted to gaming layout: ${outputPath} (facecamHeight=${faceOutH})`);
        resolve({ outputPath, facecamHeight: faceOutH });
      })
      .on("error", (err) => {
        console.error(`[GAMING] Conversion failed: ${err.message}`);
        reject(err);
      });
  });
};

export const convertToSpeakerZoom = async (
  inputPath: string,
  outputPath: string,
  faceRegion: FacecamRegion,
): Promise<string> => {
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  if (height >= width) {
    console.log(
      `[SPEAKER-ZOOM] Already vertical (${width}x${height}), skipping`,
    );
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  const targetRatio = 9 / 16;
  let cropW: number;
  let cropH: number;

  cropH = height;
  cropW = Math.round(height * targetRatio);

  if (cropW > width) {
    cropW = width;
    cropH = Math.round(width / targetRatio);
  }

  const faceCenterX = faceRegion.x + faceRegion.w / 2;
  let cropX = Math.round(faceCenterX - cropW / 2);
  cropX = Math.max(0, Math.min(cropX, width - cropW));

  const faceCenterY = faceRegion.y + faceRegion.h / 2;
  let cropY = Math.round(faceCenterY - cropH / 2);
  cropY = Math.max(0, Math.min(cropY, height - cropH));

  console.log(
    `[SPEAKER-ZOOM] Cropping ${cropW}x${cropH} at (${cropX},${cropY}) centered on face, then scaling to 1080x1920`,
  );

  if (process.env.DEBUG_SPEAKER_OVERLAY) {
    try {
      const faceMap = new Map<number, FacecamRegion>([[0, faceRegion]]);
      await debugActiveSpeakerOverlay(
        inputPath,
        faceMap,
        width,
        height,
        cropW,
        cropH,
      );
    } catch (err) {
      console.error(
        `[DEBUG-SPEAKER-ZOOM] Debug overlay failed (non-fatal):`,
        err,
      );
    }
  }

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
        "-map",
        "[v]",
        "-map",
        "0:a?",
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

export const convertToCenterCrop = async (
  inputPath: string,
  outputPath: string,
): Promise<string> => {
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  if (height >= width) {
    console.log(
      `[CENTER-CROP] Already vertical (${width}x${height}), skipping`,
    );
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  console.log(`[CENTER-CROP] Cropping ${width}x${height} to 9:16`);
  return changeAspectRatio(inputPath, outputPath, "9:16");
};

const debugActiveSpeakerOverlay = async (
  inputPath: string,
  speakerFaceMap: Map<number, FacecamRegion>,
  width: number,
  height: number,
  cropW: number,
  cropH: number,
): Promise<string> => {
  const debugDir = path.join(process.cwd(), "debug_output");
  if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
  const debugPath = path.join(
    debugDir,
    `debug_active_speaker_${Date.now()}.mp4`,
  );
  const colors = ["red", "blue", "green", "yellow", "magenta", "cyan"];

  const drawboxFilters: string[] = [];
  let idx = 0;
  for (const [speaker, face] of speakerFaceMap.entries()) {
    const color = colors[idx % colors.length];

    drawboxFilters.push(
      `drawbox=x=${face.x}:y=${face.y}:w=${face.w}:h=${face.h}:color=${color}@0.9:t=4`,
    );

    const faceCenterX = face.x + face.w / 2;
    const faceCenterY = face.y + face.h / 2;
    let cropX = Math.round(faceCenterX - cropW / 2);
    cropX = Math.max(0, Math.min(cropX, width - cropW));
    let cropY = Math.round(faceCenterY - cropH / 2);
    cropY = Math.max(0, Math.min(cropY, height - cropH));

    drawboxFilters.push(
      `drawbox=x=${cropX}:y=${cropY}:w=${cropW}:h=${cropH}:color=${color}@0.5:t=2`,
    );

    drawboxFilters.push(
      `drawtext=text='S${speaker} (${face.x}\\,${face.y} ${face.w}x${face.h})':x=${face.x}:y=${Math.max(0, face.y - 25)}:fontsize=20:fontcolor=${color}:borderw=2:bordercolor=black`,
    );

    idx++;
  }

  const filterStr = drawboxFilters.join(",");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilter(filterStr)
      .outputOptions([
        "-c:v libx264",
        "-preset ultrafast",
        "-crf 28",
        "-c:a copy",
        "-t 10",
      ])
      .save(debugPath)
      .on("end", () => {
        console.log(
          `[DEBUG-ACTIVE-SPEAKER] Saved debug overlay to: ${debugPath}`,
        );
        resolve(debugPath);
      })
      .on("error", (err) => {
        console.error(`[DEBUG-ACTIVE-SPEAKER] Failed: ${err.message}`);
        reject(err);
      });
  });
};

export const convertToActiveSpeakerZoom = async (
  inputPath: string,
  outputPath: string,
  segments: ActiveSpeakerSegment[],
  speakerFaceMap: Map<number, FacecamRegion>,
): Promise<string> => {
  const metadata = await getVideoMetadata(inputPath);
  const { width, height } = metadata;

  if (height >= width) {
    console.log(
      `[ACTIVE-SPEAKER] Already vertical (${width}x${height}), skipping`,
    );
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  console.log(
    `[ACTIVE-SPEAKER] Processing ${segments.length} speaker segments from ${width}x${height}`,
  );

  const targetRatio = 9 / 16;
  let cropW: number;
  let cropH: number;

  cropH = height;
  cropW = Math.round(height * targetRatio);

  if (cropW > width) {
    cropW = width;
    cropH = Math.round(width / targetRatio);
  }

  if (process.env.DEBUG_SPEAKER_OVERLAY) {
    try {
      await debugActiveSpeakerOverlay(
        inputPath,
        speakerFaceMap,
        width,
        height,
        cropW,
        cropH,
      );
    } catch (err) {
      console.error(
        `[DEBUG-ACTIVE-SPEAKER] Debug overlay failed (non-fatal):`,
        err,
      );
    }
  }

  const tempDir = path.dirname(outputPath);
  const timestamp = Date.now();
  const segmentPaths: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const face = seg.face ?? speakerFaceMap.get(seg.speaker);

    if (!face) {
      console.warn(
        `[ACTIVE-SPEAKER] No face for speaker ${seg.speaker}, using center crop`,
      );
    }

    const faceCenterX = face ? face.x + face.w / 2 : width / 2;
    const faceCenterY = face ? face.y + face.h / 2 : height / 2;

    let cropX = Math.round(faceCenterX - cropW / 2);
    cropX = Math.max(0, Math.min(cropX, width - cropW));

    let cropY = Math.round(faceCenterY - cropH / 2);
    cropY = Math.max(0, Math.min(cropY, height - cropH));

    const segmentPath = path.join(tempDir, `as_seg_${i}_${timestamp}.mp4`);
    const duration = seg.end - seg.start;

    console.log(
      `[ACTIVE-SPEAKER] Segment ${i}: speaker=${seg.speaker} ${seg.start.toFixed(2)}s-${seg.end.toFixed(2)}s crop=(${cropX},${cropY}) ${cropW}x${cropH}`,
    );

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
          "-map",
          "[v]",
          "-map",
          "0:a?",
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
          } catch {
            /* best effort cleanup */
          }
          resolve();
        })
        .on("error", (err) => {
          try {
            if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
          } catch {
            /* best effort cleanup */
          }
          reject(err);
        });
    });

    for (const p of segmentPaths) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }

  console.log(`[ACTIVE-SPEAKER] Converted: ${outputPath}`);
  return outputPath;
};

export const convertToVertical = async (
  inputPath: string,
  outputPath: string,
  mode?: ConversionMode,
  facecamRegion?: FacecamRegion | null,
  activeSpeakerOptions?: {
    segments: ActiveSpeakerSegment[];
    speakerFaceMap: Map<number, FacecamRegion>;
  } | null,
): Promise<{ outputPath: string; facecamHeight?: number }> => {
  const effectiveMode = mode || "standard";

  switch (effectiveMode) {
    case "center-crop":
      return { outputPath: await convertToCenterCrop(inputPath, outputPath) };

    case "gaming":
      if (facecamRegion) {
        return convertToGamingVertical(inputPath, outputPath, facecamRegion);
      }
      console.warn(
        "[VERTICAL] Gaming mode but no facecam detected — falling back to standard",
      );
      return { outputPath: await convertToVerticalBlur(inputPath, outputPath) };

    case "speaker-zoom":
      if (facecamRegion) {
        return { outputPath: await convertToSpeakerZoom(inputPath, outputPath, facecamRegion) };
      }
      console.warn(
        "[VERTICAL] Speaker-zoom mode but no face region — falling back to standard",
      );
      return { outputPath: await convertToVerticalBlur(inputPath, outputPath) };

    case "active-speaker":
      if (activeSpeakerOptions && activeSpeakerOptions.segments.length > 1) {
        return {
          outputPath: await convertToActiveSpeakerZoom(
            inputPath,
            outputPath,
            activeSpeakerOptions.segments,
            activeSpeakerOptions.speakerFaceMap,
          ),
        };
      }
      if (facecamRegion) {
        console.warn(
          "[VERTICAL] Active-speaker but single speaker/face — falling back to speaker-zoom",
        );
        return { outputPath: await convertToSpeakerZoom(inputPath, outputPath, facecamRegion) };
      }
      console.warn(
        "[VERTICAL] Active-speaker but no faces detected — falling back to standard",
      );
      return { outputPath: await convertToVerticalBlur(inputPath, outputPath) };

    case "standard":
    default:
      return { outputPath: await convertToVerticalBlur(inputPath, outputPath) };
  }
};

export const changeAspectRatio = async (
  inputPath: string,
  outputPath: string,
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5",
): Promise<string> => {
  console.log(
    `[ASPECT] Changing to ${aspectRatio}: ${inputPath} -> ${outputPath}`,
  );

  if (!fs.existsSync(inputPath)) {
    return Promise.reject(
      new Error(`[ASPECT] Input file does not exist: ${inputPath}`),
    );
  }

  const metadata = await getVideoMetadata(inputPath);
  const { width: srcWidth, height: srcHeight } = metadata;

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
    targetHeight = srcHeight;
    targetWidth = Math.round(srcHeight * targetRatio);
  } else {
    targetWidth = srcWidth;
    targetHeight = Math.round(srcWidth / targetRatio);
  }

  const cropX = Math.round((srcWidth - targetWidth) / 2);
  const cropY = Math.round((srcHeight - targetHeight) / 2);

  const outputWidthMap: Record<string, number> = {
    "9:16": 1080,
    "16:9": 1920,
    "1:1": 1080,
    "4:5": 1080,
  };
  const outW = outputWidthMap[aspectRatio];
  const outH = Math.round(outW / targetRatio);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters([
        `crop=${targetWidth}:${targetHeight}:${cropX}:${cropY}`,
        `scale=${outW}:${outH}`,
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
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err));
  });
};
