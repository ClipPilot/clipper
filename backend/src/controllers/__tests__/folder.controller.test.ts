import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { Request } from "express";

const { mockFolderService, mockTeamService } = vi.hoisted(() => ({
  mockFolderService: {
    getFoldersByTeam: vi.fn(),
    getFolderById: vi.fn(),
    getFolderTree: vi.fn(),
    getFolderPath: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    moveFolder: vi.fn(),
    deleteFolder: vi.fn(),
  },
  mockTeamService: {
    getTeamById: vi.fn(),
  },
}));

vi.mock("../../services/folder.service", () => ({
  folderService: mockFolderService,
}));

vi.mock("../../services/team.service", () => ({
  teamService: mockTeamService,
}));

import { folderController } from "../folder.controller";

function createReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as Request;
}

describe("FolderController.getFolders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "abc" } });
    const res = createMockResponse();
    await folderController.getFolders(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with folders", async () => {
    mockFolderService.getFoldersByTeam.mockResolvedValue([{ id: 1, name: "F" }]);
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await folderController.getFolders(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("FolderController.getFolder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid IDs", async () => {
    const req = createReq({ params: { folderId: "x", teamId: "5" } });
    const res = createMockResponse();
    await folderController.getFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with folder", async () => {
    mockFolderService.getFolderById.mockResolvedValue({ id: 1 });
    const req = createReq({ params: { folderId: "1", teamId: "5" } });
    const res = createMockResponse();
    await folderController.getFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("FolderController.createFolder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-scale/enterprise plans", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 5, plan: "free" });
    const req = createReq({ params: { teamId: "5" }, body: { name: "New" } });
    const res = createMockResponse();
    await folderController.createFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 400 when name is empty", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 5, plan: "scale" });
    const req = createReq({ params: { teamId: "5" }, body: { name: "" } });
    const res = createMockResponse();
    await folderController.createFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 201 on success with scale plan", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 5, plan: "scale" });
    mockFolderService.createFolder.mockResolvedValue({ id: 10, name: "New" });
    const req = createReq({ params: { teamId: "5" }, body: { name: "New" } });
    const res = createMockResponse();
    await folderController.createFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("allows enterprise plan", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 5, plan: "enterprise" });
    mockFolderService.createFolder.mockResolvedValue({ id: 10, name: "New" });
    const req = createReq({ params: { teamId: "5" }, body: { name: "New" } });
    const res = createMockResponse();
    await folderController.createFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("FolderController.moveFolder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for studio plan", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 5, plan: "studio" });
    const req = createReq({ params: { folderId: "1", teamId: "5" }, body: { parentFolderId: null } });
    const res = createMockResponse();
    await folderController.moveFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 400 for invalid parent folder ID", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 5, plan: "scale" });
    const req = createReq({ params: { folderId: "1", teamId: "5" }, body: { parentFolderId: "abc" } });
    const res = createMockResponse();
    await folderController.moveFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when trying to move into descendant", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 5, plan: "scale" });
    mockFolderService.moveFolder.mockRejectedValue(new Error("Cannot move folder into its descendant"));
    const req = createReq({ params: { folderId: "1", teamId: "5" }, body: { parentFolderId: "3" } });
    const res = createMockResponse();
    await folderController.moveFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on successful move", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 5, plan: "scale" });
    mockFolderService.moveFolder.mockResolvedValue({ id: 1, parent_folder_id: null });
    const req = createReq({ params: { folderId: "1", teamId: "5" }, body: { parentFolderId: null } });
    const res = createMockResponse();
    await folderController.moveFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("FolderController.deleteFolder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for free plan", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 5, plan: "free" });
    const req = createReq({ params: { folderId: "1", teamId: "5" } });
    const res = createMockResponse();
    await folderController.deleteFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 200 on successful delete", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 5, plan: "scale" });
    mockFolderService.deleteFolder.mockResolvedValue({ id: 1 });
    const req = createReq({ params: { folderId: "1", teamId: "5" } });
    const res = createMockResponse();
    await folderController.deleteFolder(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
