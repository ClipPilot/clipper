import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { AuthRequest } from "../../middleware/auth.middleware";

const { mockPreferencesService } = vi.hoisted(() => ({
  mockPreferencesService: {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    resetToDefault: vi.fn(),
  },
}));

vi.mock("../../services/userPreferences.service", () => ({
  userPreferencesService: mockPreferencesService,
}));

import { userPreferencesController } from "../userPreferences.controller";

function createReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as AuthRequest;
}

describe("UserPreferencesController.getPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with preferences", async () => {
    const prefs = { dashboardLayout: "grid", widgetColors: { primary: "#fff" } };
    mockPreferencesService.getPreferences.mockResolvedValue(prefs);
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 } });
    const res = createMockResponse();
    await userPreferencesController.getPreferences(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(prefs);
  });

  it("returns 500 on error", async () => {
    mockPreferencesService.getPreferences.mockRejectedValue(new Error("DB error"));
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 } });
    const res = createMockResponse();
    await userPreferencesController.getPreferences(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("UserPreferencesController.updatePreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with updated preferences", async () => {
    const updated = { dashboardLayout: "list" };
    mockPreferencesService.updatePreferences.mockResolvedValue(updated);
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      body: { dashboardLayout: "list" },
    });
    const res = createMockResponse();
    await userPreferencesController.updatePreferences(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updated);
  });
});

describe("UserPreferencesController.resetPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with reset message", async () => {
    mockPreferencesService.resetToDefault.mockResolvedValue(undefined);
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 } });
    const res = createMockResponse();
    await userPreferencesController.resetPreferences(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Preferences reset to default" });
  });
});
