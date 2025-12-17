import { db } from "../db";
import { tags, clipTags, clips } from "@clipper/shared-db/src/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

export class TagService {
  async getTagsByTeam(teamId: number) {
    return await db
      .select()
      .from(tags)
      .where(eq(tags.team_id, teamId))
      .orderBy(desc(tags.created_at));
  }

  async getTagById(tagId: number, teamId: number) {
    const [tag] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.team_id, teamId)))
      .limit(1);

    if (!tag) {
      throw new Error("Tag not found");
    }

    return tag;
  }

  async createTag(data: { teamId: number; name: string; color?: string }) {
    const [tag] = await db
      .insert(tags)
      .values({
        team_id: data.teamId,
        name: data.name,
        color: data.color || "#6366f1",
      })
      .returning();

    return tag;
  }

  async updateTag(
    tagId: number,
    teamId: number,
    updates: { name?: string; color?: string }
  ) {
    const [updatedTag] = await db
      .update(tags)
      .set({
        ...updates,
        updated_at: new Date(),
      })
      .where(and(eq(tags.id, tagId), eq(tags.team_id, teamId)))
      .returning();

    if (!updatedTag) {
      throw new Error("Tag not found");
    }

    return updatedTag;
  }

  async deleteTag(tagId: number, teamId: number) {
    const [deletedTag] = await db
      .delete(tags)
      .where(and(eq(tags.id, tagId), eq(tags.team_id, teamId)))
      .returning();

    if (!deletedTag) {
      throw new Error("Tag not found");
    }

    return deletedTag;
  }

  async getTagsForClip(clipId: number) {
    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        team_id: tags.team_id,
        created_at: tags.created_at,
        updated_at: tags.updated_at,
      })
      .from(clipTags)
      .innerJoin(tags, eq(clipTags.tag_id, tags.id))
      .where(eq(clipTags.clip_id, clipId));

    return result;
  }

  async getTagsForClips(clipIds: number[]) {
    if (clipIds.length === 0) return {};

    const result = await db
      .select({
        clip_id: clipTags.clip_id,
        tag_id: tags.id,
        name: tags.name,
        color: tags.color,
        team_id: tags.team_id,
        created_at: tags.created_at,
        updated_at: tags.updated_at,
      })
      .from(clipTags)
      .innerJoin(tags, eq(clipTags.tag_id, tags.id))
      .where(inArray(clipTags.clip_id, clipIds));

    const tagsByClip: Record<
      number,
      Array<{ id: number; name: string; color: string; team_id: number; created_at: Date; updated_at: Date }>
    > = {};

    for (const row of result) {
      if (!tagsByClip[row.clip_id]) {
        tagsByClip[row.clip_id] = [];
      }
      tagsByClip[row.clip_id].push({
        id: row.tag_id,
        name: row.name,
        color: row.color,
        team_id: row.team_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    return tagsByClip;
  }

  async addTagToClip(clipId: number, tagId: number) {
    const existing = await db
      .select()
      .from(clipTags)
      .where(and(eq(clipTags.clip_id, clipId), eq(clipTags.tag_id, tagId)))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const [clipTag] = await db
      .insert(clipTags)
      .values({
        clip_id: clipId,
        tag_id: tagId,
      })
      .returning();

    return clipTag;
  }

  async removeTagFromClip(clipId: number, tagId: number) {
    const [removed] = await db
      .delete(clipTags)
      .where(and(eq(clipTags.clip_id, clipId), eq(clipTags.tag_id, tagId)))
      .returning();

    return removed;
  }

  async setClipTags(clipId: number, tagIds: number[]) {
    await db.delete(clipTags).where(eq(clipTags.clip_id, clipId));

    if (tagIds.length === 0) {
      return [];
    }

    const values = tagIds.map((tagId) => ({
      clip_id: clipId,
      tag_id: tagId,
    }));

    await db.insert(clipTags).values(values);

    return this.getTagsForClip(clipId);
  }
}

export const tagService = new TagService();
