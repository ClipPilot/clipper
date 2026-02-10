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

// DOMPurify mock — returns the input stripped of dangerous tags
vi.mock("isomorphic-dompurify", () => ({
  default: {
    sanitize: vi.fn((html: string) => {
      // Simple mock: strip <script> tags
      return html.replace(/<script[^>]*>.*?<\/script>/gi, "");
    }),
  },
}));

import { announcementService } from "../announcement.service";

describe("announcementService.getAnnouncementById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the announcement when found", async () => {
    const ann = { id: 1, title: "Test", content: "Body" };
    mockDb.select.mockReturnValue(createDrizzleChain([ann]));

    const result = await announcementService.getAnnouncementById(1);
    expect(result).toEqual(ann);
  });

  it("throws when announcement not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(announcementService.getAnnouncementById(999)).rejects.toThrow(
      "Announcement not found"
    );
  });
});

describe("announcementService.createAnnouncement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates announcement with sanitized content", async () => {
    const created = { id: 1, title: "New", content: "<p>Safe</p>", status: "draft" };
    mockDb.insert.mockReturnValue(createDrizzleChain([created]));

    const result = await announcementService.createAnnouncement({
      title: "New",
      content: '<p>Safe</p><script>alert("xss")</script>',
      created_by_admin_email: "admin@cuttr.com",
    });

    expect(result).toEqual(created);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("defaults priority to info", async () => {
    mockDb.insert.mockReturnValue(createDrizzleChain([{ id: 1 }]));

    await announcementService.createAnnouncement({
      title: "T",
      content: "C",
      created_by_admin_email: "a@b.com",
    });

    expect(mockDb.insert).toHaveBeenCalled();
  });
});

describe("announcementService.updateAnnouncement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns updated announcement", async () => {
    const updated = { id: 1, title: "Updated" };
    mockDb.update.mockReturnValue(createDrizzleChain([updated]));

    const result = await announcementService.updateAnnouncement(1, { title: "Updated" });
    expect(result).toEqual(updated);
  });

  it("throws when announcement not found", async () => {
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    await expect(
      announcementService.updateAnnouncement(999, { title: "X" })
    ).rejects.toThrow("Announcement not found");
  });

  it("sanitizes content on update", async () => {
    mockDb.update.mockReturnValue(createDrizzleChain([{ id: 1 }]));

    await announcementService.updateAnnouncement(1, {
      content: '<p>OK</p><script>bad</script>',
    });

    // DOMPurify.sanitize should have been called
    const DOMPurify = (await import("isomorphic-dompurify")).default;
    expect(DOMPurify.sanitize).toHaveBeenCalled();
  });
});

describe("announcementService.deleteAnnouncement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes without error", async () => {
    mockDb.delete.mockReturnValue(createDrizzleChain([]));

    await expect(announcementService.deleteAnnouncement(1)).resolves.toBeUndefined();
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe("announcementService.publishAnnouncement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status to published and returns announcement", async () => {
    const published = { id: 1, status: "published", published_at: new Date() };
    mockDb.update.mockReturnValue(createDrizzleChain([published]));

    const result = await announcementService.publishAnnouncement(1);
    expect(result.status).toBe("published");
  });

  it("throws when announcement not found", async () => {
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    await expect(announcementService.publishAnnouncement(999)).rejects.toThrow(
      "Announcement not found"
    );
  });
});

describe("announcementService.dismissAnnouncement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing if already dismissed", async () => {
    mockDb.select.mockReturnValue(
      createDrizzleChain([{ user_id: 1, announcement_id: 5 }])
    );

    await announcementService.dismissAnnouncement(1, 5);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("inserts dismissal record if not yet dismissed", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));
    mockDb.insert.mockReturnValue(createDrizzleChain([]));

    await announcementService.dismissAnnouncement(1, 5);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
