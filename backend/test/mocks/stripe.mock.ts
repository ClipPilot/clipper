import { vi } from "vitest";

export const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  subscriptions: {
    retrieve: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
  customers: {
    create: vi.fn(),
  },
};

vi.mock("stripe", () => ({
  default: vi.fn(() => mockStripe),
}));
