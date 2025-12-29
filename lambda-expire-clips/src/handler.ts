import { Handler, Context } from "aws-lambda";
import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@clipper/shared-db";
import { and, eq, lt } from "drizzle-orm";

const EXPIRY_DAYS = 7;
const S3_BUCKET = process.env.S3_BUCKET!;
const DATABASE_URL = process.env.DATABASE_URL!;

const s3Client = new S3Client({});
let pool: Pool | null = null;

const getDb = () => {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return drizzle(pool, { schema });
};

async function transitionToGlacier(bucket: string, key: string): Promise<boolean> {
  if (!key) return false;

  try {
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${key}`,
        Key: key,
        StorageClass: "GLACIER",
      })
    );
    console.log(`Transitioned to Glacier: ${key}`);
    return true;
  } catch (error: any) {
    if (error.name === "NoSuchKey") {
      console.log(`Object not found (skipping): ${key}`);
      return false;
    }
    console.error(`Error transitioning ${key}:`, error);
    return false;
  }
}

async function deleteS3Object(bucket: string, key: string): Promise<boolean> {
  if (!key) return false;

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    console.log(`Deleted: ${key}`);
    return true;
  } catch (error) {
    console.error(`Error deleting ${key}:`, error);
    return false;
  }
}

async function findExpiredClips(db: ReturnType<typeof drizzle>) {
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() - EXPIRY_DAYS);

  return db
    .select({
      id: schema.clips.id,
      clip_path: schema.clips.clip_path,
      blank_video_path: schema.clips.blank_video_path,
      watermarked_clip_path: schema.clips.watermarked_clip_path,
    })
    .from(schema.clips)
    .where(
      and(
        eq(schema.clips.saved, false),
        eq(schema.clips.status, "completed"),
        lt(schema.clips.created_at, expiryThreshold)
      )
    );
}

async function expireClip(
  db: ReturnType<typeof drizzle>,
  clipId: number
): Promise<boolean> {
  try {
    await db
      .update(schema.clips)
      .set({
        status: "expired",
        updated_at: new Date(),
      })
      .where(eq(schema.clips.id, clipId));
    return true;
  } catch (error) {
    console.error(`Error expiring clip ${clipId}:`, error);
    return false;
  }
}

export const handler: Handler = async (event: any, context: Context) => {
  console.log(`Starting clip expiration job at ${new Date().toISOString()}`);
  console.log(`Expiry threshold: ${EXPIRY_DAYS} days`);

  if (!DATABASE_URL) {
    return { statusCode: 500, body: "DATABASE_URL not configured" };
  }

  if (!S3_BUCKET) {
    return { statusCode: 500, body: "S3_BUCKET not configured" };
  }

  const db = getDb();
  let expiredCount = 0;
  let errorCount = 0;

  try {
    const clips = await findExpiredClips(db);

    if (!clips || clips.length === 0) {
      console.log("No expired clips found");
      return {
        statusCode: 200,
        body: JSON.stringify({ expired: 0, errors: 0 }),
      };
    }

    console.log(`Found ${clips.length} clips to expire`);

    for (const clip of clips) {
      const { id, clip_path, blank_video_path, watermarked_clip_path } = clip;

      try {
        await transitionToGlacier(S3_BUCKET, clip_path || "");
        await transitionToGlacier(S3_BUCKET, blank_video_path || "");
        await deleteS3Object(S3_BUCKET, watermarked_clip_path || "");

        if (await expireClip(db, id)) {
          expiredCount++;
          console.log(`Expired clip ${id}`);
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing clip ${id}:`, error);
        errorCount++;
      }
    }
  } catch (error) {
    console.error("Fatal error:", error);
    return { statusCode: 500, body: String(error) };
  } finally {
    if (pool) {
      await pool.end();
      pool = null;
    }
  }

  const result = {
    expired: expiredCount,
    errors: errorCount,
    timestamp: new Date().toISOString(),
  };

  console.log("Completed:", result);

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
};
