import Redis from "ioredis";

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis | null => {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[redis] REDIS_URL not set, distributed locking disabled");
    return null;
  }

  try {
    redisClient = new Redis(redisUrl);
    redisClient.on("error", (err) => {
      console.error("[redis] Connection error:", err.message);
    });
    redisClient.on("connect", () => {
      console.log("[redis] Connected for distributed locking");
    });
    return redisClient;
  } catch (err) {
    console.error("[redis] Failed to create client:", err);
    return null;
  }
};

export const acquireJobLock = async (
  jobId: string,
  ttlSeconds = 900
): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) return true;

  const lockKey = `comfy:job:lock:${jobId}`;
  const result = await client.set(lockKey, "1", "EX", ttlSeconds, "NX");
  return result === "OK";
};

export const extendJobLock = async (
  jobId: string,
  ttlSeconds = 900
): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  const lockKey = `comfy:job:lock:${jobId}`;
  await client.expire(lockKey, ttlSeconds);
};

export const releaseJobLock = async (jobId: string): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  const lockKey = `comfy:job:lock:${jobId}`;
  await client.del(lockKey);
};
