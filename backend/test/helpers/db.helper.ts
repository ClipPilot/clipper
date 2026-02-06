import { vi } from "vitest";

/**
 * Creates a chainable mock that simulates Drizzle's query builder pattern:
 *   db.select().from().where().limit() -> [result]
 *
 * Usage:
 *   const chain = createDrizzleChain([{ id: 1, name: "test" }]);
 *   mockDb.select.mockReturnValue(chain);
 */
export function createDrizzleChain(result: any[] = []) {
  const chain: Record<string, any> = {};
  const methods = [
    "from",
    "where",
    "limit",
    "orderBy",
    "innerJoin",
    "leftJoin",
    "set",
    "values",
    "returning",
    "onConflictDoNothing",
    "onConflictDoUpdate",
  ];

  // Each method returns the chain, allowing .from().where().limit()
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  // Make the chain itself thenable so `await db.select()...` resolves to result
  chain.then = (resolve: Function) => resolve(result);

  return chain;
}

/**
 * Creates a mock db object with select/insert/update/delete.
 * Each returns a chainable builder via createDrizzleChain.
 */
export function createMockDb() {
  return {
    select: vi.fn(() => createDrizzleChain([])),
    insert: vi.fn(() => createDrizzleChain([])),
    update: vi.fn(() => createDrizzleChain([])),
    delete: vi.fn(() => createDrizzleChain([])),
  };
}
