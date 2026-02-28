/**
 * Test script: runs ONLY the reporter handler for a specific user's team.
 *
 * Usage:
 *   cd lambda-virality-sync && pnpm build && node dist/test-reporter.js
 */

import * as fs from "fs";
import * as path from "path";

const TEST_USER_EMAIL = "swastik3@terpmail.umd.edu";

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

process.env.DATABASE_URL = process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL;

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
  const totalStart = Date.now();

  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { eq } = await import("drizzle-orm");
  const schema = await import("@clipper/shared-db");
  const { reporterHandler } = await import("./handler");

  // Find user's team
  console.log(`=== FIND TEAM FOR ${TEST_USER_EMAIL} ===\n`);
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

  // Run reporter directly with teamId (new per-team fan-out interface)
  console.log(`=== REPORTER (team=${teamId}) ===\n`);
  stepStart = Date.now();

  const reporterEvent = { teamId };

  try {
    const result = await reporterHandler(reporterEvent, {} as any, () => {});
    console.log(`  Reporter result:`, JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(`  Reporter failed:`, err.message);
  }

  console.log(`  Reporter done [${elapsed(stepStart)}]`);
  console.log(`\n  TOTAL TIME: ${elapsed(totalStart)}`);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
