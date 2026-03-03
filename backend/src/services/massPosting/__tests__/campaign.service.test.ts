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

const { mockCreateCampaignFolder } = vi.hoisted(() => ({
  mockCreateCampaignFolder: vi.fn(),
}));

const { mockHasSignedMasterAgreement, mockGetSignedMasterAgreement } = vi.hoisted(() => ({
  mockHasSignedMasterAgreement: vi.fn(),
  mockGetSignedMasterAgreement: vi.fn(),
}));

const { mockSendCampaignStarted } = vi.hoisted(() => ({
  mockSendCampaignStarted: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../../db", () => ({ db: mockDb }));

vi.mock("../../google/drive.service", () => ({
  googleDriveService: {
    createTeamFolder: vi.fn(),
    createCampaignFolder: mockCreateCampaignFolder,
  },
}));

vi.mock("../campaignContract.service", () => ({
  campaignContractService: {
    hasSignedMasterAgreement: mockHasSignedMasterAgreement,
    getSignedMasterAgreement: mockGetSignedMasterAgreement,
  },
}));

vi.mock("../../emailNoti.service", () => ({
  emailNotiService: {
    sendCampaignStarted: mockSendCampaignStarted,
    sendMassPostingApproved: vi.fn(),
    sendMassPostingRejected: vi.fn(),
  },
}));

// Mock the sibling services that campaign.service imports
vi.mock("../campaignVideo.service", () => ({
  campaignVideoService: {},
}));

const { mockGetWallet } = vi.hoisted(() => ({
  mockGetWallet: vi.fn(),
}));

vi.mock("../campaignBilling.service", () => ({
  campaignBillingService: {
    getWallet: mockGetWallet,
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  desc: vi.fn((col: any) => col),
  sql: vi.fn(),
  inArray: vi.fn((...args: any[]) => args),
}));

vi.mock("@clipper/shared-db", () => ({
  campaigns: "campaigns",
  campaignVideos: "campaignVideos",
  campaignContracts: "campaignContracts",
  intakeForms: "intakeForms",
  teams: "teams",
  teamMembers: "teamMembers",
  users: "users",
}));

// ── Import service after all mocks ───────────────────────────────────────────

import { campaignService } from "../campaign.service";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makeCampaign = (overrides: Record<string, any> = {}) => ({
  id: 1,
  team_id: 10,
  name: "Acme Campaign",
  status: "pending",
  intake_form_id: 5,
  budget: "5000",
  quoted_cpm: "2.50",
  video_minimum: 3,
  videos_ready: true,
  payment_ready: true,
  contract_ready: true,
  google_drive_folder_id: null,
  started_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeTeam = (overrides: Record<string, any> = {}) => ({
  id: 10,
  name: "Acme Inc",
  ...overrides,
});

const makeForm = (overrides: Record<string, any> = {}) => ({
  id: 5,
  team_id: 10,
  completed: true,
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("CampaignService", () => {
  beforeEach(() => vi.resetAllMocks());

  // ── createCampaign ─────────────────────────────────────────────────────────

  describe("createCampaign", () => {
    const formData = {
      brand_description: "We make widgets",
      company_website_url: "https://acme.com",
    };

    it("creates a campaign when intake form already exists", async () => {
      const existingForm = makeForm();
      const updatedForm = makeForm({ brand_description: "We make widgets" });
      const team = makeTeam();
      const campaign = makeCampaign({ name: "My Campaign" });

      mockDb.select
        // 1. check existing intake form
        .mockReturnValueOnce(createDrizzleChain([existingForm]))
        // 2. fetch team name
        .mockReturnValueOnce(createDrizzleChain([team]));

      mockDb.update
        // update intake form
        .mockReturnValueOnce(createDrizzleChain([updatedForm]));

      mockDb.insert
        // insert campaign
        .mockReturnValueOnce(createDrizzleChain([campaign]));

      const result = await campaignService.createCampaign(10, formData, 5000, "My Campaign");

      expect(result).toEqual(campaign);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it("creates a campaign with a new intake form when none exists", async () => {
      const newForm = makeForm();
      const team = makeTeam();
      const campaign = makeCampaign({ name: "Acme Inc Campaign" });

      mockDb.select
        // 1. no existing intake form
        .mockReturnValueOnce(createDrizzleChain([]))
        // 2. fetch team name
        .mockReturnValueOnce(createDrizzleChain([team]));

      mockDb.insert
        // insert intake form
        .mockReturnValueOnce(createDrizzleChain([newForm]))
        // insert campaign
        .mockReturnValueOnce(createDrizzleChain([campaign]));

      const result = await campaignService.createCampaign(10, formData, 5000);

      expect(result).toEqual(campaign);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it("defaults campaign name to 'Team Campaign' when team has no name", async () => {
      const newForm = makeForm();
      const campaign = makeCampaign({ name: "Team Campaign" });

      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([]))
        // team with no name (empty result)
        .mockReturnValueOnce(createDrizzleChain([]));

      mockDb.insert
        .mockReturnValueOnce(createDrizzleChain([newForm]))
        .mockReturnValueOnce(createDrizzleChain([campaign]));

      const result = await campaignService.createCampaign(10, formData);

      expect(result.name).toBe("Team Campaign");
    });

    it("uses team name in default campaign name when no explicit name given", async () => {
      const newForm = makeForm();
      const team = makeTeam({ name: "Globex Corp" });
      const campaign = makeCampaign({ name: "Globex Corp Campaign" });

      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([]))
        .mockReturnValueOnce(createDrizzleChain([team]));

      mockDb.insert
        .mockReturnValueOnce(createDrizzleChain([newForm]))
        .mockReturnValueOnce(createDrizzleChain([campaign]));

      const result = await campaignService.createCampaign(10, formData);

      expect(result.name).toBe("Globex Corp Campaign");
    });
  });

  // ── getCampaignsForTeam ────────────────────────────────────────────────────

  describe("getCampaignsForTeam", () => {
    it("returns campaigns with pagination metadata", async () => {
      const rows = [makeCampaign({ id: 1 }), makeCampaign({ id: 2 })];
      const countRow = [{ count: 2 }];

      // Promise.all fires two selects concurrently; mockReturnValueOnce handles order
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain(rows))
        .mockReturnValueOnce(createDrizzleChain(countRow));

      const result = await campaignService.getCampaignsForTeam(10);

      expect(result.campaigns).toEqual(rows);
      expect(result.total).toBe(2);
      expect(result.pagination.hasMore).toBe(false);
    });

    it("returns empty list when team has no campaigns", async () => {
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([]))
        .mockReturnValueOnce(createDrizzleChain([{ count: 0 }]));

      const result = await campaignService.getCampaignsForTeam(99);

      expect(result.campaigns).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("calculates hasMore correctly when there are more pages", async () => {
      const rows = [makeCampaign()];

      mockDb.select
        .mockReturnValueOnce(createDrizzleChain(rows))
        .mockReturnValueOnce(createDrizzleChain([{ count: 50 }]));

      const result = await campaignService.getCampaignsForTeam(10, { limit: 10, offset: 0 });

      expect(result.pagination.hasMore).toBe(true);
    });
  });

  // ── getCampaignById ────────────────────────────────────────────────────────

  describe("getCampaignById", () => {
    it("returns campaign when found", async () => {
      const campaign = makeCampaign();
      mockDb.select.mockReturnValueOnce(createDrizzleChain([campaign]));

      const result = await campaignService.getCampaignById(1);

      expect(result).toEqual(campaign);
    });

    it("returns null when campaign not found", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      const result = await campaignService.getCampaignById(999);

      expect(result).toBeNull();
    });
  });

  // ── getCampaignForTeamById ─────────────────────────────────────────────────

  describe("getCampaignForTeamById", () => {
    it("returns campaign when it belongs to the team", async () => {
      const campaign = makeCampaign();
      mockDb.select.mockReturnValueOnce(createDrizzleChain([campaign]));

      const result = await campaignService.getCampaignForTeamById(10, 1);

      expect(result).toEqual(campaign);
    });

    it("returns null when campaign belongs to a different team", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      const result = await campaignService.getCampaignForTeamById(99, 1);

      expect(result).toBeNull();
    });
  });

  // ── approveCampaign ────────────────────────────────────────────────────────

  describe("approveCampaign", () => {
    it("updates status, creates Drive folder, and auto-marks contract_ready if master signed", async () => {
      const campaign = makeCampaign({ status: "pending" });
      const updated = makeCampaign({ status: "accepted", quoted_cpm: "3.00", video_minimum: 5 });
      const team = makeTeam();
      const owner = { email: "owner@acme.com", firstName: "Alice" };

      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([campaign])) // fetch campaign
        .mockReturnValueOnce(createDrizzleChain([team]))     // fetch team for folder
        .mockReturnValueOnce(createDrizzleChain([owner]));   // fetch owner for email

      mockCreateCampaignFolder.mockResolvedValueOnce("folder-123");
      mockDb.update.mockReturnValue(createDrizzleChain([updated]));
      mockHasSignedMasterAgreement.mockResolvedValueOnce(true);

      const result = await campaignService.approveCampaign(1, "3.00", 5);

      expect(result).toEqual(updated);
      expect(mockCreateCampaignFolder).toHaveBeenCalledWith("Acme Inc", 10, 1, "Acme Campaign");
      expect(mockHasSignedMasterAgreement).toHaveBeenCalledWith(10);
    });

    it("does not mark contract_ready when master agreement not signed", async () => {
      const campaign = makeCampaign({ status: "pending" });
      const updated = makeCampaign({ status: "accepted" });
      const team = makeTeam();
      const owner = { email: "owner@acme.com", firstName: "Alice" };

      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([campaign]))
        .mockReturnValueOnce(createDrizzleChain([team]))
        .mockReturnValueOnce(createDrizzleChain([owner]));

      mockCreateCampaignFolder.mockResolvedValueOnce("folder-456");
      mockDb.update.mockReturnValue(createDrizzleChain([updated]));
      mockHasSignedMasterAgreement.mockResolvedValueOnce(false);

      const result = await campaignService.approveCampaign(1, "3.00", 5);

      expect(result).toEqual(updated);
      // Only one update call (campaigns table), not two
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it("throws when campaign not found", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      await expect(campaignService.approveCampaign(999, "3.00", 5)).rejects.toThrow(
        "Campaign not found",
      );
    });
  });

  // ── rejectCampaign ─────────────────────────────────────────────────────────

  describe("rejectCampaign", () => {
    it("updates status to rejected with the given reason", async () => {
      const campaign = makeCampaign({ status: "pending" });
      const updated = makeCampaign({ status: "rejected", rejection_reason: "Low budget" });
      const team = makeTeam();
      const owner = { email: "owner@acme.com", firstName: "Alice" };

      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([campaign]))
        .mockReturnValueOnce(createDrizzleChain([team]))
        .mockReturnValueOnce(createDrizzleChain([owner]));

      mockDb.update.mockReturnValueOnce(createDrizzleChain([updated]));

      const result = await campaignService.rejectCampaign(1, "Low budget");

      expect(result).toEqual(updated);
    });

    it("throws when campaign not found", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      await expect(campaignService.rejectCampaign(999, "Low budget")).rejects.toThrow(
        "Campaign not found",
      );
    });
  });

  // ── checkGates ─────────────────────────────────────────────────────────────

  describe("checkGates", () => {
    it("returns all gates ready with metadata when master agreement is signed", async () => {
      const campaign = makeCampaign({
        videos_ready: true,
        payment_ready: true,
        contract_ready: true,
        budget: "25000",
        video_minimum: 5,
      });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([campaign]))
        .mockReturnValueOnce(createDrizzleChain([{ count: 7 }]));

      mockGetWallet.mockResolvedValueOnce({ balance_cents: 250000 });
      mockGetSignedMasterAgreement.mockResolvedValueOnce({
        signed_at: "2026-01-01T00:00:00.000Z",
      });

      const result = await campaignService.checkGates(1);

      expect(result.videos.complete).toBe(true);
      expect(result.videos.videoCount).toBe(7);
      expect(result.videos.videoMinimum).toBe(5);
      expect(result.payment.complete).toBe(true);
      expect(result.payment.balanceCents).toBe(250000);
      expect(result.contract.complete).toBe(true);
      expect(result.contract.signedAt).toBeTruthy();
    });

    it("returns partial gates when master agreement is not signed", async () => {
      const campaign = makeCampaign({
        videos_ready: true,
        payment_ready: false,
        contract_ready: false,
        video_minimum: 3,
      });
      mockDb.select
        .mockReturnValueOnce(createDrizzleChain([campaign]))
        .mockReturnValueOnce(createDrizzleChain([{ count: 4 }]));

      mockGetWallet.mockResolvedValueOnce(null);
      mockGetSignedMasterAgreement.mockResolvedValueOnce(null);

      const result = await campaignService.checkGates(1);

      expect(result.videos.complete).toBe(true);
      expect(result.payment.complete).toBe(false);
      expect(result.payment.balanceCents).toBe(0);
      expect(result.contract.complete).toBe(false);
      expect(result.contract.signedAt).toBeNull();
    });

    it("throws when campaign not found", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      await expect(campaignService.checkGates(999)).rejects.toThrow("Campaign not found");
    });
  });

  // ── startCampaign ──────────────────────────────────────────────────────────

  describe("startCampaign", () => {
    it("starts campaign when all gates are ready", async () => {
      const campaign = makeCampaign({
        status: "accepted",
        videos_ready: true,
        payment_ready: true,
        contract_ready: true,
      });
      const started = makeCampaign({ status: "started" });

      mockDb.select.mockReturnValueOnce(createDrizzleChain([campaign]));
      mockDb.update.mockReturnValueOnce(createDrizzleChain([started]));

      const result = await campaignService.startCampaign(10, 1);

      expect(result).toEqual(started);
    });

    it("throws when one or more gates are not ready", async () => {
      const campaign = makeCampaign({
        status: "accepted",
        videos_ready: true,
        payment_ready: false,
        contract_ready: true,
      });
      mockDb.select.mockReturnValueOnce(createDrizzleChain([campaign]));

      await expect(campaignService.startCampaign(10, 1)).rejects.toThrow(
        "All gates must be completed before starting the campaign",
      );
    });

    it("throws when campaign status is not accepted", async () => {
      const campaign = makeCampaign({
        status: "pending",
        videos_ready: true,
        payment_ready: true,
        contract_ready: true,
      });
      mockDb.select.mockReturnValueOnce(createDrizzleChain([campaign]));

      await expect(campaignService.startCampaign(10, 1)).rejects.toThrow(
        "Campaign must be accepted before starting",
      );
    });

    it("throws when campaign not found", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      await expect(campaignService.startCampaign(10, 999)).rejects.toThrow("Campaign not found");
    });
  });

  // ── pauseCampaign ──────────────────────────────────────────────────────────

  describe("pauseCampaign", () => {
    it("pauses a started campaign", async () => {
      const campaign = makeCampaign({ status: "started" });
      const paused = makeCampaign({ status: "paused" });

      mockDb.select.mockReturnValueOnce(createDrizzleChain([campaign]));
      mockDb.update.mockReturnValueOnce(createDrizzleChain([paused]));

      const result = await campaignService.pauseCampaign(1);

      expect(result).toEqual(paused);
    });

    it("throws when campaign is not in started status", async () => {
      const campaign = makeCampaign({ status: "accepted" });
      mockDb.select.mockReturnValueOnce(createDrizzleChain([campaign]));

      await expect(campaignService.pauseCampaign(1)).rejects.toThrow(
        "Can only pause a started campaign",
      );
    });

    it("throws when campaign not found", async () => {
      mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

      await expect(campaignService.pauseCampaign(999)).rejects.toThrow("Campaign not found");
    });
  });
});
