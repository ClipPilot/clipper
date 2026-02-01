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
 *
 * Hand/Finger Best Practices (Motion Control):
 * - Ensure hands are visible in source image (hidden hands = hallucinated 6-finger glitches)
 * - Name the smallest moving joint first: "wrist flick, fingers lead"
 * - Use anchors to localize motion: "wrists planted, elbows steady, torso still"
 * - Keep hand actions simple: "hands holding object" safer than complex finger work
 * - Use negatives to freeze motion chains: "no shoulder involvement"
 */

export const PRODUCT_NEGATIVE_PROMPT =
  "distortion, warping, morphing, melting, blur, stretching, proportion change, shape shifting, " +
  "object morphing, face morphing, body morphing, limb distortion, " +
  "extra fingers, missing fingers, fused fingers, mutated hands, malformed hands, six fingers, four fingers, " +
  "merged fingers, webbed fingers, distorted hands, twisted fingers, wrong number of fingers, " +
  "hallucinated hands, blurry hands, floating fingers, disconnected fingers, " +
  "changing phone screen, morphing phone, warped phone, bent phone, phone screen changing, " +
  "screen content changing, different screen content, glitchy screen, transparent phone, " +
  "phone screen on back, screen through phone, blurry phone screen, " +
  "low quality, blurry, out of focus, extra elements, added elements, " +
  "text overlays, captions, watermarks, logos, jerky motion, unstable camera, camera shake";

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

export const SCREEN_STABILITY_MODIFIERS =
  "++Phone, device, and on-screen content maintain exact appearance throughout++. " +
  "Screen stays flat, rectangular, frozen - NO screen content changes, NO morphing. " +
  "Hands hold device steady with consistent grip. ++Text/UI on screen remains crisp and unchanged++. " +
  "Device proportions stay locked - no warping, no bending, no shape shifting.";

export const PRO_MOTION_PROMPT =
  "Smooth natural movements matching reference video exactly. " +
  "++Hands with exactly 5 fingers each++, natural proportions, no extra or fused fingers. " +
  "Wrists planted, elbows steady - keep hand motions simple and grounded. " +
  "Subject maintains exact appearance throughout. " +
  "Replicate held items exactly as shown. Fluid realistic motion at original speed. " +
  "High quality, sharp details, professional video.";

/**
 * Avatar-specific prompt for talking head generation
 * Note: Kling Avatar API only has prompt (default ".") - no negative_prompt option
 */
export const AVATAR_PROMPT =
  "Natural talking head, two hands only, no extra limbs, no text overlays";
