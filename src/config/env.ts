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
};
