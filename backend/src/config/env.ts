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
    s3Bucket: "clipster-videos-prod-850317988005",
    sqsQueueUrl: getEnv("SQS_QUEUE_URL", ""),
  },
  gemini: {
    apiKey: getEnv("GEMINI_API_KEY"),
  },
  elevenlabs: {
    apiKey: getEnv("ELEVENLABS_API_KEY", ""),
  },
  fal: {
    apiKey: getEnv("FAL_KEY", ""),
  },
  apify: {
    apiToken: getEnv("APIFY_API_TOKEN", ""),
  },
  socialData: {
    apiKey: getEnv("SOCIALDATA_API_KEY", ""),
  },
  sync: {
    apiKey: process.env.SYNC_KEY || "",
  },
  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    serviceAccountPrivateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "",
    driveParentFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "",
    delegateEmail: "contact@cuttr.com",
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
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  GEMINI_API_KEY: config.gemini.apiKey,
  ELEVENLABS_API_KEY: config.elevenlabs.apiKey,
  FAL_KEY: config.fal.apiKey,
  AD_POSTING_WEBHOOK_SECRET: process.env.AD_POSTING_WEBHOOK_SECRET || "",
};
