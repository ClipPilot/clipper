import { describe, it, expect, vi, beforeEach } from "vitest";
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
vi.mock("@clipper/shared-db/src/schema", () => ({
  clips: "clips",
  clipFolders: "clipFolders",
  uploadedRawVideos: "uploadedRawVideos",
  clipTags: "clipTags",
  tags: "tags",
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  desc: vi.fn((col: any) => col),
  isNull: vi.fn((col: any) => col),
  count: vi.fn(() => "count"),
  notInArray: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  sql: vi.fn(),
  inArray: vi.fn((...args: any[]) => args),
  gte: vi.fn((...args: any[]) => args),
  lte: vi.fn((...args: any[]) => args),
}));

import { clipManagerService } from "../clipManager.service";

describe("ClipManagerService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getTeamClipsCount", () => {
    it("returns clip count", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ count: 42 }]));
      const result = await clipManagerService.getTeamClipsCount(1);
      expect(result).toBe(42);
    });

    it("returns 0 when no results", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      const result = await clipManagerService.getTeamClipsCount(1);
      expect(result).toBe(0);
    });
  });

  describe("createRawVideo", () => {
    it("inserts and returns raw video record", async () => {
      mockDb.insert.mockReturnValue(createDrizzleChain([{ id: 5, team_id: 1, video_path: "raw/1/v.mp4" }]));
      const result = await clipManagerService.createRawVideo({ teamId: 1, videoPath: "raw/1/v.mp4" });
      expect(result).toEqual({ id: 5, team_id: 1, video_path: "raw/1/v.mp4" });
    });
  });

  describe("getClipsByTeam", () => {
    it("returns clips ordered by created_at", async () => {
      const clips = [{ id: 2 }, { id: 1 }];
      mockDb.select.mockReturnValue(createDrizzleChain(clips));
      const result = await clipManagerService.getClipsByTeam(1);
      expect(result).toEqual(clips);
    });
  });

  describe("getClipById", () => {
    it("returns clip when found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, title: "Test Clip" }]));
      const result = await clipManagerService.getClipById(1, 1);
      expect(result).toEqual({ id: 1, title: "Test Clip" });
    });

    it("throws when clip not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      await expect(clipManagerService.getClipById(999, 1)).rejects.toThrow("Clip not found");
    });
  });

  describe("createPendingClip", () => {
    it("inserts clip with pending status", async () => {
      mockDb.insert.mockReturnValue(createDrizzleChain([{ id: 10, status: "pending", team_id: 1 }]));
      const result = await clipManagerService.createPendingClip({ teamId: 1, userId: 5 });
      expect(result).toEqual({ id: 10, status: "pending", team_id: 1 });
    });
  });

  describe("updateClip", () => {
    it("updates and returns clip", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([{ id: 1, title: "Updated" }]));
      const result = await clipManagerService.updateClip(1, 1, { title: "Updated" });
      expect(result).toEqual({ id: 1, title: "Updated" });
    });

    it("throws when clip not found", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([]));
      await expect(clipManagerService.updateClip(999, 1, { title: "X" })).rejects.toThrow("Clip not found");
    });
  });

  describe("deleteClip", () => {
    it("deletes and returns clip", async () => {
      mockDb.delete.mockReturnValue(createDrizzleChain([{ id: 1 }]));
      const result = await clipManagerService.deleteClip(1, 1);
      expect(result).toEqual({ id: 1 });
    });

    it("throws when clip not found", async () => {
      mockDb.delete.mockReturnValue(createDrizzleChain([]));
      await expect(clipManagerService.deleteClip(999, 1)).rejects.toThrow("Clip not found");
    });
  });

  describe("updateClipStatus", () => {
    it("updates status and returns clip", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([{ id: 1, status: "completed" }]));
      const result = await clipManagerService.updateClipStatus(1, 1, "completed");
      expect(result).toEqual({ id: 1, status: "completed" });
    });

    it("throws when clip not found", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([]));
      await expect(clipManagerService.updateClipStatus(999, 1, "failed")).rejects.toThrow("Clip not found");
    });
  });

  describe("saveClip", () => {
    it("sets saved=true and returns clip", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([{ id: 1, saved: true }]));
      const result = await clipManagerService.saveClip(1, 1);
      expect(result).toEqual({ id: 1, saved: true });
    });

    it("throws when clip not found", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([]));
      await expect(clipManagerService.saveClip(999, 1)).rejects.toThrow("Clip not found");
    });
  });

  describe("rejectClip", () => {
    it("sets status to rejected", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([{ id: 1, status: "rejected" }]));
      const result = await clipManagerService.rejectClip(1, 1);
      expect(result).toEqual({ id: 1, status: "rejected" });
    });
  });

  describe("generateShareToken", () => {
    it("generates a hex token and updates clip", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([{ id: 1, share_token: "abc123" }]));
      const result = await clipManagerService.generateShareToken(1, 1);
      expect(result.share_token).toBeDefined();
    });

    it("throws when clip not found", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([]));
      await expect(clipManagerService.generateShareToken(999, 1)).rejects.toThrow("Clip not found");
    });
  });

  describe("removeShareToken", () => {
    it("sets share_token to null", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([{ id: 1, share_token: null }]));
      const result = await clipManagerService.removeShareToken(1, 1);
      expect(result.share_token).toBeNull();
    });
  });

  describe("getClipByShareToken", () => {
    it("returns clip when found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, title: "Shared Clip" }]));
      const result = await clipManagerService.getClipByShareToken("token-abc");
      expect(result).toEqual({ id: 1, title: "Shared Clip" });
    });

    it("throws when not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      await expect(clipManagerService.getClipByShareToken("bad-token")).rejects.toThrow("Shared clip not found");
    });
  });

  describe("getUnsavedClipsByTeam", () => {
    it("returns unsaved completed clips", async () => {
      const clips = [{ id: 1, saved: false, status: "completed" }];
      mockDb.select.mockReturnValue(createDrizzleChain(clips));
      const result = await clipManagerService.getUnsavedClipsByTeam(1);
      expect(result).toEqual(clips);
    });
  });

  describe("updateClipComplete", () => {
    it("updates clip with all completion data", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([{
        id: 1, status: "completed", clip_path: "clips/1.mp4",
      }]));
      const result = await clipManagerService.updateClipComplete(1, 1, {
        clipPath: "clips/1.mp4",
        sourceVideoPath: "raw/1/v.mp4",
        clipMetadata: { duration: 30 },
      });
      expect(result.status).toBe("completed");
    });

    it("throws when clip not found", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([]));
      await expect(
        clipManagerService.updateClipComplete(999, 1, {
          clipPath: "x", sourceVideoPath: "y", clipMetadata: {},
        }),
      ).rejects.toThrow("Clip not found");
    });
  });
});
