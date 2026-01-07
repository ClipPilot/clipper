import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import * as faceapi from "@vladmandic/face-api";
import * as tf from "@tensorflow/tfjs";
import { Jimp } from "jimp";

export interface FaceSegment {
  start: number;
  end: number;
}

let modelsLoaded = false;

const FACE_CONFIG = {
  minConfidence: 0.5,
  minFaceSizePercent: 0.03,
  maxFaceSizePercent: 0.9,
  minConsecutiveFrames: 3,
  minSegmentDuration: 1.0,
};

async function loadModels(): Promise<void> {
  if (modelsLoaded) return;

  console.log("[FACE-DETECT] Loading face-api models...");

  const modelPath = path.join(__dirname, "../models/face-api");

  if (!fs.existsSync(modelPath)) {
    fs.mkdirSync(modelPath, { recursive: true });
    console.log("[FACE-DETECT] Downloading face detection models...");

    const modelUrl = "https://raw.githubusercontent.com/vladmandic/face-api/master/model";
    const modelFiles = [
      "ssd_mobilenetv1_model-weights_manifest.json",
      "ssd_mobilenetv1_model.bin",
    ];

    for (const file of modelFiles) {
      const response = await fetch(`${modelUrl}/${file}`);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(path.join(modelPath, file), Buffer.from(buffer));
    }
  }

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
  modelsLoaded = true;
  console.log("[FACE-DETECT] Models loaded");
}

async function extractFrames(
  videoPath: string,
  outputDir: string,
  fps: number = 5
): Promise<string[]> {
  fs.mkdirSync(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([`-vf fps=${fps}`, "-q:v 2"])
      .output(path.join(outputDir, "frame_%04d.jpg"))
      .on("end", () => {
        const frames = fs
          .readdirSync(outputDir)
          .filter((f) => f.endsWith(".jpg"))
          .sort()
          .map((f) => path.join(outputDir, f));
        console.log(`[FACE-DETECT] Extracted ${frames.length} frames at ${fps} fps`);
        resolve(frames);
      })
      .on("error", (err) => {
        console.error("[FACE-DETECT] Frame extraction failed:", err.message);
        reject(err);
      })
      .run();
  });
}

async function detectFaceInImage(imagePath: string): Promise<boolean> {
  try {
    const image = await Jimp.read(imagePath);
    const width = image.width;
    const height = image.height;
    const frameArea = width * height;

    const rgbData = new Uint8Array(width * height * 3);
    let idx = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = image.getPixelColor(x, y);
        rgbData[idx++] = (pixel >> 24) & 0xff;
        rgbData[idx++] = (pixel >> 16) & 0xff;
        rgbData[idx++] = (pixel >> 8) & 0xff;
      }
    }

    const imageTensor = tf.tensor3d(rgbData, [height, width, 3], "int32");

    const detections = await faceapi.detectAllFaces(
      imageTensor as unknown as faceapi.TNetInput,
      new faceapi.SsdMobilenetv1Options({ minConfidence: FACE_CONFIG.minConfidence })
    );

    imageTensor.dispose();

    for (const detection of detections) {
      const box = detection.box;
      const faceArea = box.width * box.height;
      const faceSizePercent = faceArea / frameArea;

      if (
        faceSizePercent >= FACE_CONFIG.minFaceSizePercent &&
        faceSizePercent <= FACE_CONFIG.maxFaceSizePercent
      ) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error(`[FACE-DETECT] Error processing ${imagePath}:`, err);
    return false;
  }
}

