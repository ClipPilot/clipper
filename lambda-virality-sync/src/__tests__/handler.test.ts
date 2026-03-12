import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "aws-lambda";

// ── Hoisted mocks ──

const {
  mockDb,
  mockApifyCall,
  mockApifyListItems,
  mockPool,
} = vi.hoisted(() => {
  // Set env vars before module loads (module-level consts read process.env at import time)
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.APIFY_API_TOKEN = "test-token";
  process.env.SOCIALDATA_API_KEY = "test-socialdata-key";
  const createChain = (result: any[] = []) => {
    const chain: Record<string, any> = {};
    for (const m of [
      "from", "where", "limit", "orderBy", "innerJoin", "leftJoin",
      "set", "values", "returning", "groupBy",
    ]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.then = (resolve: Function) => resolve(result);
    return chain;
  };

  return {
    mockDb: {
      select: vi.fn(() => createChain([])),
      insert: vi.fn(() => createChain([])),
      update: vi.fn(() => createChain([])),
      execute: vi.fn().mockResolvedValue([]),
      createChain,
    },
    mockApifyCall: vi.fn().mockResolvedValue({ id: "run-1", defaultDatasetId: "ds-1" }),
    mockApifyListItems: vi.fn().mockResolvedValue({ items: [] }),
    mockPool: { end: vi.fn() },
  };
});

// ── Module mocks ──

vi.mock("pg", () => ({
  Pool: class MockPool {
    end = vi.fn();
  },
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: () => mockDb,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ["eq", ...args]),
  and: vi.fn((...args: any[]) => ["and", ...args]),
  or: vi.fn((...args: any[]) => ["or", ...args]),
  lte: vi.fn((...args: any[]) => ["lte", ...args]),
  inArray: vi.fn((...args: any[]) => ["inArray", ...args]),
  sql: Object.assign(vi.fn((...args: any[]) => ["sql", ...args]), {
    join: vi.fn(),
  }),
  isNull: vi.fn((...args: any[]) => ["isNull", ...args]),
  not: vi.fn((...args: any[]) => ["not", ...args]),
  gt: vi.fn((...args: any[]) => ["gt", ...args]),
  isNotNull: vi.fn((...args: any[]) => ["isNotNull", ...args]),
  desc: vi.fn((...args: any[]) => args),
}));

vi.mock("apify-client", () => ({
  ApifyClient: class MockApifyClient {
    actor = vi.fn(() => ({ call: mockApifyCall }));
    dataset = vi.fn(() => ({ listItems: mockApifyListItems }));
  },
}));

vi.mock("@clipper/shared-db", () => ({
  viralityAccounts: { id: "va.id", team_id: "va.team_id", username: "va.username", platform: "va.platform", is_active: "va.is_active", syncs_remaining: "va.sr", sync_status: "va.ss", sync_error: "va.se", account_type: "va.at" },
  viralityPosts: { id: "vp.id", account_id: "vp.account_id", platform_post_id: "vp.ppid", metrics_history: "vp.mh", like_count: "vp.lc", comment_count: "vp.cc", video_play_count: "vp.vpc", thumbnail_url: "vp.thu" },
  userAccounts: { id: "ua.id", team_id: "ua.team_id", username: "ua.username", platform: "ua.platform", is_active: "ua.is_active", syncs_remaining: "ua.sr", source: "ua.source", sync_status: "ua.ss", sync_error: "ua.se", last_synced_at: "ua.lsa", account_type: "ua.at" },
  userPosts: { id: "up.id", account_id: "up.account_id", platform_post_id: "up.ppid", mass_post_id: "up.mpid", syncs_remaining: "up.sr", metrics_history: "up.mh", like_count: "up.lc", comment_count: "up.cc", video_play_count: "up.vpc", thumbnail_url: "up.thu", post_url: "up.post_url" },
  posts: { id: "p.id", campaign_id: "p.campaign_id" },
  campaigns: { id: "c.id", status: "c.status", team_id: "c.team_id" },
  teams: { id: "t.id" },
  usageStats: { id: "us.id", team_id: "us.team_id" },
}));

vi.mock("./viralAlerts", () => ({
  checkAndSendViralAlertsForTeam: vi.fn(),
}));

// ── Import handlers after mocks ──

import { workerHandler, orchestratorHandler } from "../handler";

// ── Helpers ──

function makeContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: "test",
    functionVersion: "1",
    invokedFunctionArn: "arn:test",
    memoryLimitInMB: "128",
    awsRequestId: "req-1",
    logGroupName: "test",
    logStreamName: "test",
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
}

function makeExistingPost(overrides: Record<string, any> = {}) {
  return {
    metrics_history: [],
    like_count: 0,
    comment_count: 0,
    video_play_count: null,
    thumbnail_url: null,
    ...overrides,
  };
}

// ── Tests ──

describe("mass_post_batch worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("batch scraping", () => {
    it("should scrape all posts in a single Apify call for Instagram", async () => {
      const batchPosts = [
        { id: 1, post_url: "https://www.instagram.com/reel/ABC123" },
        { id: 2, post_url: "https://www.instagram.com/reel/DEF456" },
        { id: 3, post_url: "https://www.instagram.com/reel/GHI789" },
      ];

      // Mock: syncs_remaining decrement succeeds for all
      mockDb.update.mockImplementation(() => {
        const chain = mockDb.createChain([{ id: 1 }]);
        return chain;
      });

      // Mock: existing post data fetch (bulk query returns all 3 posts)
      let selectCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCount++;
        return mockDb.createChain([
          makeExistingPost({ id: 1, metrics_history: [{ recorded_at: "2026-03-09T00:00:00Z", likes: 10, comments: 2, views: 500 }], like_count: 10, comment_count: 2, video_play_count: 500 }),
          makeExistingPost({ id: 2, metrics_history: [{ recorded_at: "2026-03-09T00:00:00Z", likes: 10, comments: 2, views: 500 }], like_count: 10, comment_count: 2, video_play_count: 500 }),
          makeExistingPost({ id: 3, metrics_history: [{ recorded_at: "2026-03-09T00:00:00Z", likes: 10, comments: 2, views: 500 }], like_count: 10, comment_count: 2, video_play_count: 500 }),
        ]);
      });

      // Mock: Apify returns data for all 3 posts
      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { url: "https://www.instagram.com/reel/ABC123/", shortCode: "ABC123", likesCount: 15, commentsCount: 3, videoPlayCount: 800, displayUrl: "thumb1.jpg" },
          { url: "https://www.instagram.com/reel/DEF456/", shortCode: "DEF456", likesCount: 20, commentsCount: 5, videoPlayCount: 1200, displayUrl: "thumb2.jpg" },
          { url: "https://www.instagram.com/reel/GHI789/", shortCode: "GHI789", likesCount: 8, commentsCount: 1, videoPlayCount: 300, displayUrl: "thumb3.jpg" },
        ],
      });

      const event = {
        id: 100,
        source: "mass_post_batch",
        platform: "instagram",
        account_id: 100,
        team_id: 1,
        posts: batchPosts,
      };

      const result = await workerHandler(event, makeContext(), () => {});

      expect(result.source).toBe("mass_post_batch");
      expect(result.status).toBe("completed");
      expect(result.syncedCount).toBe(3);
      expect(result.skippedCount).toBe(0);

      // Verify only ONE Apify call was made (batch)
      expect(mockApifyCall).toHaveBeenCalledTimes(1);
    });

    it("should scrape all posts in a single Apify call for TikTok", async () => {
      const batchPosts = [
        { id: 10, post_url: "https://www.tiktok.com/@user/video/111111" },
        { id: 11, post_url: "https://www.tiktok.com/@user/video/222222" },
      ];

      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));
      mockDb.select.mockImplementation(() =>
        mockDb.createChain([
          makeExistingPost({ id: 10, metrics_history: [{ recorded_at: "2026-03-09T00:00:00Z", likes: 5, comments: 1, views: 200 }], like_count: 5, comment_count: 1, video_play_count: 200 }),
          makeExistingPost({ id: 11, metrics_history: [{ recorded_at: "2026-03-09T00:00:00Z", likes: 5, comments: 1, views: 200 }], like_count: 5, comment_count: 1, video_play_count: 200 }),
        ])
      );

      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { webVideoUrl: "https://www.tiktok.com/@user/video/111111", id: "111111", diggCount: 50, commentCount: 10, playCount: 5000 },
          { webVideoUrl: "https://www.tiktok.com/@user/video/222222", id: "222222", diggCount: 30, commentCount: 5, playCount: 3000 },
        ],
      });

      const result = await workerHandler({
        id: 200, source: "mass_post_batch", platform: "tiktok",
        account_id: 200, team_id: 1, posts: batchPosts,
      }, makeContext(), () => {});

      expect(result.status).toBe("completed");
      expect(result.syncedCount).toBe(2);
      expect(mockApifyCall).toHaveBeenCalledTimes(1);
    });

    it("should scrape X posts with two Apify calls (posts + views)", async () => {
      const batchPosts = [
        { id: 20, post_url: "https://x.com/user/status/999001" },
        { id: 21, post_url: "https://x.com/user/status/999002" },
      ];

      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));
      mockDb.select.mockImplementation(() =>
        mockDb.createChain([
          makeExistingPost({ id: 20, metrics_history: [{ recorded_at: "2026-03-09T00:00:00Z", likes: 3, comments: 1, views: 100 }], like_count: 3, comment_count: 1, video_play_count: 100 }),
          makeExistingPost({ id: 21, metrics_history: [{ recorded_at: "2026-03-09T00:00:00Z", likes: 3, comments: 1, views: 100 }], like_count: 3, comment_count: 1, video_play_count: 100 }),
        ])
      );

      // First call: posts scraper
      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { id: "999001", likeCount: 10, replyCount: 2 },
          { id: "999002", likeCount: 15, replyCount: 4 },
        ],
      });
      // Second call: views scraper
      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { id: "999001", view_count: 5000 },
          { id: "999002", view_count: 8000 },
        ],
      });

      const result = await workerHandler({
        id: 300, source: "mass_post_batch", platform: "x",
        account_id: 300, team_id: 1, posts: batchPosts,
      }, makeContext(), () => {});

      expect(result.status).toBe("completed");
      expect(result.syncedCount).toBe(2);
      // X uses 2 Apify calls: posts + views
      expect(mockApifyCall).toHaveBeenCalledTimes(2);
    });

    it("should skip posts with no syncs remaining", async () => {
      // First post: decrement succeeds; second: fails (no syncs)
      let callCount = 0;
      mockDb.update.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockDb.createChain([{ id: 1 }]); // decrement ok
        if (callCount === 2) return mockDb.createChain([]);            // no syncs
        return mockDb.createChain([{ id: 1 }]); // subsequent updates
      });

      mockDb.select.mockImplementation(() =>
        mockDb.createChain([makeExistingPost({
          id: 40,
          metrics_history: [{ recorded_at: "2026-03-09T00:00:00Z", likes: 5, comments: 1, views: 200 }],
        })])
      );

      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { url: "https://www.instagram.com/reel/AAA/", shortCode: "AAA", likesCount: 10, commentsCount: 2, videoPlayCount: 500 },
        ],
      });

      const result = await workerHandler({
        id: 400, source: "mass_post_batch", platform: "instagram",
        account_id: 400, team_id: 1,
        posts: [
          { id: 40, post_url: "https://www.instagram.com/reel/AAA" },
          { id: 41, post_url: "https://www.instagram.com/reel/BBB" },
        ],
      }, makeContext(), () => {});

      expect(result.status).toBe("completed");
      expect(result.syncedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    it("should skip all posts and return skipped if none have syncs remaining", async () => {
      mockDb.update.mockImplementation(() => mockDb.createChain([])); // all fail

      const result = await workerHandler({
        id: 500, source: "mass_post_batch", platform: "instagram",
        account_id: 500, team_id: 1,
        posts: [
          { id: 50, post_url: "https://www.instagram.com/reel/XXX" },
          { id: 51, post_url: "https://www.instagram.com/reel/YYY" },
        ],
      }, makeContext(), () => {});

      expect(result.status).toBe("skipped");
      expect(result.reason).toBe("no_syncs");
      // No Apify call should have been made
      expect(mockApifyCall).not.toHaveBeenCalled();
    });

    it("should skip posts that Apify returns no metrics for", async () => {
      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));
      mockDb.select.mockImplementation(() =>
        mockDb.createChain([
          makeExistingPost({ id: 60, metrics_history: [{ recorded_at: "2026-03-09T00:00:00Z", likes: 5, comments: 1, views: 200 }] }),
          makeExistingPost({ id: 61, metrics_history: [{ recorded_at: "2026-03-09T00:00:00Z", likes: 5, comments: 1, views: 200 }] }),
        ])
      );

      // Apify only returns data for 1 of 2 posts
      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { url: "https://www.instagram.com/reel/AAA/", shortCode: "AAA", likesCount: 10, commentsCount: 2, videoPlayCount: 500 },
          // BBB missing from results
        ],
      });

      const result = await workerHandler({
        id: 600, source: "mass_post_batch", platform: "instagram",
        account_id: 600, team_id: 1,
        posts: [
          { id: 60, post_url: "https://www.instagram.com/reel/AAA" },
          { id: 61, post_url: "https://www.instagram.com/reel/BBB" },
        ],
      }, makeContext(), () => {});

      expect(result.status).toBe("completed");
      expect(result.syncedCount).toBe(1);
      expect(result.skippedCount).toBe(1); // BBB skipped
    });
  });

  describe("metrics monotonicity and flaky data protection", () => {
    it("should use previous likes/comments when Apify returns zero (flaky scrape)", async () => {
      const previousHistory = [
        { recorded_at: "2026-03-08T00:00:00Z", likes: 50, comments: 10, views: 2000 },
      ];

      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));

      mockDb.select.mockImplementation(() =>
        mockDb.createChain([makeExistingPost({
          id: 70,
          metrics_history: previousHistory,
          like_count: 50,
          comment_count: 10,
          video_play_count: 2000,
        })])
      );

      // Apify returns 0 likes, 0 comments (flaky), but real views
      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { url: "https://www.instagram.com/reel/FLAKY/", shortCode: "FLAKY", likesCount: 0, commentsCount: 0, videoPlayCount: 2100, displayUrl: "thumb.jpg" },
        ],
      });

      const updateCalls: any[] = [];
      mockDb.update.mockImplementation((...args: any[]) => {
        const chain = mockDb.createChain([{ id: 1 }]);
        const originalSet = chain.set;
        chain.set = vi.fn((data: any) => {
          updateCalls.push(data);
          return originalSet(data);
        });
        return chain;
      });

      await workerHandler({
        id: 700, source: "mass_post_batch", platform: "instagram",
        account_id: 700, team_id: 1,
        posts: [{ id: 70, post_url: "https://www.instagram.com/reel/FLAKY" }],
      }, makeContext(), () => {});

      // Find the metrics update call (has like_count field)
      const metricsUpdate = updateCalls.find((c) => c.like_count !== undefined);
      expect(metricsUpdate).toBeDefined();
      // likes should fall back to previous (50), not 0
      expect(metricsUpdate.like_count).toBe(50);
      expect(metricsUpdate.comment_count).toBe(10);
      // views should be 2100 (higher than previous 2000)
      expect(metricsUpdate.video_play_count).toBe(2100);
    });

    it("should enforce views strictly monotonic — never decrease", async () => {
      const previousHistory = [
        { recorded_at: "2026-03-08T00:00:00Z", likes: 50, comments: 10, views: 5000 },
      ];

      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));
      mockDb.select.mockImplementation(() =>
        mockDb.createChain([makeExistingPost({
          id: 80,
          metrics_history: previousHistory,
          like_count: 50,
          comment_count: 10,
          video_play_count: 5000,
        })])
      );

      // Apify returns LOWER views (4000 < 5000), likes decreased to 40 (allowed)
      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { url: "https://www.instagram.com/reel/MONO/", shortCode: "MONO", likesCount: 40, commentsCount: 8, videoPlayCount: 4000 },
        ],
      });

      const updateCalls: any[] = [];
      mockDb.update.mockImplementation(() => {
        const chain = mockDb.createChain([{ id: 1 }]);
        const originalSet = chain.set;
        chain.set = vi.fn((data: any) => {
          updateCalls.push(data);
          return originalSet(data);
        });
        return chain;
      });

      await workerHandler({
        id: 800, source: "mass_post_batch", platform: "instagram",
        account_id: 800, team_id: 1,
        posts: [{ id: 80, post_url: "https://www.instagram.com/reel/MONO" }],
      }, makeContext(), () => {});

      const metricsUpdate = updateCalls.find((c) => c.like_count !== undefined);
      expect(metricsUpdate).toBeDefined();
      // likes can decrease (40 < 50, that's real)
      expect(metricsUpdate.like_count).toBe(40);
      // comments can decrease
      expect(metricsUpdate.comment_count).toBe(8);
      // views must NOT decrease — should stay at 5000 (Math.max(4000, 5000))
      expect(metricsUpdate.video_play_count).toBe(5000);
    });

    it("should allow views to increase", async () => {
      const previousHistory = [
        { recorded_at: "2026-03-08T00:00:00Z", likes: 50, comments: 10, views: 5000 },
      ];

      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));
      mockDb.select.mockImplementation(() =>
        mockDb.createChain([makeExistingPost({
          id: 90,
          metrics_history: previousHistory,
          like_count: 50, comment_count: 10, video_play_count: 5000,
        })])
      );

      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { url: "https://www.instagram.com/reel/UP/", shortCode: "UP", likesCount: 60, commentsCount: 12, videoPlayCount: 7000 },
        ],
      });

      const updateCalls: any[] = [];
      mockDb.update.mockImplementation(() => {
        const chain = mockDb.createChain([{ id: 1 }]);
        const originalSet = chain.set;
        chain.set = vi.fn((data: any) => {
          updateCalls.push(data);
          return originalSet(data);
        });
        return chain;
      });

      await workerHandler({
        id: 900, source: "mass_post_batch", platform: "instagram",
        account_id: 900, team_id: 1,
        posts: [{ id: 90, post_url: "https://www.instagram.com/reel/UP" }],
      }, makeContext(), () => {});

      const metricsUpdate = updateCalls.find((c) => c.like_count !== undefined);
      expect(metricsUpdate.like_count).toBe(60);
      expect(metricsUpdate.comment_count).toBe(12);
      expect(metricsUpdate.video_play_count).toBe(7000);
    });

    it("should use previous views when Apify returns null", async () => {
      const previousHistory = [
        { recorded_at: "2026-03-08T00:00:00Z", likes: 50, comments: 10, views: 3000 },
      ];

      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));
      mockDb.select.mockImplementation(() =>
        mockDb.createChain([makeExistingPost({
          id: 100,
          metrics_history: previousHistory,
          like_count: 50, comment_count: 10, video_play_count: 3000,
        })])
      );

      // Apify returns null for videoPlayCount (missing field)
      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { url: "https://www.instagram.com/reel/NULL/", shortCode: "NULL", likesCount: 55, commentsCount: 11 },
        ],
      });

      const updateCalls: any[] = [];
      mockDb.update.mockImplementation(() => {
        const chain = mockDb.createChain([{ id: 1 }]);
        const originalSet = chain.set;
        chain.set = vi.fn((data: any) => {
          updateCalls.push(data);
          return originalSet(data);
        });
        return chain;
      });

      await workerHandler({
        id: 1000, source: "mass_post_batch", platform: "instagram",
        account_id: 1000, team_id: 1,
        posts: [{ id: 100, post_url: "https://www.instagram.com/reel/NULL" }],
      }, makeContext(), () => {});

      const metricsUpdate = updateCalls.find((c) => c.like_count !== undefined);
      expect(metricsUpdate.like_count).toBe(55);
      // views should fall back to previous since Apify returned null
      expect(metricsUpdate.video_play_count).toBe(3000);
    });

    it("should allow zero on first sync (no previous data)", async () => {
      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));
      mockDb.select.mockImplementation(() =>
        mockDb.createChain([makeExistingPost({
          id: 110,
          metrics_history: [], // empty — first sync
          like_count: 0, comment_count: 0, video_play_count: null,
        })])
      );

      // Apify returns all zeros (legitimate for brand new post)
      // scrapeBatchPostMetrics uses `?? null` for views, so videoPlayCount: 0 stays as 0
      // and likesCount: 0 stays as 0 (|| 0 fallback in normalizer)
      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { url: "https://www.instagram.com/reel/NEW/", shortCode: "NEW", likesCount: 0, commentsCount: 0, videoPlayCount: 5 },
        ],
      });

      const updateCalls: any[] = [];
      mockDb.update.mockImplementation(() => {
        const chain = mockDb.createChain([{ id: 1 }]);
        const originalSet = chain.set;
        chain.set = vi.fn((data: any) => {
          updateCalls.push(data);
          return originalSet(data);
        });
        return chain;
      });

      await workerHandler({
        id: 1100, source: "mass_post_batch", platform: "instagram",
        account_id: 1100, team_id: 1,
        posts: [{ id: 110, post_url: "https://www.instagram.com/reel/NEW" }],
      }, makeContext(), () => {});

      const metricsUpdate = updateCalls.find((c) => c.like_count !== undefined);
      // First sync with no previous data — zero likes/comments allowed, views recorded as-is
      expect(metricsUpdate.like_count).toBe(0);
      expect(metricsUpdate.comment_count).toBe(0);
      expect(metricsUpdate.video_play_count).toBe(5);
    });

    it("should handle multiple posts with mixed flaky and real data", async () => {
      // Post A: has history, will get flaky data
      // Post B: has history, will get real data
      // Bulk select returns both posts in a single query
      mockDb.select.mockImplementation(() =>
        mockDb.createChain([
          makeExistingPost({
            id: 120,
            metrics_history: [{ recorded_at: "2026-03-08T00:00:00Z", likes: 100, comments: 20, views: 10000 }],
            like_count: 100, comment_count: 20, video_play_count: 10000,
          }),
          makeExistingPost({
            id: 121,
            metrics_history: [{ recorded_at: "2026-03-08T00:00:00Z", likes: 200, comments: 30, views: 20000 }],
            like_count: 200, comment_count: 30, video_play_count: 20000,
          }),
        ])
      );

      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));

      mockApifyListItems.mockResolvedValueOnce({
        items: [
          // Post A: flaky — 0 likes, null views
          { url: "https://www.instagram.com/reel/POSTA/", shortCode: "POSTA", likesCount: 0, commentsCount: 0 },
          // Post B: real data — increased
          { url: "https://www.instagram.com/reel/POSTB/", shortCode: "POSTB", likesCount: 250, commentsCount: 35, videoPlayCount: 25000 },
        ],
      });

      const updateCalls: any[] = [];
      mockDb.update.mockImplementation(() => {
        const chain = mockDb.createChain([{ id: 1 }]);
        const originalSet = chain.set;
        chain.set = vi.fn((data: any) => {
          updateCalls.push(data);
          return originalSet(data);
        });
        return chain;
      });

      await workerHandler({
        id: 1200, source: "mass_post_batch", platform: "instagram",
        account_id: 1200, team_id: 1,
        posts: [
          { id: 120, post_url: "https://www.instagram.com/reel/POSTA" },
          { id: 121, post_url: "https://www.instagram.com/reel/POSTB" },
        ],
      }, makeContext(), () => {});

      // Find metrics updates (have like_count)
      const metricsUpdates = updateCalls.filter((c) => c.like_count !== undefined);
      expect(metricsUpdates.length).toBe(2);

      // Post A: flaky data — should use previous values
      expect(metricsUpdates[0].like_count).toBe(100);    // previous, not 0
      expect(metricsUpdates[0].comment_count).toBe(20);   // previous, not 0
      expect(metricsUpdates[0].video_play_count).toBe(10000); // previous (null fallback)

      // Post B: real increased data
      expect(metricsUpdates[1].like_count).toBe(250);
      expect(metricsUpdates[1].comment_count).toBe(35);
      expect(metricsUpdates[1].video_play_count).toBe(25000);
    });
  });

  describe("metrics_history entries", () => {
    it("should append correct entry to metrics_history", async () => {
      const previousHistory = [
        { recorded_at: "2026-03-08T00:00:00Z", likes: 50, comments: 10, views: 5000 },
      ];

      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));
      mockDb.select.mockImplementation(() =>
        mockDb.createChain([makeExistingPost({
          id: 130,
          metrics_history: previousHistory,
          like_count: 50, comment_count: 10, video_play_count: 5000,
        })])
      );

      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { url: "https://www.instagram.com/reel/HIST/", shortCode: "HIST", likesCount: 60, commentsCount: 12, videoPlayCount: 6000 },
        ],
      });

      const updateCalls: any[] = [];
      mockDb.update.mockImplementation(() => {
        const chain = mockDb.createChain([{ id: 1 }]);
        const originalSet = chain.set;
        chain.set = vi.fn((data: any) => {
          updateCalls.push(data);
          return originalSet(data);
        });
        return chain;
      });

      await workerHandler({
        id: 1300, source: "mass_post_batch", platform: "instagram",
        account_id: 1300, team_id: 1,
        posts: [{ id: 130, post_url: "https://www.instagram.com/reel/HIST" }],
      }, makeContext(), () => {});

      const metricsUpdate = updateCalls.find((c) => c.metrics_history !== undefined);
      expect(metricsUpdate).toBeDefined();
      const history = metricsUpdate.metrics_history;
      // Should have previous entry + new entry
      expect(history.length).toBe(2);
      expect(history[0]).toEqual(previousHistory[0]);
      expect(history[1].likes).toBe(60);
      expect(history[1].comments).toBe(12);
      expect(history[1].views).toBe(6000);
      expect(history[1].recorded_at).toBeDefined();
    });

    it("should record previous values in history when Apify returns flaky zeros", async () => {
      const previousHistory = [
        { recorded_at: "2026-03-08T00:00:00Z", likes: 100, comments: 20, views: 8000 },
      ];

      mockDb.update.mockImplementation(() => mockDb.createChain([{ id: 1 }]));
      mockDb.select.mockImplementation(() =>
        mockDb.createChain([makeExistingPost({
          id: 140,
          metrics_history: previousHistory,
          like_count: 100, comment_count: 20, video_play_count: 8000,
        })])
      );

      // Flaky: all zeros
      mockApifyListItems.mockResolvedValueOnce({
        items: [
          { url: "https://www.instagram.com/reel/FLAKY2/", shortCode: "FLAKY2", likesCount: 0, commentsCount: 0, videoPlayCount: 0 },
        ],
      });

      const updateCalls: any[] = [];
      mockDb.update.mockImplementation(() => {
        const chain = mockDb.createChain([{ id: 1 }]);
        const originalSet = chain.set;
        chain.set = vi.fn((data: any) => {
          updateCalls.push(data);
          return originalSet(data);
        });
        return chain;
      });

      await workerHandler({
        id: 1400, source: "mass_post_batch", platform: "instagram",
        account_id: 1400, team_id: 1,
        posts: [{ id: 140, post_url: "https://www.instagram.com/reel/FLAKY2" }],
      }, makeContext(), () => {});

      const metricsUpdate = updateCalls.find((c) => c.metrics_history !== undefined);
      const history = metricsUpdate.metrics_history;
      // The new history entry should NOT contain zeros
      const newEntry = history[history.length - 1];
      expect(newEntry.likes).toBe(100);   // previous, not 0
      expect(newEntry.comments).toBe(20);  // previous, not 0
      expect(newEntry.views).toBe(8000);   // Math.max(0, 8000) = 8000
    });
  });
});

