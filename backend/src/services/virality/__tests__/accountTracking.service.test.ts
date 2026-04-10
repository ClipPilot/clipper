import { describe, it, expect, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../../test/helpers/db.helper";

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockDb, mockEmit, mockSentry, mockCanAccess, mockIsAnalyticsPlan, mockGetViralityAccountLimit, mockCanTrackKeywords, mockTeamService, mockGetApifyService } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockEmit: vi.fn(),
  mockSentry: { captureException: vi.fn() },
  mockCanAccess: vi.fn().mockReturnValue(true),
  mockIsAnalyticsPlan: vi.fn().mockReturnValue(false),
  mockGetViralityAccountLimit: vi.fn().mockReturnValue(-1),
  mockCanTrackKeywords: vi.fn().mockReturnValue(true),
  mockTeamService: { consumeClip: vi.fn().mockResolvedValue({ success: true }) },
  mockGetApifyService: vi.fn(),
}));

vi.mock("../../../db", () => ({ db: mockDb }));
vi.mock("@sentry/node", () => mockSentry);
vi.mock("../../socket.service", () => ({ emitViralitySyncUpdate: mockEmit }));
vi.mock("../../../utils/plans", () => ({
  canAccessViralityTracker: mockCanAccess,
  isAnalyticsPlan: mockIsAnalyticsPlan,
  getViralityAccountLimit: mockGetViralityAccountLimit,
  canTrackKeywords: mockCanTrackKeywords,
}));
vi.mock("../../team.service", () => ({ teamService: mockTeamService }));
vi.mock("../apify.service", () => ({ getApifyService: mockGetApifyService }));

import { AccountTrackingService } from "../accountTracking.service";
import { MASS_POST_SYNC_BUDGET } from "../../../config/viralitySyncConstants";

// ── Helpers ────────────────────────────────────────────────────────────────

// Fake table references (the class only uses them as Drizzle column references)
const fakeAccountsTable: any = {
  id: "id",
  team_id: "team_id",
  username: "username",
  platform: "platform",
  profile_url: "profile_url",
  sync_status: "sync_status",
  sync_error: "sync_error",
  updated_at: "updated_at",
  is_active: "is_active",
  syncs_remaining: "syncs_remaining",
  last_synced_at: "last_synced_at",
  total_likes: "total_likes",
  follower_history: "follower_history",
  follower_count: "follower_count",
  following_count: "following_count",
  post_count: "post_count",
  display_name: "display_name",
  avatar_url: "avatar_url",
  bio: "bio",
  is_verified: "is_verified",
  created_at: "created_at",
  account_type: "account_type",
};

const fakePostsTable: any = {
  id: "id",
  account_id: "account_id",
  platform_post_id: "platform_post_id",
  post_url: "post_url",
  thumbnail_url: "thumbnail_url",
  caption: "caption",
  hashtags: "hashtags",
  post_type: "post_type",
  posted_at: "posted_at",
  like_count: "like_count",
  comment_count: "comment_count",
  video_view_count: "video_view_count",
  video_play_count: "video_play_count",
  metrics_history: "metrics_history",
  created_at: "created_at",
  updated_at: "updated_at",
  mass_post_id: "mass_post_id",
  syncs_remaining: "syncs_remaining",
};

function makeExistingPost(overrides: Record<string, any> = {}) {
  return {
    id: 100,
    account_id: 1,
    platform_post_id: "ABC123",
    post_url: "https://www.instagram.com/p/ABC123/",
    thumbnail_url: "https://img.example.com/thumb.jpg",
    caption: "Test post",
    like_count: 500,
    comment_count: 50,
    video_play_count: 10000,
    metrics_history: [
      { recorded_at: "2026-03-10T00:00:00.000Z", likes: 500, comments: 50, views: 10000 },
    ],
    ...overrides,
  };
}

let service: AccountTrackingService;

// ── Tests ──────────────────────────────────────────────────────────────────

