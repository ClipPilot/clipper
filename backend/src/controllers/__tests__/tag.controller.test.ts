import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { Request } from "express";

const { mockTagService } = vi.hoisted(() => ({
  mockTagService: {
    getTagsByTeam: vi.fn(),
    getTagById: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    getTagsForClip: vi.fn(),
    addTagToClip: vi.fn(),
    removeTagFromClip: vi.fn(),
    setClipTags: vi.fn(),
  },
}));

vi.mock("../../services/tag.service", () => ({
  tagService: mockTagService,
}));

import { tagController } from "../tag.controller";

function createReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as Request;
}

describe("TagController.getTags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "abc" } });
    const res = createMockResponse();
    await tagController.getTags(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with tags", async () => {
    mockTagService.getTagsByTeam.mockResolvedValue([{ id: 1, name: "A" }]);
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await tagController.getTags(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ tags: [{ id: 1, name: "A" }] });
  });
});

describe("TagController.getTag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid IDs", async () => {
    const req = createReq({ params: { tagId: "x", teamId: "5" } });
    const res = createMockResponse();
    await tagController.getTag(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when tag not found", async () => {
    mockTagService.getTagById.mockRejectedValue(new Error("Tag not found"));
    const req = createReq({ params: { tagId: "99", teamId: "5" } });
    const res = createMockResponse();
    await tagController.getTag(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 200 with tag", async () => {
    mockTagService.getTagById.mockResolvedValue({ id: 1, name: "A" });
    const req = createReq({ params: { tagId: "1", teamId: "5" } });
    const res = createMockResponse();
    await tagController.getTag(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("TagController.createTag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when name is empty", async () => {
    const req = createReq({ params: { teamId: "5" }, body: { name: "  " } });
    const res = createMockResponse();
    await tagController.createTag(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 201 on success", async () => {
    mockTagService.createTag.mockResolvedValue({ id: 10, name: "New" });
    const req = createReq({ params: { teamId: "5" }, body: { name: "New" } });
    const res = createMockResponse();
    await tagController.createTag(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("TagController.updateTag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when no fields to update", async () => {
    const req = createReq({ params: { tagId: "1", teamId: "5" }, body: {} });
    const res = createMockResponse();
    await tagController.updateTag(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on success", async () => {
    mockTagService.updateTag.mockResolvedValue({ id: 1, name: "Updated" });
    const req = createReq({ params: { tagId: "1", teamId: "5" }, body: { name: "Updated" } });
    const res = createMockResponse();
    await tagController.updateTag(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("TagController.deleteTag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid IDs", async () => {
    const req = createReq({ params: { tagId: "abc", teamId: "5" } });
    const res = createMockResponse();
    await tagController.deleteTag(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on success", async () => {
    mockTagService.deleteTag.mockResolvedValue({ id: 1 });
    const req = createReq({ params: { tagId: "1", teamId: "5" } });
    const res = createMockResponse();
    await tagController.deleteTag(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("TagController.getClipTags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid clipId", async () => {
    const req = createReq({ params: { clipId: "x" } });
    const res = createMockResponse();
    await tagController.getClipTags(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with clip tags", async () => {
    mockTagService.getTagsForClip.mockResolvedValue([{ id: 1 }]);
    const req = createReq({ params: { clipId: "50" } });
    const res = createMockResponse();
    await tagController.getClipTags(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("TagController.setClipTags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when tagIds is not an array", async () => {
    const req = createReq({ params: { clipId: "50" }, body: { tagIds: "not-array" } });
    const res = createMockResponse();
    await tagController.setClipTags(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on success", async () => {
    mockTagService.setClipTags.mockResolvedValue([{ id: 1 }]);
    const req = createReq({ params: { clipId: "50" }, body: { tagIds: [1, 2] } });
    const res = createMockResponse();
    await tagController.setClipTags(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
