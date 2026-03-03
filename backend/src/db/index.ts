import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@clipper/shared-db";

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

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

const initializeDatabase = () => {
  if (!pool) {
    const databaseUrl = getDatabaseUrl();

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not defined");
    }

    const isWorker = process.argv[1]?.includes("worker");

    pool = new Pool({
      connectionString: databaseUrl,
      max: isWorker ? 5 : 10, // Keep below Supabase pooler limit (API + worker share it)
      min: 1,
      idleTimeoutMillis: 30000, // 30s before closing idle connections
      connectionTimeoutMillis: 10000, // 10s to wait for connection
      allowExitOnIdle: false,
    });

    // Handle pool errors gracefully
    pool.on("error", (err) => {
      console.error("Unexpected database pool error:", err.message);
    });

    dbInstance = drizzle(pool, { schema });
    console.log(
      `Database connection initialized (${process.env.NODE_ENV || "development"})`
    );
  }
  return dbInstance!;
};

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    const instance = initializeDatabase();
    return (instance as any)[prop];
  },
});

// Export the schema for easy access
export { schema };