describe("AccountTrackingService.upsertPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountTrackingService(fakeAccountsTable, fakePostsTable);
  });

  // ── INSERT PATH (first sync / new post) ──

  it("inserts a new post with raw values when no existing post is found", async () => {
    // First select: canonical ID lookup -> not found
    // Second select: fallback ID lookup -> not found
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([]));

    const insertChain = createDrizzleChain([]);
    mockDb.insert.mockReturnValue(insertChain);

    await (service as any).upsertPost(1, {
      id: "raw-id-123",
      url: "https://www.instagram.com/p/ABC123/",
      shortCode: "ABC123",
      likesCount: 0,
      commentsCount: 0,
      videoPlayCount: 0,
      caption: "New post",
      displayUrl: "https://img.example.com/new.jpg",
      timestamp: new Date().toISOString(),
    }, "instagram");

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    // Verify the values call was made (insert path)
    const valuesCall = insertChain.values.mock.calls[0][0];
    expect(valuesCall.like_count).toBe(0);
    expect(valuesCall.comment_count).toBe(0);
    expect(valuesCall.video_play_count).toBe(0);
    expect(valuesCall.metrics_history).toEqual([
      expect.objectContaining({ likes: 0, comments: 0, views: 0 }),
    ]);
  });

  it("inserts a new post with null views when videoPlayCount is undefined", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([]));

    const insertChain = createDrizzleChain([]);
    mockDb.insert.mockReturnValue(insertChain);

    await (service as any).upsertPost(1, {
      id: "raw-id-456",
      url: "https://www.instagram.com/p/DEF456/",
      shortCode: "DEF456",
      likesCount: 100,
      commentsCount: 10,
      // videoPlayCount intentionally omitted (undefined)
      caption: "Photo post",
      timestamp: new Date().toISOString(),
    }, "instagram");

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const valuesCall = insertChain.values.mock.calls[0][0];
    expect(valuesCall.video_play_count).toBeUndefined();
    expect(valuesCall.metrics_history[0].views).toBeNull();
  });

  // ── UPDATE PATH: flaky zero protection for likes/comments ──

  it("uses previous likes/comments when Apify returns zeros (flaky scrape)", async () => {
    const existing = makeExistingPost();
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 0,        // flaky zero
      commentsCount: 0,     // flaky zero
      videoPlayCount: 12000,
    }, "instagram");

    expect(mockDb.update).toHaveBeenCalledTimes(1);
    const setCall = updateChain.set.mock.calls[0][0];
    // Should use previous values instead of flaky zeros
    expect(setCall.like_count).toBe(500);
    expect(setCall.comment_count).toBe(50);
    // Views should use new value (higher)
    expect(setCall.video_play_count).toBe(12000);
    // Verify metrics_history entry matches
    const lastEntry = setCall.metrics_history[setCall.metrics_history.length - 1];
    expect(lastEntry.likes).toBe(500);
    expect(lastEntry.comments).toBe(50);
    expect(lastEntry.views).toBe(12000);
  });

  it("allows real decreases in likes/comments (non-zero values)", async () => {
    const existing = makeExistingPost();
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 400,      // real decrease from 500
      commentsCount: 30,    // real decrease from 50
      videoPlayCount: 10000,
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    expect(setCall.like_count).toBe(400);
    expect(setCall.comment_count).toBe(30);
  });

  it("allows real increases in likes/comments", async () => {
    const existing = makeExistingPost();
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 750,
      commentsCount: 80,
      videoPlayCount: 15000,
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    expect(setCall.like_count).toBe(750);
    expect(setCall.comment_count).toBe(80);
    expect(setCall.video_play_count).toBe(15000);
  });

  // ── UPDATE PATH: views strict monotonicity ──

  it("enforces strict views monotonicity (never decreases)", async () => {
    const existing = makeExistingPost({ video_play_count: 10000 });
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 500,
      commentsCount: 50,
      videoPlayCount: 8000, // lower than previous 10000
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    // Views should stay at previous value (Math.max)
    expect(setCall.video_play_count).toBe(10000);
    const lastEntry = setCall.metrics_history[setCall.metrics_history.length - 1];
    expect(lastEntry.views).toBe(10000);
  });

  it("allows views to increase", async () => {
    const existing = makeExistingPost({ video_play_count: 10000 });
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 500,
      commentsCount: 50,
      videoPlayCount: 25000,
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    expect(setCall.video_play_count).toBe(25000);
  });

  it("uses previous views when Apify returns null views", async () => {
    const existing = makeExistingPost();
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 500,
      commentsCount: 50,
      // videoPlayCount omitted (undefined -> null via ??)
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    // Should fall back to previous views
    expect(setCall.video_play_count).toBe(10000);
  });

  it("keeps zero views when Apify returns 0 and previous was also 0", async () => {
    const existing = makeExistingPost({
      video_play_count: 0,
      metrics_history: [
        { recorded_at: "2026-03-10T00:00:00.000Z", likes: 100, comments: 10, views: 0 },
      ],
    });
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 100,
      commentsCount: 10,
      videoPlayCount: 0,
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    // Math.max(0, 0) = 0
    expect(setCall.video_play_count).toBe(0);
  });

  // ── UPDATE PATH: metrics_history consistency ──

  it("appends new entry to metrics_history with protected values", async () => {
    const existing = makeExistingPost({
      metrics_history: [
        { recorded_at: "2026-03-09T00:00:00.000Z", likes: 200, comments: 20, views: 5000 },
        { recorded_at: "2026-03-10T00:00:00.000Z", likes: 500, comments: 50, views: 10000 },
      ],
    });
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 0,         // flaky
      commentsCount: 60,     // real increase
      videoPlayCount: 9000,  // attempted decrease -> monotonic keeps 10000
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    const history = setCall.metrics_history;
    expect(history).toHaveLength(3);
    // Original entries preserved
    expect(history[0].likes).toBe(200);
    expect(history[1].likes).toBe(500);
    // New entry uses protected values
    expect(history[2].likes).toBe(500);      // flaky zero -> previous
    expect(history[2].comments).toBe(60);    // real increase accepted
    expect(history[2].views).toBe(10000);    // monotonic: max(9000, 10000)
  });

  it("handles post with empty metrics_history (first update after insert)", async () => {
    const existing = makeExistingPost({
      metrics_history: [],
      like_count: 0,
      comment_count: 0,
      video_play_count: null,
    });
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 0,
      commentsCount: 0,
      videoPlayCount: 0,
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    // No lastMetric, so zero is accepted as-is
    expect(setCall.like_count).toBe(0);
    expect(setCall.comment_count).toBe(0);
    expect(setCall.video_play_count).toBe(0);
  });

  // ── UPDATE PATH: null views handling ──

  it("preserves null views when both Apify and previous are null", async () => {
    const existing = makeExistingPost({
      video_play_count: null,
      metrics_history: [
        { recorded_at: "2026-03-10T00:00:00.000Z", likes: 100, comments: 10, views: null },
      ],
    });
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 100,
      commentsCount: 10,
      // no videoPlayCount
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    expect(setCall.video_play_count).toBeNull();
    const lastEntry = setCall.metrics_history[setCall.metrics_history.length - 1];
    expect(lastEntry.views).toBeNull();
  });

  it("picks up new views when previous was null", async () => {
    const existing = makeExistingPost({
      video_play_count: null,
      metrics_history: [
        { recorded_at: "2026-03-10T00:00:00.000Z", likes: 100, comments: 10, views: null },
      ],
    });
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 100,
      commentsCount: 10,
      videoPlayCount: 5000,
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    expect(setCall.video_play_count).toBe(5000);
  });

  // ── SKIP CONDITIONS ──

  it("skips post with no id", async () => {
    await (service as any).upsertPost(1, {
      // no id
      likesCount: 100,
    }, "instagram");

    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("skips post older than SCRAPE_WINDOW_DAYS", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 60); // 60 days ago, window is 31

    await (service as any).upsertPost(1, {
      id: "old-post",
      timestamp: oldDate.toISOString(),
      likesCount: 100,
    }, "instagram");

    expect(mockDb.select).not.toHaveBeenCalled();
  });

  // ── COMBINED SCENARIO ──

  it("handles combined flaky scenario: zero likes, zero comments, decreased views", async () => {
    const existing = makeExistingPost({
      like_count: 1000,
      comment_count: 200,
      video_play_count: 50000,
      metrics_history: [
        { recorded_at: "2026-03-08T00:00:00.000Z", likes: 800, comments: 150, views: 30000 },
        { recorded_at: "2026-03-09T00:00:00.000Z", likes: 900, comments: 180, views: 40000 },
        { recorded_at: "2026-03-10T00:00:00.000Z", likes: 1000, comments: 200, views: 50000 },
      ],
    });
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValue(updateChain);

    await (service as any).upsertPost(1, {
      id: "raw-id",
      url: "https://www.instagram.com/p/ABC123/",
      likesCount: 0,          // flaky zero -> use previous 1000
      commentsCount: 0,       // flaky zero -> use previous 200
      videoPlayCount: 45000,  // decrease -> monotonic keeps 50000
    }, "instagram");

    const setCall = updateChain.set.mock.calls[0][0];
    expect(setCall.like_count).toBe(1000);
    expect(setCall.comment_count).toBe(200);
    expect(setCall.video_play_count).toBe(50000);

    const history = setCall.metrics_history;
    expect(history).toHaveLength(4);
    const newEntry = history[3];
    expect(newEntry.likes).toBe(1000);
    expect(newEntry.comments).toBe(200);
    expect(newEntry.views).toBe(50000);
  });
});