function filterIsolatedDetections(
  times: number[],
  sampleInterval: number
): number[] {
  const minConsecutive = FACE_CONFIG.minConsecutiveFrames;
  if (times.length < minConsecutive) return [];

  const sortedTimes = [...times].sort((a, b) => a - b);
  const validTimes: number[] = [];
  const maxGap = sampleInterval * 1.5;

  for (let i = 0; i < sortedTimes.length; i++) {
    const current = sortedTimes[i];
    let consecutiveCount = 1;

    for (let j = i - 1; j >= 0; j--) {
      if (current - sortedTimes[j] <= maxGap * (i - j)) {
        consecutiveCount++;
      } else {
        break;
      }
    }

    for (let j = i + 1; j < sortedTimes.length; j++) {
      if (sortedTimes[j] - current <= maxGap * (j - i)) {
        consecutiveCount++;
      } else {
        break;
      }
    }

    if (consecutiveCount >= minConsecutive) {
      validTimes.push(current);
    }
  }

  return validTimes;
}

function mergeTimesIntoSegments(times: number[], gap: number = 0.5): FaceSegment[] {
  if (times.length === 0) return [];

  const sortedTimes = [...times].sort((a, b) => a - b);
  const segments: FaceSegment[] = [];

  let start = sortedTimes[0];
  let prev = sortedTimes[0];

  for (const t of sortedTimes.slice(1)) {
    if (t - prev <= gap) {
      prev = t;
    } else {
      segments.push({ start, end: prev });
      start = t;
      prev = t;
    }
  }

  segments.push({ start, end: prev });
  return segments;
}

function padSegments(
  segments: FaceSegment[],
  videoDuration: number,
  padding: number = 0.3
): FaceSegment[] {
  if (segments.length === 0) return [];

  const paddedSegments = segments.map((seg) => ({
    start: Math.max(0, seg.start - padding),
    end: Math.min(videoDuration, seg.end + padding),
  }));

  paddedSegments.sort((a, b) => a.start - b.start);

  const merged: FaceSegment[] = [];
  let current = paddedSegments[0];

  for (let i = 1; i < paddedSegments.length; i++) {
    const next = paddedSegments[i];
    if (next.start <= current.end + 0.1) {
      current = { start: current.start, end: Math.max(current.end, next.end) };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  const filtered = merged.filter(
    (seg) => seg.end - seg.start >= FACE_CONFIG.minSegmentDuration
  );

  console.log(
    `[FACE-DETECT] ${segments.length} raw → ${merged.length} merged → ${filtered.length} final`
  );

  return filtered;
}

export async function detectFaceSegments(
  videoPath: string,
  sampleRate: number = 5,
  mergeGap: number = 0.5
): Promise<FaceSegment[]> {
  const jobId = Date.now().toString();
  const framesDir = path.join("/tmp", `face-detect-${jobId}`);
  const sampleInterval = 1 / sampleRate;

  console.log(`[FACE-DETECT] Starting detection for ${videoPath}`);

  try {
    await loadModels();
    const frames = await extractFrames(videoPath, framesDir, sampleRate);

    if (frames.length === 0) {
      console.log("[FACE-DETECT] No frames extracted");
      return [];
    }

    const faceTimes: number[] = [];

    for (let i = 0; i < frames.length; i++) {
      const hasFace = await detectFaceInImage(frames[i]);
      if (hasFace) {
        faceTimes.push(i / sampleRate);
      }

      if ((i + 1) % 50 === 0) {
        console.log(`[FACE-DETECT] Processed ${i + 1}/${frames.length} frames`);
      }
    }

    console.log(`[FACE-DETECT] Raw detections: ${faceTimes.length}/${frames.length} frames`);

    const filteredTimes = filterIsolatedDetections(faceTimes, sampleInterval);
    console.log(`[FACE-DETECT] After filtering isolated: ${filteredTimes.length} detections`);

    const segments = mergeTimesIntoSegments(filteredTimes, mergeGap);
    console.log(`[FACE-DETECT] Merged into ${segments.length} segments`);

    return segments;
  } finally {
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }
  }
}

export async function detectFaceSegmentsWithPadding(
  videoPath: string,
  videoDuration: number,
  sampleRate: number = 5,
  mergeGap: number = 0.5,
  padding: number = 0.3
): Promise<FaceSegment[]> {
  const rawSegments = await detectFaceSegments(videoPath, sampleRate, mergeGap);
  return padSegments(rawSegments, videoDuration, padding);
}
