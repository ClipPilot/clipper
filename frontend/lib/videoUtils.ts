/**
 * Generates thumbnail images from a video URL for use in a timeline.
 * Creates one thumbnail per second (up to 60 total) at 320x180 resolution.
 * @param videoSrc - URL of the video to generate thumbnails from
 * @param duration - Total duration of the video in seconds
 * @returns Promise resolving to an array of base64 JPEG data URLs
 */
export async function generateThumbnails(
  videoSrc: string,
  duration: number
): Promise<string[]> {
  const fps = 1;
  const thumbnailCount = Math.min(Math.ceil(duration * fps), 60);
  const interval = duration / thumbnailCount;
  const thumbnails: string[] = [];

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return thumbnails;

  canvas.width = 320;
  canvas.height = 180;

  const video = document.createElement("video");
  video.src = videoSrc;
  video.crossOrigin = "anonymous";
  video.muted = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Video load failed"));
    video.load();
  });

  for (let i = 0; i < thumbnailCount; i++) {
    const time = i * interval;
    video.currentTime = time;
    await new Promise<void>((resolve) => {
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbnails.push(canvas.toDataURL("image/jpeg", 0.8));
        resolve();
      };
    });
  }

  return thumbnails;
}

/**
 * Extracts the first frame from a video and returns it as a base64 data URL
 * @param videoSrc - URL or blob URL of the video
 * @returns Promise resolving to a base64 data URL of the first frame
 */
export async function extractFirstFrame(videoSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      // Seek to the first frame
      video.currentTime = 0;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");

        // Cleanup
        video.src = "";
        video.load();

        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error("Failed to load video for frame extraction"));
    };

    video.src = videoSrc;
  });
}

/**
 * Extracts a frame at a specific time from a video
 * @param videoSrc - URL or blob URL of the video
 * @param timeInSeconds - Time in seconds to extract the frame from
 * @returns Promise resolving to a base64 data URL of the frame
 */
export async function extractFrameAtTime(
  videoSrc: string,
  timeInSeconds: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      // Clamp time to video duration
      const seekTime = Math.min(timeInSeconds, video.duration);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");

        // Cleanup
        video.src = "";
        video.load();

        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error("Failed to load video for frame extraction"));
    };

    video.src = videoSrc;
  });
}