// ── syncMassPostBatch tests ────────────────────────────────────────────────

describe("AccountTrackingService.syncMassPostBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountTrackingService(fakeAccountsTable, fakePostsTable);
  });

  it("returns early with zero counts when no eligible posts", async () => {
    mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

    const result = await service.syncMassPostBatch(1, 10);

    expect(result).toEqual({ syncedCount: 0, skippedCount: 0 });
    expect(mockGetApifyService).not.toHaveBeenCalled();
  });

  it("scrapes batch and applies flaky data protection per post", async () => {
    const eligiblePosts = [
      {
        id: 201,
        post_url: "https://www.instagram.com/p/POST1/",
        metrics_history: [
          { recorded_at: "2026-03-10T00:00:00.000Z", likes: 300, comments: 30, views: 8000 },
        ],
        like_count: 300,
        comment_count: 30,
        video_play_count: 8000,
        thumbnail_url: "thumb1.jpg",
      },
    ];

    const account = { id: 1, platform: "instagram", team_id: 10 };

    const mockApify = {
      scrapeBatchPostMetrics: vi.fn().mockResolvedValue(
        new Map([
          ["POST1", { likesCount: 0, commentsCount: 0, viewCount: 10000, thumbnailUrl: "thumb1.jpg" }],
        ])
      ),
      extractPostIdFromUrl: vi.fn().mockReturnValue("POST1"),
    };
    mockGetApifyService.mockReturnValue(mockApify);

    // 1. select eligible posts
    mockDb.select.mockReturnValueOnce(createDrizzleChain(eligiblePosts));
    // 2. getAccountById
    mockDb.select.mockReturnValueOnce(createDrizzleChain([account]));

    // 3. decrement syncs_remaining update -> returning
    const decrementChain = createDrizzleChain([{ id: 201 }]);
    mockDb.update.mockReturnValueOnce(decrementChain);

    // 4. update post with new metrics (uses eligibleMap from initial select, no re-read needed)
    const postUpdateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(postUpdateChain);

    // 6. update account last_synced_at
    const accountUpdateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(accountUpdateChain);

    const result = await service.syncMassPostBatch(1, 10);

    expect(result.syncedCount).toBe(1);
    expect(mockApify.scrapeBatchPostMetrics).toHaveBeenCalledWith(
      ["https://www.instagram.com/p/POST1/"],
      "instagram"
    );

    // Verify flaky data protection was applied
    const setCall = postUpdateChain.set.mock.calls[0][0];
    expect(setCall.like_count).toBe(300);     // flaky zero -> previous
    expect(setCall.comment_count).toBe(30);   // flaky zero -> previous
    expect(setCall.video_play_count).toBe(10000); // real increase accepted
  });

  it("emits socket events on success", async () => {
    mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

    await service.syncMassPostBatch(1, 10);

    // No eligible posts = no socket events (returns early)
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("emits syncing then completed socket events", async () => {
    const eligiblePosts = [
      {
        id: 301,
        post_url: "https://www.instagram.com/p/XYZ/",
        metrics_history: [],
        like_count: 0,
        comment_count: 0,
        video_play_count: null,
        thumbnail_url: null,
      },
    ];
    const account = { id: 5, platform: "instagram", team_id: 20 };

    const mockApify = {
      scrapeBatchPostMetrics: vi.fn().mockResolvedValue(new Map()),
      extractPostIdFromUrl: vi.fn().mockReturnValue("XYZ"),
    };
    mockGetApifyService.mockReturnValue(mockApify);

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain(eligiblePosts))
      .mockReturnValueOnce(createDrizzleChain([account]));

    // decrement returns result
    mockDb.update
      .mockReturnValueOnce(createDrizzleChain([{ id: 301 }]))
      // account last_synced_at update
      .mockReturnValueOnce(createDrizzleChain([]));

    await service.syncMassPostBatch(5, 20);

    expect(mockEmit).toHaveBeenCalledWith(20, { accountId: 5, syncStatus: "syncing" });
    expect(mockEmit).toHaveBeenCalledWith(20, { accountId: 5, syncStatus: "completed" });
  });
});

