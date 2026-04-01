import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { getVideoDuration } from "./videoEditor.utils";

export const extractFirstFrame = (
  videoPath: string,
  outputPath: string,
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
          `[EXTRACT] Failed to extract first frame: ${err.message}`,
        );
        reject(err);
      })
      .run();
  });
};

export const extractFrameAtTime = (
  videoPath: string,
  outputPath: string,
  timeInSeconds: number,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .setStartTime(timeInSeconds)
      .outputOptions(["-vframes", "1", "-q:v", "2"])
      .output(outputPath)
      .on("end", () => {
        console.log(
          `[EXTRACT] Frame at ${timeInSeconds.toFixed(2)}s saved to ${outputPath}`,
        );
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`[EXTRACT] Failed to extract frame: ${err.message}`);
        reject(err);
      })
      .run();
  });
};

export const extractLastFrame = (
  videoPath: string,
  outputPath: string,
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const duration = await getVideoDuration(videoPath);
      const seekTime = Math.max(0, duration - 0.1);

      ffmpeg(videoPath)
        .setStartTime(seekTime)
        .outputOptions(["-vframes", "1", "-q:v", "2"])
        .output(outputPath)
        .on("end", () => {
          console.log(`[EXTRACT] Last frame saved to ${outputPath}`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error(
            `[EXTRACT] Failed to extract last frame: ${err.message}`,
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
  outputPath: string,
): Promise<string> => {
  console.log(`[PREPEND-FRAME] Adding pose frame to start of ${videoPath}`);
  const { execSync } = require("child_process");

  const tempDir = path.dirname(outputPath);
  const timestamp = Date.now();

  const probeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,width,height -of csv=p=0 "${videoPath}"`;
  const probeResult = execSync(probeCmd, { encoding: "utf-8" }).trim();
  const [width, height, fpsRatio] = probeResult.split(",");
  const [fpsNum, fpsDen] = fpsRatio.split("/");
  const fps = parseInt(fpsNum) / parseInt(fpsDen || "1");
  const frameDuration = 1 / fps;

  const oneFrameVideo = path.join(tempDir, `pose_frame_${timestamp}.mp4`);
  const createFrameCmd = `ffmpeg -y -loop 1 -i "${imagePath}" -f lavfi -i anullsrc=r=48000:cl=stereo -c:v libx264 -t ${frameDuration.toFixed(6)} -pix_fmt yuv420p -vf "scale=${width}:${height}" -c:a aac -shortest -r ${fps} "${oneFrameVideo}"`;
  execSync(createFrameCmd, { stdio: "pipe" });

  const reEncodedVideo = path.join(tempDir, `reencoded_${timestamp}.mp4`);
  const reEncodeCmd = `ffmpeg -y -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p -r ${fps} -c:a aac -ar 48000 -ac 2 "${reEncodedVideo}"`;
  execSync(reEncodeCmd, { stdio: "pipe" });

  const concatList = path.join(tempDir, `concat_${timestamp}.txt`);
  fs.writeFileSync(
    concatList,
    `file '${oneFrameVideo}'\nfile '${reEncodedVideo}'`,
  );
  const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${outputPath}"`;
  execSync(concatCmd, { stdio: "pipe" });

  fs.unlinkSync(oneFrameVideo);
  fs.unlinkSync(reEncodedVideo);
  fs.unlinkSync(concatList);

  console.log(`[PREPEND-FRAME] Done: ${outputPath}`);
  return outputPath;
};
