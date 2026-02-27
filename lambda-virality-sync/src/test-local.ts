/**
 * Local test script for the virality sync Lambda (Step Functions pattern).
 *
 * Usage:
 *   DATABASE_URL="..." APIFY_API_TOKEN="..." npx ts-node src/test-local.ts
 *
 * Runs the orchestrator to discover accounts, then runs the worker for each.
 */

import { orchestratorHandler, workerHandler } from "./handler";

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
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
