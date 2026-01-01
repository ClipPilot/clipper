import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const env = process.env.ENV || "dev";
let output;
let DATABASE_URL;

if (env === "prod") {
  output = "./drizzle/";
  DATABASE_URL = process.env.PROD_DATABASE_URL;
} else if (env === "staging") {
  output = "./drizzle/staging";
  DATABASE_URL = process.env.STAGING_DATABASE_URL;
} else if (env === "dev") {
  output = "./drizzle/dev";
  DATABASE_URL = process.env.STAGING_DATABASE_URL;
} else {
  output = "./drizzle/";
  DATABASE_URL = process.env.DATABASE_URL;
}

export default defineConfig({
  out: output,
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
