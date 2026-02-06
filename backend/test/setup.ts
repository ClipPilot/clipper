import { vi } from "vitest";

// Set test environment variables before anything imports env.ts
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.DEEPGRAM_API_KEY = "test-deepgram-key";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.AWS_REGION = "us-west-2";
process.env.SQS_QUEUE_URL = "https://sqs.us-west-2.amazonaws.com/000/test";

// Mock Sentry globally - prevents real error reporting during tests
vi.mock("@sentry/node", () => ({
  default: {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setupExpressErrorHandler: vi.fn(),
    init: vi.fn(),
  },
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setupExpressErrorHandler: vi.fn(),
  init: vi.fn(),
}));

// Silence console output during tests (comment out for debugging)
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
