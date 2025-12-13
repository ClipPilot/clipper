import { db } from "../db";
import { clipFolders } from "@clipper/shared-db/src/schema";
import { eq, and, desc } from "drizzle-orm";

export class FolderService {
  // Get all folders for a team
  async getFoldersByTeam(teamId: number) {
    return await db
      .select()
      .from(clipFolders)
      .where(eq(clipFolders.team_id, teamId))
      .orderBy(desc(clipFolders.created_at));
  }

  // Get a single folder by ID
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

  // Create a new folder
  async createFolder(data: {
    teamId: number;
    name: string;
    color?: string;
    message?: string;
  }) {
    const [folder] = await db
      .insert(clipFolders)
      .values({
        team_id: data.teamId,
        name: data.name,
        color: data.color,
        message: data.message,
      })
      .returning();

    return folder;
  }

  // Update a folder
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

  // Delete a folder
  async deleteFolder(folderId: number, teamId: number) {
    const [deletedFolder] = await db
      .delete(clipFolders)
      .where(and(eq(clipFolders.id, folderId), eq(clipFolders.team_id, teamId)))
      .returning();

    if (!deletedFolder) {
      throw new Error("Folder not found");
    }

    return deletedFolder;
  }
}

export const folderService = new FolderService();

