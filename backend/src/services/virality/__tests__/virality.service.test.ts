import { describe, it, expect, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../../test/helpers/db.helper";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../../db", () => ({ db: mockDb }));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));
vi.mock("../../socket.service", () => ({ emitViralitySyncUpdate: vi.fn() }));
vi.mock("../../../utils/plans", () => ({
  canAccessViralityTracker: vi.fn().mockReturnValue(true),
  isAnalyticsPlan: vi.fn().mockReturnValue(false),
  getViralityAccountLimit: vi.fn().mockReturnValue(-1),
  canTrackKeywords: vi.fn().mockReturnValue(true),
}));
vi.mock("../../team.service", () => ({ teamService: { consumeClip: vi.fn().mockResolvedValue({ success: true }) } }));
vi.mock("../apify.service", () => ({ getApifyService: vi.fn() }));

import { viralityService } from "../virality.service";

const makeCompetitor = (id: number, teamId: number) => ({
  id,
  team_id: teamId,
  name: `Competitor ${id}`,
  description: null,
  competitor: true,
  created_at: new Date(),
  updated_at: new Date(),
});

const makeAccount = (id: number, teamId: number, groupId: number | null) => ({
  id,
  team_id: teamId,
  group_id: groupId,
  platform: "tiktok",
  username: `user${id}`,
  profile_url: `https://tiktok.com/@user${id}`,
  account_type: "profile",
  is_active: true,
  alert_enabled: false,
  sync_status: "completed",
  created_at: new Date(),
  updated_at: new Date(),
});

describe("ViralityService.getAllGroupsWithAccounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns competitors with grouped accounts in 2 parallel queries", async () => {
    const comp1 = makeCompetitor(1, 10);
    const comp2 = makeCompetitor(2, 10);
    const acc1 = makeAccount(100, 10, 1);
    const acc2 = makeAccount(101, 10, 1);
    const acc3 = makeAccount(102, 10, 2);

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([comp1, comp2]))
      .mockReturnValueOnce(createDrizzleChain([acc1, acc2, acc3]))
      .mockReturnValueOnce(createDrizzleChain([]));

    const result = await viralityService.getAllGroupsWithAccounts(10);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[0].accounts).toHaveLength(2);
    expect(result[0].accounts[0].id).toBe(100);
    expect(result[0].accounts[1].id).toBe(101);
    expect(result[1].id).toBe(2);
    expect(result[1].accounts).toHaveLength(1);
    expect(result[1].accounts[0].id).toBe(102);
  });

  it("returns competitor with empty accounts array when no accounts exist", async () => {
    const comp1 = makeCompetitor(1, 10);

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([comp1]))
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([]));

    const result = await viralityService.getAllGroupsWithAccounts(10);

    expect(result).toHaveLength(1);
    expect(result[0].accounts).toEqual([]);
  });

  it("returns empty array when no competitors exist", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([]));

    const result = await viralityService.getAllGroupsWithAccounts(10);

    expect(result).toEqual([]);
  });

  it("excludes accounts with null competitor_id", async () => {
    const comp1 = makeCompetitor(1, 10);
    const accLinked = makeAccount(100, 10, 1);
    const accOrphan = makeAccount(101, 10, null);

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([comp1]))
      .mockReturnValueOnce(createDrizzleChain([accLinked, accOrphan]))
      .mockReturnValueOnce(createDrizzleChain([]));

    const result = await viralityService.getAllGroupsWithAccounts(10);

    expect(result[0].accounts).toHaveLength(1);
    expect(result[0].accounts[0].id).toBe(100);
  });

  it("does not call cleanupStaleSyncs on the read path", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([]));
    mockDb.update.mockReturnValueOnce(createDrizzleChain([]));

    await viralityService.getAllGroupsWithAccounts(10);

    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
