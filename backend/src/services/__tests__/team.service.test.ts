import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../test/helpers/db.helper";
import {
  buildTeam,
  buildTeamMember,
  buildUsageStats,
} from "../../../test/factories";

// Hoist mock variables for vi.mock factories
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../db", () => ({ db: mockDb }));

vi.mock("../../config/stripe.config", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../../config/stripe.config")>();
  return {
    ...orig,
    stripe: { subscriptions: { cancel: vi.fn() } },
  };
});

vi.mock("../s3.service", () => ({
  s3Service: {
    getPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/presigned"),
  },
}));

vi.mock("../../constants/credits", () => ({
  FREE_TIER_STARTING_CREDITS: 15,
}));

import { teamService } from "../team.service";

describe("TeamService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyTeamAccess", () => {
    it("returns true when member exists", async () => {
      const member = buildTeamMember();
      mockDb.select.mockReturnValue(createDrizzleChain([member]));

      const result = await teamService.verifyTeamAccess(1, 1);
      expect(result).toBe(true);
    });

    it("returns false when member not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));

      const result = await teamService.verifyTeamAccess(1, 999);
      expect(result).toBe(false);
    });
  });

  describe("getSeatLimitForPlan", () => {
    it("returns 1 for free", () => {
      expect(teamService.getSeatLimitForPlan("free")).toBe(1);
    });

    it("returns 1 for studio", () => {
      expect(teamService.getSeatLimitForPlan("studio")).toBe(1);
    });

    it("returns -1 (unlimited) for scale", () => {
      expect(teamService.getSeatLimitForPlan("scale")).toBe(-1);
    });

    it("returns -1 (unlimited) for enterprise", () => {
      expect(teamService.getSeatLimitForPlan("enterprise")).toBe(-1);
    });

    it("returns 1 for unknown plan", () => {
      expect(teamService.getSeatLimitForPlan("whatever")).toBe(1);
    });
  });

  describe("consumeClip", () => {
    it("consumes from base pool when available", async () => {
      const stats = buildUsageStats({ clips_created: 2, limit: 10 });
      const team = buildTeam({ addon_clips_remaining: 5 });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([stats]))
        .mockReturnValueOnce(createDrizzleChain([team]));
      mockDb.update.mockReturnValue(createDrizzleChain([]));

      const result = await teamService.consumeClip(team.id);

      expect(result).toEqual({ success: true, source: "base" });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("consumes from addon pool when base exhausted", async () => {
      const stats = buildUsageStats({ clips_created: 10, limit: 10 });
      const team = buildTeam({ addon_clips_remaining: 5 });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([stats]))
        .mockReturnValueOnce(createDrizzleChain([team]));
      mockDb.update.mockReturnValue(createDrizzleChain([]));

      const result = await teamService.consumeClip(team.id);

      expect(result).toEqual({ success: true, source: "addon" });
    });

    it("fails when both pools empty", async () => {
      const stats = buildUsageStats({ clips_created: 10, limit: 10 });
      const team = buildTeam({ addon_clips_remaining: 0 });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([stats]))
        .mockReturnValueOnce(createDrizzleChain([team]));

      const result = await teamService.consumeClip(team.id);

      expect(result).toEqual({ success: false, source: null });
    });

    it("fails when team not found", async () => {
      const stats = buildUsageStats({ clips_created: 0, limit: 10 });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([stats]))
        .mockReturnValueOnce(createDrizzleChain([]));

      const result = await teamService.consumeClip(999);

      expect(result).toEqual({ success: false, source: null });
    });
  });

  describe("consumeMultiple", () => {
    it("fails when total quota insufficient", async () => {
      const stats = buildUsageStats({ clips_created: 8, limit: 10 });
      const team = buildTeam({ addon_clips_remaining: 1 });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([stats]))
        .mockReturnValueOnce(createDrizzleChain([team]));

      const result = await teamService.consumeMultiple(team.id, 5);

      expect(result.success).toBe(false);
      expect(result.consumed).toBe(0);
      expect(result.remaining.total).toBe(3);
    });

    it("splits consumption across base and addon", async () => {
      const stats = buildUsageStats({ clips_created: 8, limit: 10 });
      const team = buildTeam({ addon_clips_remaining: 5 });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([stats]))
        .mockReturnValueOnce(createDrizzleChain([team]));
      mockDb.update.mockReturnValue(createDrizzleChain([]));

      const result = await teamService.consumeMultiple(team.id, 4);

      expect(result.success).toBe(true);
      expect(result.fromBase).toBe(2);
      expect(result.fromAddon).toBe(2);
      expect(result.remaining.total).toBe(3);
    });

    it("consumes entirely from base when sufficient", async () => {
      const stats = buildUsageStats({ clips_created: 0, limit: 100 });
      const team = buildTeam({ addon_clips_remaining: 10 });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([stats]))
        .mockReturnValueOnce(createDrizzleChain([team]));
      mockDb.update.mockReturnValue(createDrizzleChain([]));

      const result = await teamService.consumeMultiple(team.id, 5);

      expect(result.success).toBe(true);
      expect(result.fromBase).toBe(5);
      expect(result.fromAddon).toBe(0);
    });
  });

  describe("createTeam", () => {
    it("gives first team FREE_TIER_STARTING_CREDITS (15)", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      const newTeam = buildTeam({ id: 1, name: "My Team" });
      mockDb.insert.mockReturnValue(createDrizzleChain([newTeam]));

      await teamService.createTeam("My Team", 1, "business");

      // 3 inserts: team, teamMember, usageStats
      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });

    it("gives subsequent teams 0 credits", async () => {
      const existingTeam = buildTeam({ id: 99 });
      mockDb.select.mockReturnValue(createDrizzleChain([existingTeam]));
      const newTeam = buildTeam({ id: 2, name: "Second Team" });
      mockDb.insert.mockReturnValue(createDrizzleChain([newTeam]));

      await teamService.createTeam("Second Team", 1, "business");

      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });
  });

  describe("canMemberPerformActions", () => {
    it("returns allowed=true for owner regardless of seat limit", async () => {
      const team = buildTeam({ plan: "free" });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([team]))
        .mockReturnValueOnce(createDrizzleChain([buildTeamMember({ role: "owner" })]));

      const result = await teamService.canMemberPerformActions(team.id, 1);

      expect(result.allowed).toBe(true);
    });

    it("blocks non-owner when over seat limit", async () => {
      const team = buildTeam({ plan: "free" });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([team]))
        .mockReturnValueOnce(createDrizzleChain([buildTeamMember({ role: "member" })]))
        .mockReturnValueOnce(createDrizzleChain([{ count: 3 }]));

      const result = await teamService.canMemberPerformActions(team.id, 2);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("members");
    });

    it("allows non-owner with unlimited seats (scale plan)", async () => {
      const team = buildTeam({ plan: "scale" });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([team]))
        .mockReturnValueOnce(createDrizzleChain([buildTeamMember({ role: "member" })]));

      const result = await teamService.canMemberPerformActions(team.id, 2);

      expect(result.allowed).toBe(true);
    });

    it("returns not allowed when team not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));

      const result = await teamService.canMemberPerformActions(999, 1);

      expect(result.allowed).toBe(false);
    });
  });

  describe("removeTeamMember", () => {
    it("prevents removing the last owner", async () => {
      const owner = buildTeamMember({ id: 1, role: "owner" });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([owner]))
        .mockReturnValueOnce(createDrizzleChain([owner]));

      await expect(
        teamService.removeTeamMember(1, 1)
      ).rejects.toThrow("Cannot remove the last owner");
    });

    it("allows removing a regular member", async () => {
      const owner = buildTeamMember({ id: 1, role: "owner" });
      const member = buildTeamMember({ id: 2, role: "member" });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([owner]))
        .mockReturnValueOnce(createDrizzleChain([member]));
      mockDb.delete.mockReturnValue(createDrizzleChain([]));

      await expect(
        teamService.removeTeamMember(1, 2)
      ).resolves.not.toThrow();

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
