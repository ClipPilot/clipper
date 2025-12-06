import path from "path";
import ffmpeg from "fluent-ffmpeg";

export const cutClip = (input: string, output: string, start: number, end: number) => {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .setStartTime(start)
      .setDuration(end - start)
      .output(output)
      .on("end", () => resolve(output))
      .on("error", reject)
      .run();
  });
};

export const mergeClips = (clips: string[], outputPath: string) => {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    clips.forEach((clip) => command.input(clip));

    command
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .mergeToFile(outputPath, path.dirname(outputPath));
  });
};
