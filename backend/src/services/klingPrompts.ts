/**
 * Kling AI Video Generation Prompts
 * Centralized prompt constants for all Kling API calls
 */

export const PRODUCT_NEGATIVE_PROMPT =
  "distortion, warping, morphing, blur, stretching, proportion change, shape shifting, " +
  "changing phone screen, morphing phone, warped phone, bent phone, phone screen changing, " +
  "screen content changing, different screen content, glitchy screen, transparent phone, " +
  "phone screen on back, screen through phone, blurry phone screen, " +
  "low quality, blurry, out of focus, extra elements, added elements";

export const PRODUCT_STABILITY_MODIFIERS =
  "Phone and device screens must remain FROZEN and UNCHANGED throughout - exact same content from first to last frame. " +
  "Phone shape stays perfectly rectangular, consistent bezels. " +
  "Product shapes, labels, and proportions stay identical throughout.";

export const GENTLE_MOTION_MODIFIERS =
  "Subtle movement only. Slow and controlled. Micro-motion only. " +
  "Maintain exact silhouette. Keep scale consistent.";

export const PRO_MOTION_PROMPT =
  "Smooth, natural movements matching the reference video. " +
  "Small subtle hand movements, gentle and relaxed. " +
  "Hands must have exactly 5 fingers each - no deformed, extra, or missing fingers. " +
  "Hand movements should be smooth and natural with proper finger articulation. " +
  "If the person picks up or holds any item, replicate that exact same item in their hands. " +
  "Maintain original video speed and timing. Keep motion fluid and realistic.";
