import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
} from "../../../test/helpers/express.helper";
import { createDrizzleChain } from "../../../test/helpers/db.helper";
import { buildTeam, buildSubscription, buildUsageStats } from "../../../test/factories";

// Hoist mock variables so vi.mock factories can reference them
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../db", () => ({ db: mockDb }));

// Mock stripe.config to avoid Stripe SDK init
vi.mock("../../config/stripe.config", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../../config/stripe.config")>();
  return {
    ...orig,
    stripe: {},
  };
});

import {
  requireActiveSubscription,
  requireClipQuota,
} from "../subscription.middleware";

describe("requireActiveSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when teamId is missing", async () => {
    const req = createMockRequest({ params: {}, body: {} });
    const res = createMockResponse();
    const next = createMockNext();

    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Team ID is required" });
  });

  it("returns 404 when team not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const req = createMockRequest({ params: { teamId: "1" } });
    const res = createMockResponse();
    const next = createMockNext();

    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("passes through for personal teams (no subscription needed)", async () => {
    const team = buildTeam({ type: "personal" });
    mockDb.select.mockReturnValue(createDrizzleChain([team]));

    const req = createMockRequest({ params: { teamId: "1" } });
    const res = createMockResponse();
    const next = createMockNext();

    await requireActiveSubscription(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when business team has no active subscription", async () => {
    const team = buildTeam({ type: "business" });
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([team]))
      .mockReturnValueOnce(createDrizzleChain([]));

    const req = createMockRequest({ params: { teamId: "1" } });
    const res = createMockResponse();
    const next = createMockNext();

    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ requiresSubscription: true })
    );
  });

  it("calls next when business team has active subscription", async () => {
    const team = buildTeam({ type: "business" });
    const sub = buildSubscription({ status: "active" });
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([team]))
      .mockReturnValueOnce(createDrizzleChain([sub]));

    const req = createMockRequest({ params: { teamId: "1" } });
    const res = createMockResponse();
    const next = createMockNext();

    await requireActiveSubscription(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("requireClipQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when teamId is missing", async () => {
    const req = createMockRequest({ params: {}, body: {} });
    const res = createMockResponse();
    const next = createMockNext();

    await requireClipQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when usage stats not found", async () => {
    const team = buildTeam();
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([team]))
      .mockReturnValueOnce(createDrizzleChain([]));

    const req = createMockRequest({ params: { teamId: "1" } });
    const res = createMockResponse();
    const next = createMockNext();

    await requireClipQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 403 when clip quota exhausted", async () => {
    const team = buildTeam({ addon_clips_remaining: 0 });
    const usage = buildUsageStats({ clips_created: 3, limit: 3 });
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([team]))
      .mockReturnValueOnce(createDrizzleChain([usage]));

    const req = createMockRequest({ params: { teamId: "1" } });
    const res = createMockResponse();
    const next = createMockNext();

    await requireClipQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CLIP_LIMIT_REACHED" })
    );
  });

  it("calls next and attaches usage when quota available", async () => {
    const team = buildTeam({ addon_clips_remaining: 5, plan: "studio" });
    const usage = buildUsageStats({ clips_created: 2, limit: 400 });
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([team]))
      .mockReturnValueOnce(createDrizzleChain([usage]));

    const req = createMockRequest({ params: { teamId: "1" } });
    const res = createMockResponse();
    const next = createMockNext();

    await requireClipQuota(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).teamUsage).toBeDefined();
    expect((req as any).teamUsage.totalRemaining).toBe(398 + 5);
  });
});
