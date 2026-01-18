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
