/**
 * Shared FFmpeg encoding settings for video processing.
 * Consolidated here to ensure consistent video output across all services.
 */

/**
 * Mobile-compatible H.264 encoding settings (as array for fluent-ffmpeg)
 * - profile:v main: Broad device support (especially older iOS/Android)
 * - level 4.0: Supports up to 1080p (level 3.1 only supports 720p)
 * - pix_fmt yuv420p: Required for QuickTime/iOS playback
 * - g/keyint_min 30: Keyframe every second for smooth seeking
 * - vsync cfr: Constant frame rate prevents mobile playback issues
 */
export const MOBILE_VIDEO_SETTINGS = [
  "-profile:v main",
  "-level 4.0",
  "-pix_fmt yuv420p",
  "-r 30",
  "-g 30",
  "-keyint_min 30",
  "-vsync cfr",
];

/**
 * Same settings as a CLI string for execSync FFmpeg commands
 */
export const VIDEO_ENCODE_SETTINGS =
  "-c:v libx264 -preset fast -crf 23 -profile:v main -level 4.0 -pix_fmt yuv420p -r 30 -g 30 -keyint_min 30 -vsync cfr";

/**
 * Standard audio encoding settings
 */
export const AUDIO_SETTINGS = {
  sampleRate: 44100,
  channels: 2,
  bitrate: "192k",
};

/**
 * Audio settings as FFmpeg CLI string
 */
export const AUDIO_ENCODE_SETTINGS = `-c:a aac -ar ${AUDIO_SETTINGS.sampleRate} -ac ${AUDIO_SETTINGS.channels} -b:a ${AUDIO_SETTINGS.bitrate}`;

/**
 * Compression settings for large video files
 */
export const COMPRESSION = {
  threshold: 200 * 1024 * 1024, // Only compress files > 200MB
  targetCrf: 23, // Quality level (18-28, lower = better quality)
  maxBitrate: 12000, // 12 Mbps max bitrate cap
};
