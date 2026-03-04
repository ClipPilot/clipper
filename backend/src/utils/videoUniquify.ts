import { exec } from "child_process";
import { promisify } from "util";
import { generateJumbledMetadataString } from "./videoMetadata";

const execAsync = promisify(exec);

export interface UniquifyParams {
  /** Crop percentage per edge (0.03–0.07) */
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  /** Temporal noise strength (5–10) */
  noiseStrength: number;
  /** Hue rotation in degrees (-5 to +5) */
  hueShift: number;
  /** Saturation multiplier (0.95–1.05) */
  saturation: number;
  /** Brightness offset (-0.03 to +0.03) */
  brightness: number;
  /** Playback speed multiplier (0.97–1.03) */
  speed: number;
  /** CRF quality value (17–21) */
  crf: number;
  /** Audio pitch multiplier (0.97–1.03) */
  audioPitch: number;
  /** Trim offset from start in seconds (0–0.5) */
  trimOffset: number;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

export function generateUniquifyParams(): UniquifyParams {
  return {
    cropLeft: randRange(0.03, 0.07),
    cropRight: randRange(0.03, 0.07),
    cropTop: randRange(0.03, 0.07),
    cropBottom: randRange(0.03, 0.07),
    noiseStrength: randInt(5, 10),
    hueShift: randRange(-5, 5),
    saturation: randRange(0.95, 1.05),
    brightness: randRange(-0.03, 0.03),
    speed: randRange(0.97, 1.03),
    crf: randInt(17, 21),
    audioPitch: randRange(0.97, 1.03),
    trimOffset: randRange(0, 0.5),
  };
}

/**
 * Build the FFmpeg filter_complex and encoding args from uniquify params.
 * Returns components separately and as a combined fullArgs string.
 */
export function generateUniquifyString(params?: UniquifyParams): {
  filterComplex: string;
  encodingArgs: string;
  fullArgs: string;
} {
  const p = params ?? generateUniquifyParams();
  const metadataString = generateJumbledMetadataString();

  // Audio tempo must match video speed for sync.
  // atempo only accepts 0.5–100.0 range, our 0.97–1.03 is safe.
  const audioTempo = p.speed;

  const filterComplex = [
    `[0:v] crop=iw*(1-${p.cropLeft}-${p.cropRight}):ih*(1-${p.cropTop}-${p.cropBottom}):iw*${p.cropLeft}:ih*${p.cropTop},`,
    `pad=ceil(iw/2)*2:ceil(ih/2)*2,`,
    `noise=alls=${p.noiseStrength}:allf=t,`,
    `hue=h=${p.hueShift},`,
    `eq=saturation=${p.saturation}:brightness=${p.brightness},`,
    `setpts=PTS/${p.speed}`,
    `[v];`,
    `[0:a] atempo=${audioTempo},`,
    `asetrate=44100*${p.audioPitch},`,
    `aresample=44100`,
    `[a]`,
  ].join(" ");

  const encodingArgs = [
    `-c:v libx264 -preset fast -crf ${p.crf}`,
    `-profile:v main -level 4.0 -pix_fmt yuv420p`,
    `-r 30 -g 30 -keyint_min 30 -vsync cfr`,
    `-c:a aac -ar 44100 -ac 2 -b:a 192k`,
    `-movflags +faststart`,
  ].join(" ");

  const fullArgs = [
    `-ss ${p.trimOffset}`,
    `-map_metadata -1`,
    `-filter_complex "${filterComplex}"`,
    `-map "[v]" -map "[a]"`,
    encodingArgs,
    metadataString,
  ].join(" ");

  return { filterComplex, encodingArgs, fullArgs };
}

/**
 * Uniquify a video file — applies visual, audio, and metadata modifications
 * so each output is perceptually distinct for deduplication evasion.
 */
export async function uniquifyVideo(
  inputPath: string,
  outputPath: string,
  params?: UniquifyParams
): Promise<void> {
  const { fullArgs } = generateUniquifyString(params);
  const cmd = `ffmpeg -y -i "${inputPath}" ${fullArgs} "${outputPath}"`;
  await execAsync(cmd, { timeout: 600000 });
}
