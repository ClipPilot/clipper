import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../test/helpers/db.helper";
import { buildUser } from "../../../test/factories";

const { mockDb, mockCreateTeam } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockCreateTeam: vi.fn(),
}));

vi.mock("../../db", () => ({ db: mockDb }));

vi.mock("../team.service", () => ({
  teamService: { createTeam: mockCreateTeam },
}));

import { userService } from "../user.service";

describe("userService.getUserBySupabaseUid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user when found", async () => {
    const user = buildUser({ supabase_uid: "supa-1" });
    mockDb.select.mockReturnValue(createDrizzleChain([user]));

    const result = await userService.getUserBySupabaseUid("supa-1");

    expect(result).toEqual(user);
  });

  it("throws when user not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(userService.getUserBySupabaseUid("missing")).rejects.toThrow(
      "User not found"
    );
  });
});

describe("userService.getUserByEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user when found", async () => {
    const user = buildUser({ email: "test@test.com" });
    mockDb.select.mockReturnValue(createDrizzleChain([user]));

    const result = await userService.getUserByEmail("test@test.com");

    expect(result).toEqual(user);
  });

  it("throws when user not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(userService.getUserByEmail("nope@test.com")).rejects.toThrow(
      "User not found"
    );
  });
});

describe("userService.getUserById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user when found", async () => {
    const user = buildUser({ id: 42 });
    mockDb.select.mockReturnValue(createDrizzleChain([user]));

    const result = await userService.getUserById(42);

    expect(result).toEqual(user);
  });

  it("throws when user not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(userService.getUserById(999)).rejects.toThrow("User not found");
  });
});

describe("userService.updateUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates firstName and lastName", async () => {
    const updatedUser = buildUser({ id: 1, first_name: "New", last_name: "Name" });
    mockDb.update.mockReturnValue(createDrizzleChain([updatedUser]));

    const result = await userService.updateUser(1, {
      firstName: "New",
      lastName: "Name",
    });

    expect(result).toEqual(updatedUser);
  });

  it("updates only firstName when lastName not provided", async () => {
    const updatedUser = buildUser({ id: 1, first_name: "Updated" });
    mockDb.update.mockReturnValue(createDrizzleChain([updatedUser]));

    const result = await userService.updateUser(1, { firstName: "Updated" });

    expect(result).toEqual(updatedUser);
  });
});

describe("userService.ensureUserHasTeam", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a default team when user has no teams", async () => {
    const user = buildUser({ id: 5, first_name: "Alice" });

    // First select: getUserById returns user
    // Second select: teamMembers query returns empty (no teams)
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([user]))
      .mockReturnValueOnce(createDrizzleChain([]));

    mockCreateTeam.mockResolvedValue({ id: 10, name: "Alice's Workspace" });

    const result = await userService.ensureUserHasTeam(5);

    expect(mockCreateTeam).toHaveBeenCalledWith("Alice's Workspace", 5, "personal");
    expect(result).toEqual(user);
  });

  it("does not create a team when user already has one", async () => {
    const user = buildUser({ id: 5 });
    const existingMember = { id: 1, user_id: 5, team_id: 10, role: "owner" };

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([user]))
      .mockReturnValueOnce(createDrizzleChain([existingMember]));

    await userService.ensureUserHasTeam(5);

    expect(mockCreateTeam).not.toHaveBeenCalled();
  });

  it("throws when user not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(userService.ensureUserHasTeam(999)).rejects.toThrow(
      "User not found"
    );
  });
});
