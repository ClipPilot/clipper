import { db } from "../db";
import { clipFolders } from "@clipper/shared-db/src/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

interface FolderTreeNode {
  id: number;
  team_id: number;
  parent_folder_id: number | null;
  name: string;
  color: string | null;
  message: string | null;
  created_at: Date;
  updated_at: Date;
  children: FolderTreeNode[];
}

export class FolderService {
  async getFoldersByTeam(teamId: number) {
    return await db
      .select()
      .from(clipFolders)
      .where(eq(clipFolders.team_id, teamId))
      .orderBy(desc(clipFolders.created_at));
  }

  async getFolderById(folderId: number, teamId: number) {
    const [folder] = await db
      .select()
      .from(clipFolders)
      .where(and(eq(clipFolders.id, folderId), eq(clipFolders.team_id, teamId)))
      .limit(1);

    if (!folder) {
      throw new Error("Folder not found");
    }

    return folder;
  }

  async createFolder(data: {
    teamId: number;
    name: string;
    color?: string;
    message?: string;
    parentFolderId?: number | null;
  }) {
    if (data.parentFolderId) {
      const parentExists = await this.getFolderById(data.parentFolderId, data.teamId);
      if (!parentExists) {
        throw new Error("Parent folder not found");
      }
    }

    const [folder] = await db
      .insert(clipFolders)
      .values({
        team_id: data.teamId,
        name: data.name,
        color: data.color,
        message: data.message,
        parent_folder_id: data.parentFolderId || null,
      })
      .returning();

    return folder;
  }

  async updateFolder(folderId: number, teamId: number, updates: {
    name?: string;
    color?: string;
    message?: string;
  }) {
    const [updatedFolder] = await db
      .update(clipFolders)
      .set({
        ...updates,
        updated_at: new Date(),
      })
      .where(and(eq(clipFolders.id, folderId), eq(clipFolders.team_id, teamId)))
      .returning();

    if (!updatedFolder) {
      throw new Error("Folder not found");
    }

    return updatedFolder;
  }

  async deleteFolder(folderId: number, teamId: number) {
    await db
      .update(clipFolders)
      .set({ parent_folder_id: null, updated_at: new Date() })
      .where(and(eq(clipFolders.parent_folder_id, folderId), eq(clipFolders.team_id, teamId)));

    const [deletedFolder] = await db
      .delete(clipFolders)
      .where(and(eq(clipFolders.id, folderId), eq(clipFolders.team_id, teamId)))
      .returning();

    if (!deletedFolder) {
      throw new Error("Folder not found");
    }

    return deletedFolder;
  }

  async getFolderTree(teamId: number): Promise<FolderTreeNode[]> {
    const allFolders = await db
      .select()
      .from(clipFolders)
      .where(eq(clipFolders.team_id, teamId))
      .orderBy(clipFolders.name);

    const folderMap = new Map<number, FolderTreeNode>();
    const rootFolders: FolderTreeNode[] = [];

    allFolders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    allFolders.forEach(folder => {
      const node = folderMap.get(folder.id)!;
      if (folder.parent_folder_id === null) {
        rootFolders.push(node);
      } else {
        const parent = folderMap.get(folder.parent_folder_id);
        if (parent) {
          parent.children.push(node);
        } else {
          rootFolders.push(node);
        }
      }
    });

    return rootFolders;
  }

  async moveFolder(folderId: number, teamId: number, parentFolderId: number | null) {
    const folder = await this.getFolderById(folderId, teamId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (folderId === parentFolderId) {
      throw new Error("Cannot move folder into itself");
    }

    if (parentFolderId !== null) {
      const parentFolder = await this.getFolderById(parentFolderId, teamId);
      if (!parentFolder) {
        throw new Error("Parent folder not found");
      }

      const descendantIds = await this.getDescendantIds(folderId, teamId);
      if (descendantIds.includes(parentFolderId)) {
        throw new Error("Cannot move folder into its descendant");
      }
    }

    const [updatedFolder] = await db
      .update(clipFolders)
      .set({
        parent_folder_id: parentFolderId,
        updated_at: new Date(),
      })
      .where(and(eq(clipFolders.id, folderId), eq(clipFolders.team_id, teamId)))
      .returning();

    return updatedFolder;
  }

  async getDescendantIds(folderId: number, teamId: number): Promise<number[]> {
    const allFolders = await db
      .select()
      .from(clipFolders)
      .where(eq(clipFolders.team_id, teamId));

    const descendants: number[] = [];
    const queue: number[] = [folderId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = allFolders.filter(f => f.parent_folder_id === currentId);
      children.forEach(child => {
        descendants.push(child.id);
        queue.push(child.id);
      });
    }

    return descendants;
  }

  async getFolderPath(folderId: number, teamId: number) {
    const allFolders = await db
      .select()
      .from(clipFolders)
      .where(eq(clipFolders.team_id, teamId));

    const folderMap = new Map(allFolders.map(f => [f.id, f]));
    const path: typeof allFolders = [];
    let currentId: number | null = folderId;

    while (currentId !== null) {
      const folder = folderMap.get(currentId);
      if (!folder) break;
      path.unshift(folder);
      currentId = folder.parent_folder_id;
    }

    if (path.length === 0 || path[path.length - 1].id !== folderId) {
      throw new Error("Folder not found");
    }

    return path;
  }
}

export const folderService = new FolderService();

