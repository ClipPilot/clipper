import { exec, execSync } from "child_process";
import { promisify } from "util";
import { generateJumbledMetadataString } from "./videoMetadata";

const execAsync = promisify(exec);

export function hasAudioStream(inputPath: string): boolean {
  try {
    const result = execSync(
      `ffprobe -v quiet -select_streams a -show_entries stream=codec_type -of csv=p=0 "${inputPath}"`,
      { encoding: "utf-8" }
    );
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

export interface UniquifyParams {
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  noiseStrength: number;
  hueShift: number;
  saturation: number;
  brightness: number;
  speed: number;
  crf: number;
  audioPitch: number;
  trimOffset: number;
  rotation: number;
  gamma: number;
  colorBalanceRS: number;
  colorBalanceGS: number;
  colorBalanceBS: number;
  scaleJitter: number;
  gopSize: number;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

export function generateUniquifyParams(): UniquifyParams {
  return {
    cropLeft: randRange(0.01, 0.03),
    cropRight: randRange(0.01, 0.03),
    cropTop: randRange(0.01, 0.03),
    cropBottom: randRange(0.01, 0.03),
    noiseStrength: 0,
    hueShift: randRange(-3, 3),
    saturation: randRange(0.97, 1.03),
    brightness: randRange(-0.02, 0.02),
    speed: randRange(0.98, 1.02),
    crf: randInt(17, 21),
    audioPitch: randRange(0.98, 1.02),
    trimOffset: randRange(0, 0.3),
    rotation: randRange(0.5, 1.5) * (Math.random() < 0.5 ? -1 : 1),
    gamma: randRange(0.97, 1.03),
    colorBalanceRS: randRange(-0.03, 0.03),
    colorBalanceGS: randRange(-0.03, 0.03),
    colorBalanceBS: randRange(-0.03, 0.03),
    scaleJitter: randRange(0.97, 1.03),
    gopSize: randInt(24, 48),
  };
}

/**
 * Build the FFmpeg filter_complex and encoding args from uniquify params.
 * Returns components separately and as a combined fullArgs string.
 */
export function generateUniquifyString(
  params?: UniquifyParams,
  audioEnabled: boolean = true
): {
  filterComplex: string;
  encodingArgs: string;
  fullArgs: string;
} {
  const p = params ?? generateUniquifyParams();
  const metadataString = generateJumbledMetadataString();

  const rotRad = (p.rotation * Math.PI) / 180;

  const videoFilters = [
    `[0:v] crop=iw*(1-${p.cropLeft}-${p.cropRight}):ih*(1-${p.cropTop}-${p.cropBottom}):iw*${p.cropLeft}:ih*${p.cropTop},`,
    `rotate=${rotRad}:fillcolor=black:ow=rotw(${rotRad}):oh=roth(${rotRad}),`,
    `crop=iw*0.96:ih*0.96,`,
    `scale=iw*${p.scaleJitter}:ih*${p.scaleJitter},`,
    `pad=ceil(iw/2)*2:ceil(ih/2)*2,`,
    `hue=h=${p.hueShift},`,
    `eq=saturation=${p.saturation}:brightness=${p.brightness}:gamma=${p.gamma},`,
    `colorbalance=rs=${p.colorBalanceRS}:gs=${p.colorBalanceGS}:bs=${p.colorBalanceBS},`,
    `setpts=PTS/${p.speed}`,
    `[v]`,
  ].join(" ");

  const filterComplex = videoFilters;
  const mapArgs = audioEnabled ? `-map "[v]" -map 0:a` : `-map "[v]" -an`;
  const audioEncoding = audioEnabled ? `-c:a copy` : "";

  const encodingArgs = [
    `-c:v libx264 -preset fast -crf ${p.crf}`,
    `-profile:v main -level 4.0 -pix_fmt yuv420p`,
    `-r 30 -g ${p.gopSize} -keyint_min ${Math.floor(p.gopSize / 2)} -fps_mode cfr`,
    audioEncoding,
    `-movflags +faststart`,
  ].filter(Boolean).join(" ");

  const fullArgs = [
    `-ss ${p.trimOffset}`,
    `-map_metadata -1`,
    `-filter_complex "${filterComplex}"`,
    mapArgs,
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
  const audio = hasAudioStream(inputPath);
  const { fullArgs } = generateUniquifyString(params, audio);
  const cmd = `ffmpeg -y -i "${inputPath}" ${fullArgs} "${outputPath}"`;
  await execAsync(cmd, { timeout: 600000 });
}
