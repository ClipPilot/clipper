import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../../test/helpers/db.helper";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const { mockGetPresignedUploadUrlForKey, mockGetPresignedUrl, mockDeleteObject } = vi.hoisted(() => ({
  mockGetPresignedUploadUrlForKey: vi.fn(),
  mockGetPresignedUrl: vi.fn(),
  mockDeleteObject: vi.fn(),
}));

const { mockSanitizeFileName } = vi.hoisted(() => ({
  mockSanitizeFileName: vi.fn((s: string) => s),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../../db", () => ({ db: mockDb }));

vi.mock("../../s3.service", () => ({
  s3Service: {
    getPresignedUploadUrlForKey: mockGetPresignedUploadUrlForKey,
    getPresignedUrl: mockGetPresignedUrl,
    deleteObject: mockDeleteObject,
  },
}));

vi.mock("../../../utils/fileUtils", () => ({
  sanitizeFileName: mockSanitizeFileName,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  inArray: vi.fn((...args: any[]) => args),
  desc: vi.fn((...args: any[]) => args),
  sql: vi.fn(),
}));

vi.mock("@clipper/shared-db", () => ({
  campaigns: "campaigns",
  campaignVideos: "campaignVideos",
  clips: "clips",
  tags: "tags",
  clipTags: "clipTags",
  posts: "posts",
}));

// ── Import service after all mocks ───────────────────────────────────────────

import { campaignVideoService } from "../campaignVideo.service";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makeVideo = (overrides: Record<string, any> = {}) => ({
  id: 1,
  campaign_id: 10,
  clip_id: null,
  custom_video_key: null,
  custom_video_name: null,
  duration_seconds: null,
  created_at: new Date(),
  ...overrides,
});

const makeVideoRow = (overrides: Record<string, any> = {}) => ({
  id: 1,
  campaign_id: 10,
  clip_id: null,
  custom_video_key: null,
  custom_video_name: null,
  duration_seconds: null,
  created_at: new Date(),
  clip_path: null,
  clip_title: null,
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("CampaignVideoService", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── addClipsFromLibrary ────────────────────────────────────────────────────

  describe("addClipsFromLibrary", () => {
    it("returns empty array when clipIds is empty", async () => {
      const result = await campaignVideoService.addClipsFromLibrary(10, 5, []);

      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("inserts campaign video rows and returns them", async () => {
      const ownedClips = [{ id: 1 }, { id: 2 }];
      const insertedRows = [
        makeVideo({ id: 100, clip_id: 1 }),
        makeVideo({ id: 101, clip_id: 2 }),
      ];

      // 1. validate ownership
      mockDb.select.mockReturnValueOnce(createDrizzleChain(ownedClips));
      // 2. filter out existing clips in campaign (none exist yet)
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));
      // 3. checkVideoGate — fetch campaign
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ video_minimum: 2 }]));
      // 4. checkVideoGate — fetch count
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 2 }]));

      mockDb.insert.mockReturnValueOnce(createDrizzleChain(insertedRows));
      mockDb.update.mockReturnValueOnce(createDrizzleChain([]));

      const result = await campaignVideoService.addClipsFromLibrary(10, 5, [1, 2]);

      expect(result).toEqual(insertedRows);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it("throws when any clip IDs are not owned by the team", async () => {
      // Only clip 1 is owned; clip 99 is not
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ id: 1 }]));

      await expect(
        campaignVideoService.addClipsFromLibrary(10, 5, [1, 99]),
      ).rejects.toThrow("Clips not found or not owned: 99");
    });

    it("throws when none of the requested clips are owned", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      await expect(
        campaignVideoService.addClipsFromLibrary(10, 5, [42, 43]),
      ).rejects.toThrow("Clips not found or not owned: 42, 43");
    });
  });

  // ── createCustomUpload ─────────────────────────────────────────────────────

  describe("createCustomUpload", () => {
    it("returns video record, upload URL, and S3 key", async () => {
      const video = makeVideo({
        id: 7,
        custom_video_key: "campaign-videos/5/10/1234_clip.mp4",
        custom_video_name: "clip.mp4",
      });

      mockGetPresignedUploadUrlForKey.mockResolvedValueOnce("https://s3.example.com/presigned");
      mockDb.insert.mockReturnValueOnce(createDrizzleChain([video]));

      const result = await campaignVideoService.createCustomUpload(
        10,
        5,
        "clip.mp4",
        "video/mp4",
      );

      expect(result.video).toEqual(video);
      expect(result.uploadUrl).toBe("https://s3.example.com/presigned");
      expect(result.s3Key).toMatch(/^campaign-videos\/5\/10\/.+clip\.mp4$/);
    });

    it("sanitizes the file name when constructing the S3 key", async () => {
      mockSanitizeFileName.mockReturnValueOnce("sanitized-name.mp4");
      mockGetPresignedUploadUrlForKey.mockResolvedValueOnce("https://s3.example.com/presigned");
      mockDb.insert.mockReturnValueOnce(createDrizzleChain([makeVideo()]));

      const result = await campaignVideoService.createCustomUpload(
        10,
        5,
        "my unsafe file name!!.mp4",
        "video/mp4",
      );

      expect(mockSanitizeFileName).toHaveBeenCalledWith("my unsafe file name!!.mp4");
      expect(result.s3Key).toContain("sanitized-name.mp4");
    });
  });

  // ── completeCustomUpload ───────────────────────────────────────────────────

  describe("completeCustomUpload", () => {
    it("returns enriched video with presigned URL", async () => {
      const video = makeVideo({
        id: 7,
        custom_video_key: "campaign-videos/5/10/1234_clip.mp4",
        custom_video_name: "clip.mp4",
      });
      const createdClip = { id: 99 };
      const existingTag = { id: 42 };
      const refetchedRow = makeVideoRow({
        id: 7,
        campaign_id: 10,
        clip_id: 99,
        custom_video_key: "campaign-videos/5/10/1234_clip.mp4",
        custom_video_name: "clip.mp4",
        clip_path: "campaign-videos/5/10/1234_clip.mp4",
        clip_title: "clip",
      });

      // 1. fetch video
      mockDb.select.mockReturnValueOnce(createDrizzleChain([video]));
      // 2. create clip in library
      mockDb.insert.mockReturnValueOnce(createDrizzleChain([createdClip]));
      // 3. link clip to campaign video
      mockDb.update.mockReturnValueOnce(createDrizzleChain([]));
      // 4. ensureCampaignUploadTag — find tag
      mockDb.select.mockReturnValueOnce(createDrizzleChain([existingTag]));
      // 5. ensureCampaignUploadTag — insert clipTag
      mockDb.insert.mockReturnValueOnce(createDrizzleChain([]));
      // 6. checkVideoGate — fetch campaign
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ video_minimum: 1 }]));
      // 7. checkVideoGate — fetch count
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 1 }]));
      // 8. checkVideoGate — update campaigns
      mockDb.update.mockReturnValueOnce(createDrizzleChain([]));
      // 9. re-fetch with joined clip data
      mockDb.select.mockReturnValueOnce(createDrizzleChain([refetchedRow]));
      // 10. presigned URL
      mockGetPresignedUrl.mockResolvedValueOnce("https://cdn.example.com/vid.mp4");

      const result = await campaignVideoService.completeCustomUpload(10, 7, 5, 1);

      expect(result).toMatchObject({
        id: 7,
        campaign_id: 10,
        clip_id: 99,
        presigned_url: "https://cdn.example.com/vid.mp4",
        status: "ready",
      });
    });

    it("throws when video not found", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      await expect(
        campaignVideoService.completeCustomUpload(10, 999, 5, 1),
      ).rejects.toThrow("Video not found");
    });
  });

  // ── removeVideo ────────────────────────────────────────────────────────────

  describe("removeVideo", () => {
    it("deletes custom video and cleans up S3 object", async () => {
      const video = makeVideo({ id: 3, custom_video_key: "campaign-videos/5/10/1234_clip.mp4" });

      // 1. fetch video
      mockDb.select.mockReturnValueOnce(createDrizzleChain([video]));
      // 2. checkVideoGate — fetch campaign
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ video_minimum: 2 }]));
      // 3. checkVideoGate — fetch count
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 0 }]));

      mockDb.delete.mockReturnValueOnce(createDrizzleChain([]));
      mockDb.update.mockReturnValueOnce(createDrizzleChain([]));
      mockDeleteObject.mockResolvedValueOnce(undefined);

      const result = await campaignVideoService.removeVideo(10, 3);

      expect(result).toEqual({ deleted: true });
      expect(mockDeleteObject).toHaveBeenCalledWith("campaign-videos/5/10/1234_clip.mp4");
    });

    it("deletes clip-based video without calling S3 delete", async () => {
      const video = makeVideo({ id: 4, clip_id: 7, custom_video_key: null });

      mockDb.select.mockReturnValueOnce(createDrizzleChain([video]));
      // checkVideoGate
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ video_minimum: 2 }]));
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 1 }]));

      mockDb.delete.mockReturnValueOnce(createDrizzleChain([]));
      mockDb.update.mockReturnValueOnce(createDrizzleChain([]));

      const result = await campaignVideoService.removeVideo(10, 4);

      expect(result).toEqual({ deleted: true });
      expect(mockDeleteObject).not.toHaveBeenCalled();
    });

    it("returns deleted:true even when S3 delete throws", async () => {
      const video = makeVideo({ id: 3, custom_video_key: "some-key.mp4" });

      mockDb.select.mockReturnValueOnce(createDrizzleChain([video]));
      // checkVideoGate
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ video_minimum: 2 }]));
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 0 }]));

      mockDb.delete.mockReturnValueOnce(createDrizzleChain([]));
      mockDb.update.mockReturnValueOnce(createDrizzleChain([]));
      mockDeleteObject.mockRejectedValueOnce(new Error("S3 error"));

      const result = await campaignVideoService.removeVideo(10, 3);

      expect(result).toEqual({ deleted: true });
    });

    it("throws when video not found", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      await expect(campaignVideoService.removeVideo(10, 999)).rejects.toThrow("Video not found");
    });
  });

  // ── listVideos ─────────────────────────────────────────────────────────────

  describe("listVideos", () => {
    it("returns videos with presigned URLs from S3", async () => {
      const rows = [
        makeVideoRow({ id: 1, custom_video_key: "campaign-videos/5/10/vid.mp4" }),
        makeVideoRow({ id: 2, clip_id: 7, clip_path: "clips/7.mp4" }),
      ];

      // 1. count query
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 2 }]));
      // 2. main rows query
      mockDb.select.mockReturnValueOnce(createDrizzleChain(rows));
      // 3. postCounts query (clip_id: 7 is non-null)
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));
      mockGetPresignedUrl
        .mockResolvedValueOnce("https://cdn.example.com/vid.mp4")
        .mockResolvedValueOnce("https://cdn.example.com/clip.mp4");

      const result = await campaignVideoService.listVideos(10);

      expect(result.videos).toHaveLength(2);
      expect(result.videos[0].presigned_url).toBe("https://cdn.example.com/vid.mp4");
      expect(result.videos[1].presigned_url).toBe("https://cdn.example.com/clip.mp4");
    });

    it("sets presigned_url to null when S3 presigning fails", async () => {
      const rows = [makeVideoRow({ id: 1, custom_video_key: "bad-key.mp4" })];

      // count query
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 1 }]));
      mockDb.select.mockReturnValueOnce(createDrizzleChain(rows));
      mockGetPresignedUrl.mockRejectedValueOnce(new Error("S3 error"));

      const result = await campaignVideoService.listVideos(10);

      expect(result.videos[0].presigned_url).toBeNull();
    });

    it("sets presigned_url to null when video has no key or clip path", async () => {
      const rows = [makeVideoRow({ id: 1, custom_video_key: null, clip_path: null })];

      // count query
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 1 }]));
      mockDb.select.mockReturnValueOnce(createDrizzleChain(rows));

      const result = await campaignVideoService.listVideos(10);

      expect(result.videos[0].presigned_url).toBeNull();
      expect(mockGetPresignedUrl).not.toHaveBeenCalled();
    });

    it("returns empty array when campaign has no videos", async () => {
      // count query
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 0 }]));
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      const result = await campaignVideoService.listVideos(10);

      expect(result.videos).toEqual([]);
    });

    it("maps response fields correctly", async () => {
      const createdAt = new Date("2026-01-01");
      const rows = [
        makeVideoRow({
          id: 5,
          campaign_id: 10,
          clip_id: 7,
          custom_video_name: null,
          clip_title: "My Clip",
          duration_seconds: 42,
          created_at: createdAt,
          clip_path: "clips/7.mp4",
        }),
      ];

      // 1. count query
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ count: 1 }]));
      // 2. main rows query
      mockDb.select.mockReturnValueOnce(createDrizzleChain(rows));
      // 3. postCounts query (clip_id: 7 is non-null)
      mockDb.select.mockReturnValueOnce(createDrizzleChain([{ clip_id: 7, count: 3 }]));
      mockGetPresignedUrl.mockResolvedValueOnce("https://cdn.example.com/clip.mp4");

      const result = await campaignVideoService.listVideos(10);

      expect(result.videos[0]).toMatchObject({
        id: 5,
        campaign_id: 10,
        clip_id: 7,
        file_name: null,
        title: "My Clip",
        duration_seconds: 42,
        presigned_url: "https://cdn.example.com/clip.mp4",
        status: "ready",
        created_at: createdAt,
        post_count: 3,
      });
    });
  });

  // ── checkVideoGate ─────────────────────────────────────────────────────────

  describe("checkVideoGate", () => {
    it("returns true and updates campaigns when count meets the minimum", async () => {
      mockDb.select
        // fetch campaign minimum
        .mockReturnValueOnce(createDrizzleChain([{ video_minimum: 3 }]))
        // fetch video count
        .mockReturnValueOnce(createDrizzleChain([{ count: 3 }]));

      mockDb.update.mockReturnValueOnce(createDrizzleChain([]));

      const result = await campaignVideoService.checkVideoGate(10);

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it("returns false when count is below the minimum", async () => {
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([{ video_minimum: 5 }]))
        .mockReturnValueOnce(createDrizzleChain([{ count: 2 }]));

      mockDb.update.mockReturnValueOnce(createDrizzleChain([]));

      const result = await campaignVideoService.checkVideoGate(10);

      expect(result).toBe(false);
    });

    it("returns true when video_minimum is null and count is >= 0", async () => {
      // video_minimum null means ?? 0, so any count satisfies the gate
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([{ video_minimum: null }]))
        .mockReturnValueOnce(createDrizzleChain([{ count: 0 }]));

      mockDb.update.mockReturnValueOnce(createDrizzleChain([]));

      const result = await campaignVideoService.checkVideoGate(10);

      expect(result).toBe(true);
    });

    it("returns false when campaign is not found", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      const result = await campaignVideoService.checkVideoGate(999);

      expect(result).toBe(false);
    });
  });
});
