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

import { FolderService } from "../folder.service";

const folderService = new FolderService();

function buildFolder(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    team_id: 100,
    parent_folder_id: null,
    name: "Test Folder",
    color: null,
    message: null,
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("FolderService.getFolderById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the folder when found", async () => {
    const folder = buildFolder({ id: 5 });
    mockDb.select.mockReturnValue(createDrizzleChain([folder]));

    const result = await folderService.getFolderById(5, 100);
    expect(result).toEqual(folder);
  });

  it("throws when folder not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(folderService.getFolderById(999, 100)).rejects.toThrow(
      "Folder not found"
    );
  });
});

describe("FolderService.createFolder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a root folder", async () => {
    const created = buildFolder({ id: 10, name: "New Folder" });
    mockDb.insert.mockReturnValue(createDrizzleChain([created]));

    const result = await folderService.createFolder({
      teamId: 100,
      name: "New Folder",
    });

    expect(result).toEqual(created);
  });

  it("validates parent folder exists before creating subfolder", async () => {
    // getFolderById for parent returns a folder
    const parent = buildFolder({ id: 3 });
    mockDb.select.mockReturnValue(createDrizzleChain([parent]));

    const created = buildFolder({ id: 11, parent_folder_id: 3 });
    mockDb.insert.mockReturnValue(createDrizzleChain([created]));

    const result = await folderService.createFolder({
      teamId: 100,
      name: "Subfolder",
      parentFolderId: 3,
    });

    expect(result.parent_folder_id).toBe(3);
  });

  it("throws when parent folder doesn't exist", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(
      folderService.createFolder({
        teamId: 100,
        name: "Orphan",
        parentFolderId: 999,
      })
    ).rejects.toThrow("Folder not found");
  });
});

describe("FolderService.updateFolder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the updated folder", async () => {
    const updated = buildFolder({ id: 5, name: "Renamed" });
    mockDb.update.mockReturnValue(createDrizzleChain([updated]));

    const result = await folderService.updateFolder(5, 100, { name: "Renamed" });
    expect(result.name).toBe("Renamed");
  });

  it("throws when folder not found", async () => {
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    await expect(
      folderService.updateFolder(999, 100, { name: "X" })
    ).rejects.toThrow("Folder not found");
  });
});

describe("FolderService.deleteFolder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("orphans children then deletes the folder", async () => {
    const deleted = buildFolder({ id: 5 });
    // First call: update children's parent to null
    mockDb.update.mockReturnValue(createDrizzleChain([]));
    // Second call: delete the folder
    mockDb.delete.mockReturnValue(createDrizzleChain([deleted]));

    const result = await folderService.deleteFolder(5, 100);

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.delete).toHaveBeenCalled();
    expect(result).toEqual(deleted);
  });

  it("throws when folder to delete not found", async () => {
    mockDb.update.mockReturnValue(createDrizzleChain([]));
    mockDb.delete.mockReturnValue(createDrizzleChain([]));

    await expect(folderService.deleteFolder(999, 100)).rejects.toThrow(
      "Folder not found"
    );
  });
});

describe("FolderService.getFolderTree", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds a tree from flat folder list", async () => {
    // Hierarchy:  Root(1) -> Child A(2) -> Grandchild(4)
    //             Root(1) -> Child B(3)
    //             Orphan(5) has parent_folder_id=999 (doesn't exist) → promoted to root
    const folders = [
      buildFolder({ id: 1, name: "Root", parent_folder_id: null }),
      buildFolder({ id: 2, name: "Child A", parent_folder_id: 1 }),
      buildFolder({ id: 3, name: "Child B", parent_folder_id: 1 }),
      buildFolder({ id: 4, name: "Grandchild", parent_folder_id: 2 }),
      buildFolder({ id: 5, name: "Orphan", parent_folder_id: 999 }),
    ];
    mockDb.select.mockReturnValue(createDrizzleChain(folders));

    const tree = await folderService.getFolderTree(100);

    // Two root-level nodes: Root and Orphan (promoted because parent 999 missing)
    expect(tree).toHaveLength(2);

    const root = tree.find((n) => n.name === "Root")!;
    const orphan = tree.find((n) => n.name === "Orphan")!;
    expect(root).toBeDefined();
    expect(orphan).toBeDefined();
    expect(orphan.children).toHaveLength(0);

    // Root has two children
    expect(root.children).toHaveLength(2);
    const childA = root.children.find((n) => n.name === "Child A")!;
    const childB = root.children.find((n) => n.name === "Child B")!;
    expect(childA).toBeDefined();
    expect(childB).toBeDefined();

    // Child A has one grandchild, Child B has none
    expect(childA.children).toHaveLength(1);
    expect(childA.children[0].name).toBe("Grandchild");
    expect(childA.children[0].children).toHaveLength(0);
    expect(childB.children).toHaveLength(0);
  });

  it("returns empty array when no folders exist", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const tree = await folderService.getFolderTree(100);

    expect(tree).toEqual([]);
  });
});

