import ffmpeg from "fluent-ffmpeg";

export interface FacecamRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration?: number;
  bitrate?: number;
}

export const getVideoMetadata = (videoPath: string): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(
        (s) => s.codec_type === "video",
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
