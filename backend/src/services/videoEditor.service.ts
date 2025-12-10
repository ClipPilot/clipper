import ffmpeg from "fluent-ffmpeg";
import fs from "fs";

export const cutClip = (input: string, output: string, start: number, end: number) => {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .setStartTime(start)
      .setDuration(end - start)
      .outputOptions([
        "-c:v libx264",
        "-preset ultrafast",  // Much faster encoding
        "-crf 23",
        "-c:a aac",
        "-b:a 128k"  // Lower bitrate for speed
      ])
      .save(output)
      .on("end", () => resolve(output))
      .on("error", reject)
      .run();
  });
};

export const mergeClips = async (clips: string[], outputPath: string) => {
  return new Promise((resolve, reject) => {
    const listPath = outputPath + ".txt";

    // Create concat file: file 'clip1.mp4'
    const content = clips.map(c => `file '${c.replace(/'/g, "'\\''")}'`).join("\n");
    fs.writeFileSync(listPath, content);

    ffmpeg()
      .input(listPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])   // <-- no re-encode
      .save(outputPath)
      .on("end", () => {
        fs.unlinkSync(listPath);    // cleanup
        resolve(outputPath);
      })
      .on("error", err => reject(err));
  });
};

