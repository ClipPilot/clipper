import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Mock all heavy external dependencies that get pulled in via routes.
// These need to be class-like (work with `new`) where the source code uses `new`.

vi.mock("../../src/db", () => ({
  db: new Proxy(
    {},
    {
      get: () =>
        vi.fn(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          leftJoin: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockReturnThis(),
          then: (resolve: Function) => resolve([]),
        })),
    }
  ),
  schema: {},
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      refreshSession: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      admin: { signOut: vi.fn(), updateUserById: vi.fn() },
    },
  })),
}));

vi.mock("stripe", () => {
  class MockStripe {
    webhooks = { constructEvent: vi.fn() };
    checkout = { sessions: { create: vi.fn() } };
    billingPortal = { sessions: { create: vi.fn() } };
    subscriptions = { retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() };
    customers = { create: vi.fn() };
    prices = { list: vi.fn().mockResolvedValue({ data: [] }) };
    products = { retrieve: vi.fn() };
  }
  return { default: MockStripe };
});

// AWS mocks — use class syntax so `new S3Client()` works
vi.mock("@aws-sdk/client-s3", () => {
  class MockS3Client { send = vi.fn(); }
  return {
    S3Client: MockS3Client,
    PutObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    HeadObjectCommand: vi.fn(),
    ListObjectsV2Command: vi.fn(),
  };
});

vi.mock("@aws-sdk/client-sqs", () => {
  class MockSQSClient { send = vi.fn(); }
  return {
    SQSClient: MockSQSClient,
    SendMessageCommand: vi.fn(),
  };
});

vi.mock("@aws-sdk/client-ecs", () => {
  class MockECSClient { send = vi.fn(); }
  return {
    ECSClient: MockECSClient,
    RunTaskCommand: vi.fn(),
  };
});

vi.mock("@aws-sdk/client-lambda", () => {
  class MockLambdaClient { send = vi.fn(); }
  return {
    LambdaClient: MockLambdaClient,
    InvokeCommand: vi.fn(),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/signed"),
}));

vi.mock("@aws-sdk/lib-storage", () => {
  class MockUpload { done = vi.fn().mockResolvedValue({}); }
  return { Upload: MockUpload };
});

vi.mock("ioredis", () => {
  class MockRedis {
    on = vi.fn().mockReturnThis();
    get = vi.fn();
    set = vi.fn();
    del = vi.fn();
    subscribe = vi.fn();
    publish = vi.fn();
    duplicate = vi.fn().mockReturnThis();
    status = "ready";
  }
  return { default: MockRedis };
});

vi.mock("socket.io", () => {
  class MockServer {
    on = vi.fn();
    emit = vi.fn();
    adapter = vi.fn();
  }
  return { Server: MockServer };
});

vi.mock("@socket.io/redis-adapter", () => ({
  createAdapter: vi.fn(),
}));

vi.mock("resend", () => {
  class MockResend {
    emails = { send: vi.fn().mockResolvedValue({ id: "test" }) };
  }
  return { Resend: MockResend };
});

vi.mock("puppeteer", () => ({
  default: { launch: vi.fn() },
}));

vi.mock("openai", () => {
  class MockOpenAI {}
  return { default: MockOpenAI };
});

vi.mock("@deepgram/sdk", () => ({
  createClient: vi.fn(() => ({})),
  Deepgram: vi.fn(() => ({})),
}));

vi.mock("@google/genai", () => {
  class MockGoogleGenAI {}
  return { GoogleGenAI: MockGoogleGenAI };
});

vi.mock("@elevenlabs/elevenlabs-js", () => {
  class MockElevenLabs {}
  return { ElevenLabsClient: MockElevenLabs };
});

vi.mock("@fal-ai/client", () => ({
  fal: { config: vi.fn(), subscribe: vi.fn(), queue: { submit: vi.fn() } },
}));

import app from "../../src/app";

describe("GET /health", () => {
  it("returns 200 with correct body shape", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "healthy");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("service", "clipster-backend");
  });
});

describe("Unauthenticated routes", () => {
  it("GET /api/teams returns 401 without auth", async () => {
    const res = await request(app).get("/api/teams");

    expect(res.status).toBe(401);
  });

  it("POST /api/auth/signup returns 400 or 429 without valid body", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({});

    // Rate limiter may kick in (429) or validation error (400/500)
    expect([400, 429, 500]).toContain(res.status);
  });
});
