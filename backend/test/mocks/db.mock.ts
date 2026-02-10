import { vi } from "vitest";
import { createMockDb } from "../helpers/db.helper";

// Module-level mock for ../db used by middleware and services
const mockDb = createMockDb();

vi.mock("../../src/db", () => ({
  db: mockDb,
}));

export { mockDb };
