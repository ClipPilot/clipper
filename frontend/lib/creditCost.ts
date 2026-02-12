export function calculateCreditCost(
  scenes: Array<{ mergedSceneTypes?: string[] | null }>
): number {
  return scenes.reduce(
    (total, scene) => total + (scene.mergedSceneTypes?.length || 1) * 2,
    0
  );
}