describe("FolderService.getDescendantIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all descendant folder IDs via BFS", async () => {
    // Tree: 1 -> 2 -> 4, 1 -> 3
    const folders = [
      buildFolder({ id: 1, parent_folder_id: null }),
      buildFolder({ id: 2, parent_folder_id: 1 }),
      buildFolder({ id: 3, parent_folder_id: 1 }),
      buildFolder({ id: 4, parent_folder_id: 2 }),
    ];
    mockDb.select.mockReturnValue(createDrizzleChain(folders));

    const result = await folderService.getDescendantIds(1, 100);

    expect(result).toContain(2);
    expect(result).toContain(3);
    expect(result).toContain(4);
    expect(result).toHaveLength(3);
  });

  it("returns empty array for leaf folder", async () => {
    const folders = [
      buildFolder({ id: 1, parent_folder_id: null }),
      buildFolder({ id: 2, parent_folder_id: 1 }),
    ];
    mockDb.select.mockReturnValue(createDrizzleChain(folders));

    const result = await folderService.getDescendantIds(2, 100);

    expect(result).toEqual([]);
  });
});

describe("FolderService.moveFolder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when moving folder into itself", async () => {
    const folder = buildFolder({ id: 5 });
    mockDb.select.mockReturnValue(createDrizzleChain([folder]));

    await expect(folderService.moveFolder(5, 100, 5)).rejects.toThrow(
      "Cannot move folder into itself"
    );
  });

  it("throws when moving folder into its own descendant", async () => {
    // Tree: 1 -> 2 -> 3
    // Trying to move 1 into 3 (circular)
    const allFolders = [
      buildFolder({ id: 1, parent_folder_id: null }),
      buildFolder({ id: 2, parent_folder_id: 1 }),
      buildFolder({ id: 3, parent_folder_id: 2 }),
    ];

    // First select: getFolderById(1, 100) returns folder 1
    // Second select: getFolderById(3, 100) returns folder 3 (parent check)
    // Third select: getDescendantIds(1, 100) returns all folders
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([allFolders[0]])) // folder exists
      .mockReturnValueOnce(createDrizzleChain([allFolders[2]])) // parent exists
      .mockReturnValueOnce(createDrizzleChain(allFolders));      // all folders for BFS

    await expect(folderService.moveFolder(1, 100, 3)).rejects.toThrow(
      "Cannot move folder into its descendant"
    );
  });

  it("moves folder to root successfully", async () => {
    const folder = buildFolder({ id: 2, parent_folder_id: 1 });
    const moved = buildFolder({ id: 2, parent_folder_id: null });

    mockDb.select.mockReturnValue(createDrizzleChain([folder]));
    mockDb.update.mockReturnValue(createDrizzleChain([moved]));

    const result = await folderService.moveFolder(2, 100, null);

    expect(result.parent_folder_id).toBeNull();
  });
});

describe("FolderService.getFolderPath", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the path from root to target folder", async () => {
    // Tree: Root(1) -> Mid(2) -> Leaf(3)
    const folders = [
      buildFolder({ id: 1, name: "Root", parent_folder_id: null }),
      buildFolder({ id: 2, name: "Mid", parent_folder_id: 1 }),
      buildFolder({ id: 3, name: "Leaf", parent_folder_id: 2 }),
    ];
    mockDb.select.mockReturnValue(createDrizzleChain(folders));

    const result = await folderService.getFolderPath(3, 100);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Root");
    expect(result[1].name).toBe("Mid");
    expect(result[2].name).toBe("Leaf");
  });

  it("returns single-element path for root folder", async () => {
    const folders = [buildFolder({ id: 1, name: "Root", parent_folder_id: null })];
    mockDb.select.mockReturnValue(createDrizzleChain(folders));

    const result = await folderService.getFolderPath(1, 100);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Root");
  });

  it("throws when folder not found in team", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(folderService.getFolderPath(999, 100)).rejects.toThrow(
      "Folder not found"
    );
  });
});
