/** Display name used for the virtual "My Performance" competitor group */
export const MY_PERFORMANCE_NAME = "My Performance";

/** Sentinel competitor ID for the virtual My Performance group */
export const MY_PERFORMANCE_COMPETITOR_ID = -1;

/** Convert a user-account ID to a negative "My Performance" ID */
export const toMyPerfId = (id: number): number => -Math.abs(id);

/** Recover the real user-account ID from a negative "My Performance" ID */
export const fromMyPerfId = (id: number): number => Math.abs(id);

/** Check whether an ID belongs to the My Performance namespace */
export const isMyPerfId = (id: number): boolean => id < 0;
