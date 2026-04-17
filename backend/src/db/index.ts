import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, PoolConfig } from "pg";
import * as schema from "@clipper/shared-db";

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;
let metricsInterval: NodeJS.Timeout | null = null;

const getDatabaseUrl = () => {
  const env = process.env.NODE_ENV || "development";

  if (env === "production") {
    return process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  } else if (env === "staging") {
    return process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL;
  } else if (env === "development") {
    return process.env.STAGING_DATABASE_URL;
  }

  return process.env.DATABASE_URL;
};

const isWorker = () => process.argv[1]?.includes("worker");

const buildPoolConfig = (): PoolConfig => {
  const worker = isWorker();
  const apiMax = Number(process.env.DB_POOL_MAX_API) || 50;
  const workerMax = Number(process.env.DB_POOL_MAX_WORKER) || 15;

  return {
    max: worker ? workerMax : apiMax,
    min: worker ? 2 : 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
    query_timeout: 30_000,
    keepAlive: true,
    allowExitOnIdle: false,
  };
};

const initializeDatabase = () => {
  if (!pool) {
    const databaseUrl = getDatabaseUrl();

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not defined");
    }

    const config = buildPoolConfig();
    pool = new Pool({ connectionString: databaseUrl, ...config });

    pool.on("error", (err) => {
      console.error("[db] Unexpected pool error:", err.message);
    });

    if (process.env.NODE_ENV !== "test") {
      metricsInterval = setInterval(() => {
        if (!pool) return;
        if (pool.waitingCount > 0) {
          console.warn(
            `[db] Pool pressure total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`
          );
        }
      }, 30_000);
      metricsInterval.unref?.();
    }

    dbInstance = drizzle(pool, { schema });
    console.log(
      `[db] Initialized role=${isWorker() ? "worker" : "api"} max=${config.max} env=${process.env.NODE_ENV || "development"}`
    );
  }
  return dbInstance!;
};

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const instance = initializeDatabase();
    return (instance as any)[prop];
  },
});

export const getPoolStats = () => {
  if (!pool) return { totalCount: 0, idleCount: 0, waitingCount: 0 };
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
};

export const closeDatabase = async () => {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
};

export { schema };
