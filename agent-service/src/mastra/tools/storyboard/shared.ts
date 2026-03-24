import { Pool } from "pg";

// Lazy-init DB connection for agent-service tools (raw pg, no Drizzle)
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set in agent-service environment");
    }
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10000,
    });
    pool.on("error", (err) => {
      console.error("[storyboard-tools] DB pool error:", err.message);
    });
  }
  return pool;
}

export interface ScriptScene {
  id: string;
  sceneNumber: number;
  sceneType: string;
  action: string;
  dialogue: string;
  emotion: string;
  estimatedDurationSeconds: number;
  shotType: "a-roll" | "b-roll";
  cameraAngle: string;
  cinematicPrompt: string;
  ambientSound: string | null;
  bRollShots?: BRollShot[] | null;
  mergedSceneTypes?: string[] | null;
}

export interface BRollShot {
  action: string;
  cinematicPrompt: string;
  durationSeconds: number;
  productImageNeeded: boolean;
  shotType: "CHARACTER" | "PRODUCT" | "CHARACTER_AND_PRODUCT";
}

export interface ScriptData {
  title: string;
  hook: string;
  targetAudience: string;
  totalEstimatedDuration: number;
  scenes: ScriptScene[];
  viralScore: number;
  viralReasoning: string;
  productMentions: Array<{
    sceneId: string;
    productFeature: string;
    visualSuggestion: string;
  }>;
}

export async function loadScript(
  scriptId: string,
  variantIndex: number,
): Promise<{ script: ScriptData; allScripts: ScriptData[] }> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT scripts_data FROM ugc_scripts WHERE id = $1 LIMIT 1",
    [scriptId],
  );

  if (result.rows.length === 0) {
    throw new Error(`Script not found: ${scriptId}`);
  }

  const allScripts = result.rows[0].scripts_data as ScriptData[];
  if (!allScripts || !allScripts[variantIndex]) {
    throw new Error(
      `Variant index ${variantIndex} not found in script ${scriptId}`,
    );
  }

  // Normalize scenes: agent format uses `shots` and `duration`,
  // backend format uses `bRollShots` and `estimatedDurationSeconds`.
  // Ensure we always work with backend format.
  const script = allScripts[variantIndex];
  if (script.scenes) {
    for (const scene of script.scenes) {
      const s = scene as any;
      // Normalize shots[] → bRollShots[]
      if (!s.bRollShots && s.shots && s.shots.length > 0) {
        s.bRollShots = s.shots.map((shot: any) => ({
          action: shot.action,
          cinematicPrompt: shot.cinematicPrompt,
          durationSeconds: shot.durationSeconds,
          productImageNeeded: shot.productImageNeeded ?? false,
          shotType: shot.shotType || "PRODUCT",
        }));
      }
      // Normalize duration → estimatedDurationSeconds
      if (!s.estimatedDurationSeconds && s.duration) {
        s.estimatedDurationSeconds = s.duration;
      }
      // Normalize storyBeat → sceneType (if sceneType looks like a-roll/b-roll)
      if (s.storyBeat && (s.sceneType === "a-roll" || s.sceneType === "b-roll" || s.sceneType === "visual")) {
        s.shotType = s.sceneType === "a-roll" ? "a-roll" : "b-roll";
        s.sceneType = s.storyBeat;
      }
      // Ensure id exists
      if (!s.id && s.slug) {
        s.id = s.slug;
      }
    }
  }

  return { script, allScripts };
}

export async function saveScript(
  scriptId: string,
  variantIndex: number,
  updatedScript: ScriptData,
  allScripts: ScriptData[],
): Promise<void> {
  const pool = getPool();

  // Recalculate total duration
  updatedScript.totalEstimatedDuration = updatedScript.scenes.reduce(
    (sum, s) => sum + s.estimatedDurationSeconds,
    0,
  );

  allScripts[variantIndex] = updatedScript;

  await pool.query(
    "UPDATE ugc_scripts SET scripts_data = $1, updated_at = NOW() WHERE id = $2",
    [JSON.stringify(allScripts), scriptId],
  );
}

export function renumberScenes(scenes: ScriptScene[]): void {
  scenes.forEach((scene, i) => {
    scene.sceneNumber = i + 1;
  });
}

export function estimateDurationFromDialogue(dialogue: string): number {
  const words = dialogue.replace(/\[.*?\]/g, "").trim().split(/\s+/).length;
  return Math.max(3, Math.round(words / 2.5));
}