// ── addAccount tests ──────────────────────────────────────────────────────

describe("AccountTrackingService.addAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountTrackingService(fakeAccountsTable, fakePostsTable);
  });

  it("inserts account and charges 1 credit on creation", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));
    mockGetViralityAccountLimit.mockReturnValueOnce(-1);

    const insertedAccount = { id: 42, team_id: 1, username: "testuser", platform: "instagram" };
    const insertChain = createDrizzleChain([insertedAccount]);
    mockDb.insert.mockReturnValue(insertChain);

    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));
    mockTeamService.consumeClip.mockResolvedValueOnce({ success: true });

    const result = await service.addAccount(1, "instagram", "https://www.instagram.com/testuser/");

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockTeamService.consumeClip).toHaveBeenCalledWith(1);
    expect(result).toEqual(insertedAccount);
  });

  it("rolls back account and throws when no credits available", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));
    mockGetViralityAccountLimit.mockReturnValueOnce(-1);

    const insertedAccount = { id: 42, team_id: 1, username: "testuser", platform: "instagram" };
    const insertChain = createDrizzleChain([insertedAccount]);
    mockDb.insert.mockReturnValue(insertChain);

    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));
    mockTeamService.consumeClip.mockResolvedValueOnce({ success: false });

    const deleteChain = createDrizzleChain([]);
    mockDb.delete.mockReturnValue(deleteChain);

    await expect(service.addAccount(1, "instagram", "https://www.instagram.com/testuser/"))
      .rejects.toThrow("Insufficient credits to start tracking");

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });

  it("throws when account already exists", async () => {
    const existing = { id: 99, team_id: 1, username: "testuser", platform: "instagram" };
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    await expect(service.addAccount(1, "instagram", "https://www.instagram.com/testuser/"))
      .rejects.toThrow("@testuser is already being tracked");

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockTeamService.consumeClip).not.toHaveBeenCalled();
  });
});

