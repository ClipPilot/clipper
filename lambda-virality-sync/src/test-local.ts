/**
 * Local test script for the virality sync Lambda (Step Functions pattern).
 * Local test script for the virality sync Lambda.
 *
 * Runs the full flow: orchestrator → workers → reporter
 * ONLY for accounts belonging to the team of a specific user.
 *
 * Usage:
 *   DATABASE_URL="..." APIFY_API_TOKEN="..." npx ts-node src/test-local.ts
 *
 * Runs the orchestrator to discover accounts, then runs the worker for each.
 */

import { orchestratorHandler, workerHandler } from "./handler";
 *   cd lambda-virality-sync && pnpm build && node dist/test-local.js
 */

import * as fs from "fs";
import * as path from "path";

const TEST_USER_EMAIL = "swastik3@terpmail.umd.edu";

// Load env vars from backend/.env BEFORE any handler imports
function loadBackendEnv() {
  const envPath = path.resolve(__dirname, "../../backend/.env");
  if (!fs.existsSync(envPath)) {
    console.error("backend/.env not found — set env vars manually");
    return;
  }
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    let value = trimmed.slice(eqIdx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadBackendEnv();

// Use staging DB — NEVER production
process.env.DATABASE_URL = process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL;
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://platform.cuttr.com";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: STAGING_DATABASE_URL not set. Aborting.");
  process.exit(1);
}

function elapsed(startMs: number): string {
  const ms = Date.now() - startMs;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function main() {
  console.log("Running virality sync orchestrator locally...\n");

  const orchestratorResult = await orchestratorHandler({}, {} as any, () => {});
  console.log("\n--- Orchestrator returned ---");
  console.log(JSON.stringify(orchestratorResult, null, 2));

  const accounts = orchestratorResult?.accounts || [];
  console.log(`\nProcessing ${accounts.length} accounts sequentially...\n`);

  for (const account of accounts) {
    try {
      const workerResult = await workerHandler(account, {} as any, () => {});
      console.log(`\n--- Worker result for @${account.username} ---`);
      console.log(JSON.stringify(workerResult, null, 2));
    } catch (err) {
      console.error(`Worker failed for @${account.username}:`, err);
    }
  }
  const totalStart = Date.now();

  // Dynamic imports AFTER env vars are set (handler.ts reads DATABASE_URL at module level)
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { eq } = await import("drizzle-orm");
  const schema = await import("@clipper/shared-db");
  const { orchestratorHandler, workerHandler, reporterHandler } = await import("./handler");

  // ── Step 0: Find user's team ──
  console.log(`=== STEP 0: FIND TEAM FOR ${TEST_USER_EMAIL} ===\n`);
  let stepStart = Date.now();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  const [user] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.email, TEST_USER_EMAIL))
    .limit(1);

  if (!user) {
    console.error(`User ${TEST_USER_EMAIL} not found in DB`);
    await pool.end();
    process.exit(1);
  }

  const [membership] = await db
    .select({ team_id: schema.teamMembers.team_id })
    .from(schema.teamMembers)
    .where(eq(schema.teamMembers.user_id, user.id))
    .limit(1);

  if (!membership) {
    console.error(`User ${TEST_USER_EMAIL} has no team`);
    await pool.end();
    process.exit(1);
  }

  const teamId = membership.team_id;
  console.log(`  User id=${user.id}, team_id=${teamId} [${elapsed(stepStart)}]\n`);
  await pool.end();

  // ── Step 1: Orchestrator ──
  console.log("=== STEP 1: ORCHESTRATOR ===\n");
  stepStart = Date.now();

  const orchestratorResult = await orchestratorHandler({}, {} as any, () => {});
  const allAccounts = orchestratorResult?.accounts || [];

  // Filter to only this user's team
  const accounts = allAccounts.filter((a: any) => a.team_id === teamId);
  console.log(`  Orchestrator found ${allAccounts.length} total, ${accounts.length} for team=${teamId} [${elapsed(stepStart)}]\n`);

  if (accounts.length === 0) {
    console.log("No accounts to sync for this team. Done.");
    return;
  }

  // ── Step 2: Workers ──
  console.log("=== STEP 2: WORKERS ===\n");
  stepStart = Date.now();

  const mapResults: any[] = [];

  for (const account of accounts) {
    const workerStart = Date.now();
    try {
      const workerResult = await workerHandler(account, {} as any, () => {});
      mapResults.push({ result: workerResult });
      console.log(`  @${account.username} (${account.platform}) → ${workerResult?.status} | ${workerResult?.postsUpserted} posts [${elapsed(workerStart)}]`);
    } catch (err: any) {
      mapResults.push({ result: { status: "failed" }, error: err.message });
      console.error(`  @${account.username} (${account.platform}) → FAILED: ${err.message} [${elapsed(workerStart)}]`);
    }
  }

  console.log(`\n  All workers done [${elapsed(stepStart)}]\n`);

  // ── Step 3: Reporter ──
  console.log("=== STEP 3: REPORTER ===\n");
  stepStart = Date.now();

  const reporterEvent = {
    orchestratorResult: { accounts },
    mapResults,
  };

  try {
    const reporterResult = await reporterHandler(reporterEvent, {} as any, () => {});
    console.log(`  Reporter result:`, JSON.stringify(reporterResult, null, 2));
  } catch (err: any) {
    console.error(`  Reporter failed:`, err.message);
  }

  console.log(`  Reporter done [${elapsed(stepStart)}]`);

  // ── Summary ──
  const completed = mapResults.filter((r) => r.result?.status === "completed").length;
  const failed = mapResults.filter((r) => r.result?.status === "failed" || r.error).length;
  const skipped = mapResults.filter((r) => r.result?.status === "skipped" || r.result?.status === "deactivated").length;

  console.log(`\n========================================`);
  console.log(`  TOTAL TIME: ${elapsed(totalStart)}`);
  console.log(`  Team: ${teamId} (${TEST_USER_EMAIL})`);
  console.log(`  Workers: ${completed} completed, ${failed} failed, ${skipped} skipped`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
