import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../test/helpers/db.helper";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../db", () => ({ db: mockDb }));

import { userPreferencesService } from "../userPreferences.service";

describe("userPreferencesService.getPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns nulls when no preferences exist", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await userPreferencesService.getPreferences(1);

    expect(result).toEqual({
      dashboardLayout: null,
      widgetColors: null,
    });
  });

  it("returns saved preferences", async () => {
    const layout = [{ i: "widget1", x: 0, y: 0, w: 4, h: 2 }];
    const colors = { widget1: "#ff0000" };
    mockDb.select.mockReturnValue(
      createDrizzleChain([{ dashboard_layout: layout, widget_colors: colors }])
    );

    const result = await userPreferencesService.getPreferences(1);

    expect(result.dashboardLayout).toEqual(layout);
    expect(result.widgetColors).toEqual(colors);
  });
});

describe("userPreferencesService.updatePreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates new preferences when none exist", async () => {
    // First select: check existing -> empty
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const layout = [{ i: "w1", x: 0, y: 0, w: 6, h: 3 }];
    mockDb.insert.mockReturnValue(
      createDrizzleChain([{ dashboard_layout: layout, widget_colors: null }])
    );

    const result = await userPreferencesService.updatePreferences(1, {
      dashboardLayout: layout,
    });

    expect(mockDb.insert).toHaveBeenCalled();
    expect(result.dashboardLayout).toEqual(layout);
  });

  it("updates existing preferences", async () => {
    // First select: check existing -> found
    mockDb.select.mockReturnValue(
      createDrizzleChain([{ id: 1, user_id: 1, dashboard_layout: null, widget_colors: null }])
    );

    const colors = { header: "#00ff00" };
    mockDb.update.mockReturnValue(
      createDrizzleChain([{ dashboard_layout: null, widget_colors: colors }])
    );

    const result = await userPreferencesService.updatePreferences(1, {
      widgetColors: colors,
    });

    expect(mockDb.update).toHaveBeenCalled();
    expect(result.widgetColors).toEqual(colors);
  });
});

describe("userPreferencesService.resetToDefault", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets layout and colors to null", async () => {
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    await userPreferencesService.resetToDefault(1);

    expect(mockDb.update).toHaveBeenCalled();
  });
});
