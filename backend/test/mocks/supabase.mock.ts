import { vi } from "vitest";

export const mockSupabaseAuth = {
  getUser: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  refreshSession: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  admin: {
    signOut: vi.fn(),
    updateUserById: vi.fn(),
  },
};

export const mockSupabaseClient = {
  auth: mockSupabaseAuth,
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));
