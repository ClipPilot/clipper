/**
 * Local test script for the virality sync Lambda.
 *
 * Usage:
 *   DATABASE_URL="..." APIFY_API_TOKEN="..." npx ts-node src/test-local.ts
 *
 * Requires at least one Instagram target in the virality_targets table.
 */

import { handler } from "./handler";

async function main() {
  console.log("Running virality sync Lambda locally...\n");

  const result = await handler({}, {} as any, () => {});
  console.log("\n--- Handler returned ---");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
