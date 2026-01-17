/**
 * Kling AI Video Generation Prompts
 * Centralized prompt constants for all Kling API calls
 */

export const PRODUCT_NEGATIVE_PROMPT =
  "text, captions, subtitles, text overlay, floating text, title card, caption bar, subtitle bar, " +
  "burned-in text, on-screen text, watermark, logo overlay, graphic overlay, lower third, " +
  "any added text, like headings or captions, AI-generated captions, auto-captions, " +
  "distortion, warping, morphing, blur, stretching, proportion change, shape shifting, " +
  "changing phone screen, morphing phone, warped phone, bent phone, phone screen changing, " +
  "screen content changing, different screen content, glitchy screen, transparent phone, " +
  "phone screen on back, screen through phone, blurry phone screen, " +
  "low quality, blurry, out of focus, extra elements, added elements";

// CRITICAL: This gets appended to ALL prompts to prevent AI from adding anything extra
export const NO_TEXT_OVERLAY_DIRECTIVE =
  "ABSOLUTE RULES: " +
  "1) NEVER add text, captions, subtitles, or any on-screen text - the video must have ZERO text overlays. " +
  "2) NEVER change what is shown on any phone or device screen - screen content must stay EXACTLY the same throughout. " +
  "3) NEVER add elements not described - generate ONLY what is explicitly written in this prompt, nothing more. " +
  "4) Phone/device shape must stay perfectly rectangular with consistent proportions - no warping or bending. " +
  "This is a raw video file that will have text added later - DO NOT pre-add any text.";

export const PRODUCT_STABILITY_MODIFIERS =
  "Phone and device screens must remain FROZEN and UNCHANGED throughout - exact same content from first to last frame. " +
  "Phone shape stays perfectly rectangular, no warping, no bending, consistent bezels. " +
  "Product shapes, labels, and proportions stay identical throughout. " +
  "NEVER add captions, subtitles, or any text overlays to the video.";

export const GENTLE_MOTION_MODIFIERS =
  "Subtle movement only. Slow and controlled. Micro-motion only. " +
  "Maintain exact silhouette. Keep scale consistent. " +
  "Do not add ANY elements not explicitly described. No text. No captions.";

export const PRO_MOTION_PROMPT =
  "Smooth, natural movements matching the reference video. " +
  "Small subtle hand movements, gentle and relaxed. " +
  "Maintain original video speed and timing. Keep motion fluid and realistic.";