// ── syncAccount credit/syncs_remaining tests ──────────────────────────────

describe("AccountTrackingService.syncAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountTrackingService(fakeAccountsTable, fakePostsTable);
  });

  it("decrements syncs_remaining when > 0 (no credit charged)", async () => {
    const account = {
      id: 10, team_id: 1, username: "user1", platform: "instagram",
      is_active: true, syncs_remaining: 5, account_type: "profile",
    };

    mockDb.update.mockReturnValueOnce(createDrizzleChain([]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([account]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));

    const decrementChain = createDrizzleChain([{ id: 10 }]);
    mockDb.update.mockReturnValueOnce(decrementChain);

    const syncingChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(syncingChain);

    const mockApify = {
      scrapeInstagramPosts: vi.fn().mockResolvedValue({ posts: [], profile: null }),
      scrapeInstagramProfile: vi.fn().mockResolvedValue(null),
    };
    mockGetApifyService.mockReturnValue(mockApify);

    const likesChain = createDrizzleChain([{ total: 0 }]);
    mockDb.select.mockReturnValueOnce(likesChain);

    const completeChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(completeChain);

    await service.syncAccount(10, 1);

    expect(mockTeamService.consumeClip).not.toHaveBeenCalled();
  });

  it("charges 1 credit and resets syncs_remaining when syncs_remaining is 0", async () => {
    const account = {
      id: 10, team_id: 1, username: "user1", platform: "instagram",
      is_active: true, syncs_remaining: 0, account_type: "profile",
    };

    mockDb.update.mockReturnValueOnce(createDrizzleChain([]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([account]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));

    const decrementChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(decrementChain);

    mockTeamService.consumeClip.mockResolvedValueOnce({ success: true });
    const resetChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(resetChain);

    const syncingChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(syncingChain);

    const mockApify = {
      scrapeInstagramPosts: vi.fn().mockResolvedValue({ posts: [], profile: null }),
      scrapeInstagramProfile: vi.fn().mockResolvedValue(null),
    };
    mockGetApifyService.mockReturnValue(mockApify);

    const likesChain = createDrizzleChain([{ total: 0 }]);
    mockDb.select.mockReturnValueOnce(likesChain);

    const completeChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(completeChain);

    await service.syncAccount(10, 1);

    expect(mockTeamService.consumeClip).toHaveBeenCalledWith(1);
  });

  it("deactivates account when syncs_remaining is 0 and no credits available", async () => {
    const account = {
      id: 10, team_id: 1, username: "user1", platform: "instagram",
      is_active: true, syncs_remaining: 0, account_type: "profile",
    };

    mockDb.update.mockReturnValueOnce(createDrizzleChain([]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([account]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));

    const decrementChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(decrementChain);

    mockTeamService.consumeClip.mockResolvedValueOnce({ success: false });

    const deactivateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(deactivateChain);

    await expect(service.syncAccount(10, 1))
      .rejects.toThrow("No credits available. Account has been deactivated.");
  });

  it("throws when account is inactive", async () => {
    const account = {
      id: 10, team_id: 1, username: "user1", platform: "instagram",
      is_active: false, syncs_remaining: 5,
    };

    mockDb.update.mockReturnValueOnce(createDrizzleChain([]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([account]));

    await expect(service.syncAccount(10, 1))
      .rejects.toThrow("Account is inactive and cannot be synced");
  });

  it("throws when account not found or wrong team", async () => {
    mockDb.update.mockReturnValueOnce(createDrizzleChain([]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

    await expect(service.syncAccount(10, 1))
      .rejects.toThrow("Account not found or access denied");
  });
});

// ── createMassPostUserPost tests ──────────────────────────────────────────

describe("AccountTrackingService.createMassPostUserPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountTrackingService(fakeAccountsTable, fakePostsTable);
  });

  it("creates a mass post with syncs_remaining of 62 (MASS_POST_SYNC_BUDGET)", async () => {
    mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

    const insertChain = createDrizzleChain([{ id: 77 }]);
    mockDb.insert.mockReturnValue(insertChain);

    const result = await service.createMassPostUserPost(
      1, 50, "https://www.instagram.com/p/ABC123/", "instagram", "caption", new Date()
    );

    expect(result).toEqual({ id: 77 });
    const valuesCall = insertChain.values.mock.calls[0][0];
    expect(valuesCall.syncs_remaining).toBe(MASS_POST_SYNC_BUDGET);
    expect(valuesCall.mass_post_id).toBe(50);
    expect(mockTeamService.consumeClip).not.toHaveBeenCalled();
  });

  it("returns existing post if platform_post_id already tracked", async () => {
    const existing = { id: 88 };
    mockDb.select.mockReturnValueOnce(createDrizzleChain([existing]));

    const result = await service.createMassPostUserPost(
      1, 50, "https://www.instagram.com/p/ABC123/", "instagram", "caption", new Date()
    );

    expect(result).toEqual({ id: 88 });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("returns null when post URL cannot be parsed", async () => {
    const result = await service.createMassPostUserPost(
      1, 50, "invalid-url", "instagram", "caption", new Date()
    );

    expect(result).toBeNull();
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

// ── Analytics plan: account limits ────────────────────────────────────────

describe("AccountTrackingService.addAccount — account limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAnalyticsPlan.mockReturnValue(false);
    mockGetViralityAccountLimit.mockReturnValue(-1);
    service = new AccountTrackingService(fakeAccountsTable, fakePostsTable);
  });

  it("throws when analytics plan account limit reached", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_starter" }]))
      .mockReturnValueOnce(createDrizzleChain([{ count: 50 }]));

    mockGetViralityAccountLimit.mockReturnValueOnce(50);

    await expect(service.addAccount(1, "instagram", "https://www.instagram.com/testuser/"))
      .rejects.toThrow("Account limit of 50 reached for your plan");

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("allows adding when under analytics limit", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_starter" }]))
      .mockReturnValueOnce(createDrizzleChain([{ count: 49 }]));

    mockGetViralityAccountLimit.mockReturnValueOnce(50);

    const insertedAccount = { id: 42, team_id: 1, username: "testuser", platform: "instagram" };
    mockDb.insert.mockReturnValue(createDrizzleChain([insertedAccount]));

    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_starter" }]));
    mockIsAnalyticsPlan.mockReturnValue(true);

    const result = await service.addAccount(1, "instagram", "https://www.instagram.com/testuser/");
    expect(result).toEqual(insertedAccount);
    expect(mockTeamService.consumeClip).not.toHaveBeenCalled();
  });

  it("skips limit check for studio/scale (limit = -1)", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));

    mockGetViralityAccountLimit.mockReturnValueOnce(-1);

    const insertedAccount = { id: 42, team_id: 1, username: "testuser", platform: "instagram" };
    mockDb.insert.mockReturnValue(createDrizzleChain([insertedAccount]));

    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));
    mockTeamService.consumeClip.mockResolvedValueOnce({ success: true });

    const result = await service.addAccount(1, "instagram", "https://www.instagram.com/testuser/");
    expect(result).toEqual(insertedAccount);
    expect(mockTeamService.consumeClip).toHaveBeenCalledWith(1);
  });
});

