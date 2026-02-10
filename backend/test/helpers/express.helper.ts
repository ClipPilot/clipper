import { vi } from "vitest";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../../src/middleware/auth.middleware";

export function createMockRequest(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    headers: {},
    params: {},
    body: {},
    query: {},
    ...overrides,
  } as AuthRequest;
}

export function createMockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  return res as Response;
}

export function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}
