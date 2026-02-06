import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { Request } from "express";
import type { AdminRequest } from "../../middleware/admin.middleware";

const { mockAnnouncementService, mockEmitNewAnnouncement } = vi.hoisted(() => ({
  mockAnnouncementService: {
    getUnreadAnnouncementsForUser: vi.fn(),
    getAllAnnouncementsForUser: vi.fn(),
    dismissAnnouncement: vi.fn(),
    dismissAllAnnouncements: vi.fn(),
    getAllAnnouncements: vi.fn(),
    getAnnouncementById: vi.fn(),
    createAnnouncement: vi.fn(),
    updateAnnouncement: vi.fn(),
    deleteAnnouncement: vi.fn(),
    publishAnnouncement: vi.fn(),
  },
  mockEmitNewAnnouncement: vi.fn(),
}));

vi.mock("../../services/announcement.service", () => ({
  announcementService: mockAnnouncementService,
}));

vi.mock("../../services/socket.service", () => ({
  emitNewAnnouncement: mockEmitNewAnnouncement,
}));

import {
  getUnreadAnnouncements,
  getAllAnnouncementsForUser,
  dismissAnnouncement,
  dismissAllAnnouncements,
  createAnnouncement,
  publishAnnouncement,
  getAnnouncementById,
  deleteAnnouncement,
} from "../announcement.controller";

function createReq(overrides: Record<string, any> = {}): Request {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as unknown as Request;
}

function createAdminReq(overrides: Record<string, any> = {}): AdminRequest {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as unknown as AdminRequest;
}

describe("getUnreadAnnouncements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq();
    const res = createMockResponse();
    await getUnreadAnnouncements(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns announcements for authenticated user", async () => {
    mockAnnouncementService.getUnreadAnnouncementsForUser.mockResolvedValue([{ id: 1 }]);
    const req = createReq({ user: { dbUserId: 42 } });
    const res = createMockResponse();
    await getUnreadAnnouncements(req, res);
    expect(res.json).toHaveBeenCalledWith({ announcements: [{ id: 1 }] });
  });
});

describe("getAllAnnouncementsForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq();
    const res = createMockResponse();
    await getAllAnnouncementsForUser(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns all announcements", async () => {
    mockAnnouncementService.getAllAnnouncementsForUser.mockResolvedValue([]);
    const req = createReq({ user: { dbUserId: 42 } });
    const res = createMockResponse();
    await getAllAnnouncementsForUser(req, res);
    expect(res.json).toHaveBeenCalledWith({ announcements: [] });
  });
});

describe("dismissAnnouncement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ params: { id: "1" } });
    const res = createMockResponse();
    await dismissAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 for invalid announcement ID", async () => {
    const req = createReq({ user: { dbUserId: 42 }, params: { id: "abc" } });
    const res = createMockResponse();
    await dismissAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns success on valid dismiss", async () => {
    mockAnnouncementService.dismissAnnouncement.mockResolvedValue(undefined);
    const req = createReq({ user: { dbUserId: 42 }, params: { id: "5" } });
    const res = createMockResponse();
    await dismissAnnouncement(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe("dismissAllAnnouncements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq();
    const res = createMockResponse();
    await dismissAllAnnouncements(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns success", async () => {
    mockAnnouncementService.dismissAllAnnouncements.mockResolvedValue(undefined);
    const req = createReq({ user: { dbUserId: 42 } });
    const res = createMockResponse();
    await dismissAllAnnouncements(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe("createAnnouncement (admin)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when title missing", async () => {
    const req = createAdminReq({ body: { content: "body" }, admin: { email: "a@b.com" } });
    const res = createMockResponse();
    await createAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when title too long", async () => {
    const req = createAdminReq({
      body: { title: "x".repeat(256), content: "body" },
      admin: { email: "a@b.com" },
    });
    const res = createMockResponse();
    await createAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when action_label without action_url", async () => {
    const req = createAdminReq({
      body: { title: "T", content: "C", action_label: "Click" },
      admin: { email: "a@b.com" },
    });
    const res = createMockResponse();
    await createAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 when admin email missing", async () => {
    const req = createAdminReq({ body: { title: "T", content: "C" } });
    const res = createMockResponse();
    await createAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 201 on success", async () => {
    mockAnnouncementService.createAnnouncement.mockResolvedValue({ id: 1, title: "T" });
    const req = createAdminReq({
      body: { title: "T", content: "C" },
      admin: { email: "admin@cuttr.com" },
    });
    const res = createMockResponse();
    await createAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("publishAnnouncement (admin)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid ID", async () => {
    const req = createAdminReq({ params: { id: "abc" } });
    const res = createMockResponse();
    await publishAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("emits socket event and returns announcement", async () => {
    const ann = { id: 1, title: "Published" };
    mockAnnouncementService.publishAnnouncement.mockResolvedValue(ann);
    const req = createAdminReq({ params: { id: "1" } });
    const res = createMockResponse();
    await publishAnnouncement(req, res);
    expect(mockEmitNewAnnouncement).toHaveBeenCalledWith(ann);
    expect(res.json).toHaveBeenCalledWith({ announcement: ann });
  });

  it("returns 404 when not found", async () => {
    mockAnnouncementService.publishAnnouncement.mockRejectedValue(new Error("Announcement not found"));
    const req = createAdminReq({ params: { id: "999" } });
    const res = createMockResponse();
    await publishAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("getAnnouncementById (admin)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid ID", async () => {
    const req = createAdminReq({ params: { id: "abc" } });
    const res = createMockResponse();
    await getAnnouncementById(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when not found", async () => {
    mockAnnouncementService.getAnnouncementById.mockRejectedValue(new Error("Announcement not found"));
    const req = createAdminReq({ params: { id: "999" } });
    const res = createMockResponse();
    await getAnnouncementById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("deleteAnnouncement (admin)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success on delete", async () => {
    mockAnnouncementService.deleteAnnouncement.mockResolvedValue(undefined);
    const req = createAdminReq({ params: { id: "1" } });
    const res = createMockResponse();
    await deleteAnnouncement(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