describe("orchestrator mass post batching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should group mass posts by account into batches", async () => {
    // Mock: virality accounts = 0, user accounts = 0, mass posts = 4 across 2 accounts
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // virality accounts query
        return mockDb.createChain([]);
      }
      if (selectCallCount === 2) {
        // user accounts query
        return mockDb.createChain([]);
      }
      // mass posts query
      return mockDb.createChain([
        { id: 1, post_url: "https://instagram.com/reel/A1", syncs_remaining: 10, platform: "instagram", account_id: 100, team_id: 1 },
        { id: 2, post_url: "https://instagram.com/reel/A2", syncs_remaining: 10, platform: "instagram", account_id: 100, team_id: 1 },
        { id: 3, post_url: "https://instagram.com/reel/B1", syncs_remaining: 5, platform: "instagram", account_id: 200, team_id: 1 },
        { id: 4, post_url: "https://instagram.com/reel/B2", syncs_remaining: 5, platform: "instagram", account_id: 200, team_id: 1 },
      ]);
    });

    const result = await orchestratorHandler({}, makeContext(), () => {});

    expect(result.accounts).toBeDefined();
    // Should be 2 batch items (one per account), not 4 individual items
    expect(result.accounts.length).toBe(2);
    expect(result.accounts[0].source).toBe("mass_post_batch");
    expect(result.accounts[1].source).toBe("mass_post_batch");

    // Account 100 should have 2 posts
    const batch100 = result.accounts.find((a: any) => a.account_id === 100);
    expect(batch100.posts.length).toBe(2);

    // Account 200 should have 2 posts
    const batch200 = result.accounts.find((a: any) => a.account_id === 200);
    expect(batch200.posts.length).toBe(2);
  });

  it("should not emit mass_post (old format) items", async () => {
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount <= 2) return mockDb.createChain([]);
      return mockDb.createChain([
        { id: 1, post_url: "https://instagram.com/reel/X1", syncs_remaining: 10, platform: "instagram", account_id: 100, team_id: 1 },
      ]);
    });

    const result = await orchestratorHandler({}, makeContext(), () => {});

    // No items should have source "mass_post" (old format)
    const oldFormatItems = result.accounts.filter((a: any) => a.source === "mass_post");
    expect(oldFormatItems.length).toBe(0);

    // Should be mass_post_batch
    const batchItems = result.accounts.filter((a: any) => a.source === "mass_post_batch");
    expect(batchItems.length).toBe(1);
  });
});
