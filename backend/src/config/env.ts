import dotenv from "dotenv";

dotenv.config();

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (value === undefined) {
    throw new Error(`❌ Missing environment variable: ${name}`);
  }
  return value;
}

export const ENV = {
  OPENAI_API_KEY: getEnv("OPENAI_API_KEY"),
  PORT: getEnv("PORT", "3001"),
  LOCAL_VIDEO_PATH: getEnv("LOCAL_VIDEO_PATH"),
  DEEPGRAM_API_KEY: getEnv("DEEPGRAM_API_KEY"),
  SUPABASE_URL: getEnv("SUPABASE_URL"),
  SUPABASE_ANON_KEY: getEnv("SUPABASE_ANON_KEY"),
  DATABASE_URL: getEnv("DATABASE_URL"),
};
