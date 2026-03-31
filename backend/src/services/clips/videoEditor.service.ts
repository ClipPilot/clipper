export type { FacecamRegion, VideoMetadata } from "./videoEditor.utils";
export { getVideoMetadata, getVideoDuration } from "./videoEditor.utils";

export {
  extractFirstFrame,
  extractFrameAtTime,
  extractLastFrame,
  prependPoseFrame,
} from "./frameExtraction.service";

export {
  compressVideoForUpload,
  cutClip,
  extractAudio,
  replaceAudioInVideo,
  normalizeClip,
  mergeClipsFaceSwap,
  mergeClipsGpu,
  mergeClips,
} from "./videoCompression.service";

export {
  convertToVerticalBlur,
  convertToGamingVertical,
  convertToSpeakerZoom,
  convertToCenterCrop,
  convertToActiveSpeakerZoom,
  convertToVertical,
  changeAspectRatio,
} from "./aspectRatioConversion.service";

export {
  renderHtmlToPng,
  generateTextImage,
  addTextOverlayAtPosition,
  addPreviewWatermark,
  addTextOverlay,
  generateCommentImage,
} from "./textOverlay.service";
export type { CommentOverlayConfig } from "./textOverlay.service";

export {
  mergeClipsWithCrossfade,
  changeSpeed,
  cropVideo,
  adjustVolume,
  mixBackgroundMusic,
  muteAudio,
  processSegment,
  concatVideos,
  generateBlackSegment,
  processSegments,
  applyMediaOverlays,
} from "./videoOperations.service";
export type {
  SegmentConfig,
  MediaOverlayItem,
} from "./videoOperations.service";
