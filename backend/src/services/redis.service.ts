import * as Sentry from "@sentry/node";
import Redis, { RedisOptions } from "ioredis";

let commandsClient: Redis | null = null;
let subscriberClient: Redis | null = null;
const disabledRoles = new Set<string>();

const buildOptions = (): RedisOptions => ({
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  enableReadyCheck: true,
  connectTimeout: 10_000,
  keepAlive: 30_000,
  retryStrategy: (times) => Math.min(times * 100, 3_000),
  reconnectOnError: (err) => /READONLY|ETIMEDOUT/.test(err.message),
});

const createClient = (role: string): Redis | null => {
  if (disabledRoles.has(role)) return null;

  const url = process.env.REDIS_URL;
  if (!url) {
    disabledRoles.add(role);
    if (role === "commands") {
      console.log("[redis] REDIS_URL not set, cache/locking disabled");
    }
    return null;
  }

  try {
    const client = new Redis(url, buildOptions());
    client.on("error", (err) => {
      console.error(`[redis:${role}] ${err.message}`);
    });
    client.on("connect", () => {
      console.log(`[redis:${role}] connected`);
    });
    return client;
  } catch (err) {
    console.error(`[redis:${role}] failed to create client:`, err);
    Sentry.captureException(err);
    return null;
  }
};

export const getRedisClient = (): Redis | null => {
  if (!commandsClient) commandsClient = createClient("commands");
  return commandsClient;
};

export const getRedisSubscriber = (): Redis | null => {
  if (!subscriberClient) subscriberClient = createClient("subscriber");
  return subscriberClient;
};

export const closeRedis = async () => {
  await Promise.allSettled([
    commandsClient?.quit(),
    subscriberClient?.quit(),
  ]);
  commandsClient = null;
  subscriberClient = null;
  disabledRoles.clear();
};

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const v = await client.get(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch (err) {
    console.warn(`[redis] cacheGet failed for ${key}:`, (err as Error).message);
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.warn(`[redis] cacheSet failed for ${key}:`, (err as Error).message);
  }
};

export const cacheDel = async (keys: string | string[]): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;
  try {
    const arr = Array.isArray(keys) ? keys : [keys];
    if (arr.length) await client.del(...arr);
  } catch (err) {
    console.warn(`[redis] cacheDel failed:`, (err as Error).message);
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