// ── Analytics plan: credit skipping ───────────────────────────────────────

describe("AccountTrackingService — analytics credit skipping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAnalyticsPlan.mockReturnValue(false);
    mockGetViralityAccountLimit.mockReturnValue(-1);
    service = new AccountTrackingService(fakeAccountsTable, fakePostsTable);
  });

  it("chargeForAccountCreation skips credit for analytics plans", async () => {
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_pro" }]));
    mockIsAnalyticsPlan.mockReturnValue(true);

    const result = await (service as any).chargeForAccountCreation(1);
    expect(result).toEqual({ success: true });
    expect(mockTeamService.consumeClip).not.toHaveBeenCalled();
  });

  it("chargeForAccountCreation charges credit for non-analytics plans", async () => {
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));
    mockTeamService.consumeClip.mockResolvedValueOnce({ success: true });

    const result = await (service as any).chargeForAccountCreation(1);
    expect(result).toEqual({ success: true });
    expect(mockTeamService.consumeClip).toHaveBeenCalledWith(1);
  });

  it("consumeSyncCredit is no-op for analytics plans", async () => {
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_business" }]));
    mockIsAnalyticsPlan.mockReturnValue(true);

    await (service as any).consumeSyncCredit(10, 1);

    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockTeamService.consumeClip).not.toHaveBeenCalled();
  });
});

