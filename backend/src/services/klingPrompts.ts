/**
 * Kling AI Video Generation Prompts
 * Centralized prompt constants for all Kling API calls
 *
 * Best practices from Kling 2.6 Pro:
 * - For image-to-video: Focus on MOTION, not scene description (image provides the scene)
 * - Use "++" for emphasis on critical elements
 * - One subject, one action, one camera movement - keep it simple
 * - Add rigidity language: "remains solid throughout", "maintains exact appearance"
 * - Avoid simultaneous complex camera transformations
 * - Negative prompts are crucial - use aggressively
 */

export const PRODUCT_NEGATIVE_PROMPT =
  "distortion, warping, morphing, melting, blur, stretching, proportion change, shape shifting, " +
  "object morphing, face morphing, body morphing, limb distortion, extra fingers, missing fingers, " +
  "changing phone screen, morphing phone, warped phone, bent phone, phone screen changing, " +
  "screen content changing, different screen content, glitchy screen, transparent phone, " +
  "phone screen on back, screen through phone, blurry phone screen, " +
  "low quality, blurry, out of focus, extra elements, added elements, " +
  "text overlays, captions, watermarks, logos, jerky motion, unstable camera";

export const PRODUCT_STABILITY_MODIFIERS =
  "++Product remains solid and rigid throughout++ - no morphing, no shape changes. " +
  "++Maintains exact appearance from first frame to last frame++. " +
  "Phone screens stay flat, rectangular, frozen content. Product labels stay crisp and unchanged.";

export const GENTLE_MOTION_MODIFIERS =
  "Smooth gentle motion. Slow dolly or subtle drift only. " +
  "++Subject maintains exact appearance throughout++ - no morphing. " +
  "Stable camera with micro-movements only. Keep proportions locked.";

export const BROLL_MOTION_MODIFIERS =
  "Smooth tracking shot or slow push-in. Purposeful camera glide. " +
  "++Product remains solid and unchanged throughout++ - no morphing or warping. " +
  "One clear motion direction. Keep product sharp and in focus.";

export const PRO_MOTION_PROMPT =
  "Smooth natural movements matching reference video exactly. " +
  "++Hands have exactly 5 fingers each++ - no extra, missing, or deformed fingers. " +
  "Gentle relaxed hand movements with proper finger articulation. " +
  "++Subject maintains exact appearance throughout++ - same face, same clothes, no morphing. " +
  "Replicate held items exactly as shown. Fluid realistic motion at original speed.";
