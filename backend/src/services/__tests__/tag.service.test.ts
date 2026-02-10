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

import { TagService } from "../tag.service";

const tagService = new TagService();

const now = new Date("2024-06-01");

function buildTag(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    team_id: 100,
    name: "Design",
    color: "#6366f1",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("TagService.getTagsByTeam", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all tags for a team", async () => {
    const tags = [buildTag({ id: 1 }), buildTag({ id: 2, name: "Dev" })];
    mockDb.select.mockReturnValue(createDrizzleChain(tags));

    const result = await tagService.getTagsByTeam(100);
    expect(result).toEqual(tags);
  });

  it("returns empty array when no tags", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await tagService.getTagsByTeam(100);
    expect(result).toEqual([]);
  });
});

describe("TagService.getTagById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the tag when found", async () => {
    const tag = buildTag({ id: 5 });
    mockDb.select.mockReturnValue(createDrizzleChain([tag]));

    const result = await tagService.getTagById(5, 100);
    expect(result).toEqual(tag);
  });

  it("throws when tag not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(tagService.getTagById(999, 100)).rejects.toThrow("Tag not found");
  });
});

describe("TagService.createTag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a tag with default color", async () => {
    const created = buildTag({ id: 10, name: "Marketing" });
    mockDb.insert.mockReturnValue(createDrizzleChain([created]));

    const result = await tagService.createTag({ teamId: 100, name: "Marketing" });
    expect(result).toEqual(created);
  });

  it("creates a tag with custom color", async () => {
    const created = buildTag({ id: 11, name: "Sales", color: "#ff0000" });
    mockDb.insert.mockReturnValue(createDrizzleChain([created]));

    const result = await tagService.createTag({
      teamId: 100,
      name: "Sales",
      color: "#ff0000",
    });
    expect(result.color).toBe("#ff0000");
  });
});

describe("TagService.updateTag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the updated tag", async () => {
    const updated = buildTag({ id: 5, name: "Renamed" });
    mockDb.update.mockReturnValue(createDrizzleChain([updated]));

    const result = await tagService.updateTag(5, 100, { name: "Renamed" });
    expect(result.name).toBe("Renamed");
  });

  it("throws when tag not found", async () => {
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    await expect(tagService.updateTag(999, 100, { name: "X" })).rejects.toThrow(
      "Tag not found"
    );
  });
});

describe("TagService.deleteTag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the deleted tag", async () => {
    const deleted = buildTag({ id: 5 });
    mockDb.delete.mockReturnValue(createDrizzleChain([deleted]));

    const result = await tagService.deleteTag(5, 100);
    expect(result).toEqual(deleted);
  });

  it("throws when tag not found", async () => {
    mockDb.delete.mockReturnValue(createDrizzleChain([]));

    await expect(tagService.deleteTag(999, 100)).rejects.toThrow("Tag not found");
  });
});

describe("TagService.getTagsForClip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns tags associated with a clip", async () => {
    const clipTags = [
      { id: 1, name: "Design", color: "#6366f1", team_id: 100, created_at: now, updated_at: now },
      { id: 2, name: "Draft", color: "#ff0000", team_id: 100, created_at: now, updated_at: now },
    ];
    mockDb.select.mockReturnValue(createDrizzleChain(clipTags));

    const result = await tagService.getTagsForClip(50);
    expect(result).toHaveLength(2);
  });
});

describe("TagService.getTagsForClips", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty object for empty clipIds array", async () => {
    const result = await tagService.getTagsForClips([]);
    expect(result).toEqual({});
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("groups tags by clip_id", async () => {
    const rows = [
      { clip_id: 1, tag_id: 10, name: "A", color: "#aaa", team_id: 100, created_at: now, updated_at: now },
      { clip_id: 1, tag_id: 11, name: "B", color: "#bbb", team_id: 100, created_at: now, updated_at: now },
      { clip_id: 2, tag_id: 10, name: "A", color: "#aaa", team_id: 100, created_at: now, updated_at: now },
    ];
    mockDb.select.mockReturnValue(createDrizzleChain(rows));

    const result = await tagService.getTagsForClips([1, 2]);

    expect(result[1]).toHaveLength(2);
    expect(result[2]).toHaveLength(1);
  });
});

describe("TagService.addTagToClip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing association if already tagged", async () => {
    const existing = { id: 1, clip_id: 50, tag_id: 10 };
    mockDb.select.mockReturnValue(createDrizzleChain([existing]));

    const result = await tagService.addTagToClip(50, 10);

    expect(result).toEqual(existing);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("creates new association if not already tagged", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));
    const created = { id: 5, clip_id: 50, tag_id: 10 };
    mockDb.insert.mockReturnValue(createDrizzleChain([created]));

    const result = await tagService.addTagToClip(50, 10);

    expect(result).toEqual(created);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});

describe("TagService.removeTagFromClip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the removed association", async () => {
    const removed = { id: 5, clip_id: 50, tag_id: 10 };
    mockDb.delete.mockReturnValue(createDrizzleChain([removed]));

    const result = await tagService.removeTagFromClip(50, 10);
    expect(result).toEqual(removed);
  });
});

describe("TagService.setClipTags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears all tags when tagIds is empty", async () => {
    mockDb.delete.mockReturnValue(createDrizzleChain([]));

    const result = await tagService.setClipTags(50, []);

    expect(mockDb.delete).toHaveBeenCalled();
    expect(result).toEqual([]);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("replaces tags: deletes existing then inserts new", async () => {
    mockDb.delete.mockReturnValue(createDrizzleChain([]));
    mockDb.insert.mockReturnValue(createDrizzleChain([]));
    // getTagsForClip is called at the end
    const newTags = [buildTag({ id: 10 }), buildTag({ id: 11 })];
    mockDb.select.mockReturnValue(createDrizzleChain(newTags));

    const result = await tagService.setClipTags(50, [10, 11]);

    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });
});
