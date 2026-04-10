/** Display name used for the virtual "My Performance" competitor group */
export const MY_PERFORMANCE_NAME = "My Performance";

/** Sentinel competitor ID for the virtual My Performance group.
 * Must not collide with toMyPerfId(n) for any valid DB row ID (which produces -n). */
export const MY_PERFORMANCE_COMPETITOR_ID = -999999;

/** Convert a user-account ID to a negative "My Performance" ID */
export const toMyPerfId = (id: number): number => -Math.abs(id);

/** Recover the real user-account ID from a negative "My Performance" ID */
export const fromMyPerfId = (id: number): number => Math.abs(id);

/** Check whether an ID belongs to the My Performance namespace */
export const isMyPerfId = (id: number): boolean => id < 0;

/** Post types excluded from virality feeds (non-video content) */
export const EXCLUDED_POST_TYPES = new Set(["sidecar", "retweet", "quote", "image"]);

export function filterExcludedPostTypes<T extends { post_type: string | null }>(posts: T[]): T[] {
  return posts.filter((p) => !p.post_type || !EXCLUDED_POST_TYPES.has(p.post_type.toLowerCase()));
}
