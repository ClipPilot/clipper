import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedisInstance } = vi.hoisted(() => ({
  mockRedisInstance: {
    on: vi.fn().mockReturnThis(),
    set: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("ioredis", () => ({
  default: class MockRedis {
    on = mockRedisInstance.on;
    set = mockRedisInstance.set;
    expire = mockRedisInstance.expire;
    del = mockRedisInstance.del;
  },
}));

vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
}));

describe("redis.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("getRedisClient", () => {
    it("returns null when REDIS_URL is not set", async () => {
      delete process.env.REDIS_URL;
      const { getRedisClient } = await import("../redis.service");
      const client = getRedisClient();
      expect(client).toBeNull();
    });

    it("creates client when REDIS_URL is set", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const { getRedisClient } = await import("../redis.service");
      const client = getRedisClient();
      expect(client).not.toBeNull();
      expect(mockRedisInstance.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith("connect", expect.any(Function));
    });

    it("returns same client on subsequent calls (singleton)", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const { getRedisClient } = await import("../redis.service");
      const client1 = getRedisClient();
      const client2 = getRedisClient();
      expect(client1).toBe(client2);
    });
  });

  describe("acquireJobLock", () => {
    it("returns true when Redis is not available", async () => {
      delete process.env.REDIS_URL;
      const { acquireJobLock } = await import("../redis.service");
      const result = await acquireJobLock("job-1");
      expect(result).toBe(true);
    });

    it("returns true when lock is acquired (SET NX returns OK)", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      mockRedisInstance.set.mockResolvedValue("OK");
      const { acquireJobLock } = await import("../redis.service");
      const result = await acquireJobLock("job-1", 300);
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        "comfy:job:lock:job-1",
        "1",
        "EX",
        300,
        "NX"
      );
      expect(result).toBe(true);
    });

    it("returns false when lock already exists (SET NX returns null)", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      mockRedisInstance.set.mockResolvedValue(null);
      const { acquireJobLock } = await import("../redis.service");
      const result = await acquireJobLock("job-2");
      expect(result).toBe(false);
    });
  });

  describe("extendJobLock", () => {
    it("does nothing when Redis is not available", async () => {
      delete process.env.REDIS_URL;
      const { extendJobLock } = await import("../redis.service");
      await extendJobLock("job-1");
      expect(mockRedisInstance.expire).not.toHaveBeenCalled();
    });

    it("extends TTL on lock key", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      mockRedisInstance.expire.mockResolvedValue(1);
      const { extendJobLock } = await import("../redis.service");
      await extendJobLock("job-1", 600);
      expect(mockRedisInstance.expire).toHaveBeenCalledWith(
        "comfy:job:lock:job-1",
        600
      );
    });
  });

  describe("releaseJobLock", () => {
    it("does nothing when Redis is not available", async () => {
      delete process.env.REDIS_URL;
      const { releaseJobLock } = await import("../redis.service");
      await releaseJobLock("job-1");
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });

    it("deletes the lock key", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      mockRedisInstance.del.mockResolvedValue(1);
      const { releaseJobLock } = await import("../redis.service");
      await releaseJobLock("job-1");
      expect(mockRedisInstance.del).toHaveBeenCalledWith("comfy:job:lock:job-1");
    });
  });
});