// ── Plan transition helpers ───────────────────────────────────────────────

describe("AccountTrackingService.deactivateExcessAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountTrackingService(fakeAccountsTable, fakePostsTable);
  });

  it("deactivates newest accounts beyond the limit", async () => {
    const activeAccounts = [
      { id: 5 }, { id: 4 }, { id: 3 }, { id: 2 }, { id: 1 },
    ];
    mockDb.select.mockReturnValueOnce(createDrizzleChain(activeAccounts));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(updateChain);

    const count = await service.deactivateExcessAccounts(1, 3);

    expect(count).toBe(2);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("does nothing when under the limit", async () => {
    const activeAccounts = [{ id: 2 }, { id: 1 }];
    mockDb.select.mockReturnValueOnce(createDrizzleChain(activeAccounts));

    const count = await service.deactivateExcessAccounts(1, 5);

    expect(count).toBe(0);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("deactivates all when limit is 0", async () => {
    const activeAccounts = [{ id: 3 }, { id: 2 }, { id: 1 }];
    mockDb.select.mockReturnValueOnce(createDrizzleChain(activeAccounts));

    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(updateChain);

    const count = await service.deactivateExcessAccounts(1, 0);

    expect(count).toBe(3);
  });

  it("returns 0 when limit is -1 (unlimited)", async () => {
    const count = await service.deactivateExcessAccounts(1, -1);
    expect(count).toBe(0);
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});

describe("AccountTrackingService.reactivateAllAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountTrackingService(fakeAccountsTable, fakePostsTable);
  });

  it("reactivates all inactive accounts for team", async () => {
    const reactivated = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const updateChain = createDrizzleChain(reactivated);
    mockDb.update.mockReturnValueOnce(updateChain);

    const count = await service.reactivateAllAccounts(1);
    expect(count).toBe(3);
  });

  it("returns 0 when no inactive accounts", async () => {
    const updateChain = createDrizzleChain([]);
    mockDb.update.mockReturnValueOnce(updateChain);

    const count = await service.reactivateAllAccounts(1);
    expect(count).toBe(0);
  });
});

// ── Keyword/hashtag tracking gate ─────────────────────────────────────────

describe("AccountTrackingService.addAccount — keyword tracking gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAnalyticsPlan.mockReturnValue(false);
    mockGetViralityAccountLimit.mockReturnValue(-1);
    mockCanTrackKeywords.mockReturnValue(true);
    service = new AccountTrackingService(fakeAccountsTable, fakePostsTable);
  });

  it("blocks hashtag tracking when plan does not support keywords", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_starter" }]));
    mockGetViralityAccountLimit.mockReturnValueOnce(50);
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 5 }]));
    mockCanTrackKeywords.mockReturnValueOnce(false);

    await expect(service.addAccount(1, "instagram", "cuttr", "hashtag"))
      .rejects.toThrow("Hashtag and keyword tracking requires an Analytics Business plan or higher");

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("blocks keyword tracking when plan does not support keywords", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_pro" }]));
    mockGetViralityAccountLimit.mockReturnValueOnce(100);
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 5 }]));
    mockCanTrackKeywords.mockReturnValueOnce(false);

    await expect(service.addAccount(1, "x", "video editing", "keyword"))
      .rejects.toThrow("Hashtag and keyword tracking requires an Analytics Business plan or higher");

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("allows hashtag tracking on analytics_business", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_business" }]));
    mockGetViralityAccountLimit.mockReturnValueOnce(250);
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 10 }]));
    mockCanTrackKeywords.mockReturnValueOnce(true);

    const insertedAccount = { id: 55, team_id: 1, username: "cuttr", platform: "instagram" };
    mockDb.insert.mockReturnValue(createDrizzleChain([insertedAccount]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_business" }]));
    mockIsAnalyticsPlan.mockReturnValue(true);

    const result = await service.addAccount(1, "instagram", "cuttr", "hashtag");
    expect(result).toEqual(insertedAccount);
  });

  it("allows hashtag tracking on studio/scale (always has keyword access)", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));

    const insertedAccount = { id: 56, team_id: 1, username: "cuttr", platform: "tiktok" };
    mockDb.insert.mockReturnValue(createDrizzleChain([insertedAccount]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "studio" }]));
    mockTeamService.consumeClip.mockResolvedValueOnce({ success: true });

    const result = await service.addAccount(1, "tiktok", "cuttr", "hashtag");
    expect(result).toEqual(insertedAccount);
  });

  it("allows profile tracking on starter/pro (only keywords blocked)", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))
      .mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_starter" }]));
    mockGetViralityAccountLimit.mockReturnValueOnce(50);
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 5 }]));

    const insertedAccount = { id: 57, team_id: 1, username: "testuser", platform: "instagram" };
    mockDb.insert.mockReturnValue(createDrizzleChain([insertedAccount]));
    mockDb.select.mockReturnValueOnce(createDrizzleChain([{ plan: "analytics_starter" }]));
    mockIsAnalyticsPlan.mockReturnValue(true);

    const result = await service.addAccount(1, "instagram", "https://www.instagram.com/testuser/");
    expect(result).toEqual(insertedAccount);
    expect(mockTeamService.consumeClip).not.toHaveBeenCalled();
  });
});
