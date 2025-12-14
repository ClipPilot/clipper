import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegPath || "");

export const extractThumbnail = (inputPath: string): Promise<string> => {
  const outputDir = path.dirname(inputPath);
  const outputFileName = `thumbnail_${Date.now()}.jpg`;
  const outputPath = path.join(outputDir, outputFileName);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ["10%"],
        filename: outputFileName,
        folder: outputDir,
        size: "640x360",
      })
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err));
  });
};
