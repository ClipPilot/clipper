import dotenv from "dotenv";

dotenv.config();

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (value === undefined) {
    throw new Error(`❌ Missing environment variable: ${name}`);
  }
  return value;
}

export const config = {
  openai: {
    apiKey: getEnv("OPENAI_API_KEY"),
  },
  deepgram: {
    apiKey: getEnv("DEEPGRAM_API_KEY"),
  },
  supabase: {
    url: getEnv("SUPABASE_URL"),
    anonKey: getEnv("SUPABASE_ANON_KEY"),
  },
  database: {
    url: getEnv("DATABASE_URL"),
  },
  aws: {
    region: getEnv("AWS_REGION", "us-west-2"),
    s3Bucket: getEnv("AWS_S3_BUCKET"),
  },
  port: getEnv("PORT", "3001"),
};

export const ENV = {
  OPENAI_API_KEY: config.openai.apiKey,
  PORT: config.port,
  DEEPGRAM_API_KEY: config.deepgram.apiKey,
  SUPABASE_URL: config.supabase.url,
  SUPABASE_ANON_KEY: config.supabase.anonKey,
  DATABASE_URL: config.database.url,
};
