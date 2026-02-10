import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../test/helpers/db.helper";

const { mockDb, mockSendTeamInvite, mockCanInviteMembers } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockSendTeamInvite: vi.fn(),
  mockCanInviteMembers: vi.fn(),
}));

vi.mock("../../db", () => ({ db: mockDb }));
vi.mock("../emailNoti.service", () => ({
  emailNotiService: { sendTeamInvite: mockSendTeamInvite },
}));
vi.mock("../../utils/plans", () => ({
  canInviteMembers: mockCanInviteMembers,
}));
vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
}));

import { teamInviteService } from "../teamInvite.service";

describe("TeamInviteService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createInvite", () => {
    it("throws when team not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));

      await expect(
        teamInviteService.createInvite(1, 10, "new@test.com")
      ).rejects.toThrow("Team not found");
    });

    it("throws when personal team and cannot invite members", async () => {
      mockDb.select.mockReturnValue(
        createDrizzleChain([{ id: 1, type: "personal", plan: "free", name: "My Team" }])
      );
      mockCanInviteMembers.mockReturnValue(false);

      await expect(
        teamInviteService.createInvite(1, 10, "new@test.com")
      ).rejects.toThrow("Cannot invite members to personal workspaces");
    });

    it("throws when user is already a team member", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Team lookup
          return createDrizzleChain([{ id: 1, type: "team", plan: "scale", name: "Acme" }]);
        }
        if (selectCallCount === 2) {
          // Existing user lookup
          return createDrizzleChain([{ id: 99, email: "new@test.com" }]);
        }
        if (selectCallCount === 3) {
          // Existing member check
          return createDrizzleChain([{ team_id: 1, user_id: 99 }]);
        }
        return createDrizzleChain([]);
      });

      await expect(
        teamInviteService.createInvite(1, 10, "new@test.com")
      ).rejects.toThrow("User is already a member of this team");
    });

    it("throws when inviter not found", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createDrizzleChain([{ id: 1, type: "team", plan: "scale", name: "Acme" }]);
        }
        if (selectCallCount === 2) {
          // No existing user
          return createDrizzleChain([]);
        }
        if (selectCallCount === 3) {
          // No existing invite
          return createDrizzleChain([]);
        }
        if (selectCallCount === 4) {
          // Inviter lookup — not found
          return createDrizzleChain([]);
        }
        return createDrizzleChain([]);
      });

      await expect(
        teamInviteService.createInvite(1, 10, "new@test.com")
      ).rejects.toThrow("Inviter not found");
    });

    it("creates invite and sends email on success", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createDrizzleChain([{ id: 1, type: "team", plan: "scale", name: "Acme" }]);
        }
        if (selectCallCount === 2) {
          // No existing user with that email
          return createDrizzleChain([]);
        }
        if (selectCallCount === 3) {
          // No existing pending invite
          return createDrizzleChain([]);
        }
        if (selectCallCount === 4) {
          // Inviter found
          return createDrizzleChain([{ id: 10, first_name: "Alice", last_name: "Smith" }]);
        }
        return createDrizzleChain([]);
      });

      const invite = { id: 50, team_id: 1, email: "new@test.com", role: "member", token: "abc" };
      mockDb.insert.mockReturnValue(createDrizzleChain([invite]));
      mockSendTeamInvite.mockResolvedValue(undefined);

      const result = await teamInviteService.createInvite(1, 10, "new@test.com");
      expect(result).toEqual(invite);
      expect(mockSendTeamInvite).toHaveBeenCalledWith(
        "new@test.com",
        expect.objectContaining({
          inviterName: "Alice Smith",
          teamName: "Acme",
          role: "Member",
        })
      );
    });

    it("revokes existing pending invite before creating new one", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createDrizzleChain([{ id: 1, type: "team", plan: "scale", name: "Acme" }]);
        }
        if (selectCallCount === 2) {
          return createDrizzleChain([]);
        }
        if (selectCallCount === 3) {
          // Existing pending invite
          return createDrizzleChain([{ id: 40, status: "pending" }]);
        }
        if (selectCallCount === 4) {
          return createDrizzleChain([{ id: 10, first_name: "Bob", last_name: "Jones" }]);
        }
        return createDrizzleChain([]);
      });

      mockDb.update.mockReturnValue(createDrizzleChain([]));
      mockDb.insert.mockReturnValue(createDrizzleChain([{ id: 51, token: "xyz" }]));
      mockSendTeamInvite.mockResolvedValue(undefined);

      await teamInviteService.createInvite(1, 10, "new@test.com");
      // update called to revoke existing invite
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("acceptInvite", () => {
    it("throws when invite not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));

      await expect(teamInviteService.acceptInvite("bad-token", 1)).rejects.toThrow(
        "Invite not found"
      );
    });

    it("throws when invite is not pending", async () => {
      mockDb.select.mockReturnValue(
        createDrizzleChain([{ id: 1, token: "tok", status: "accepted" }])
      );

      await expect(teamInviteService.acceptInvite("tok", 1)).rejects.toThrow(
        "Invite has already been accepted"
      );
    });

    it("throws and marks expired when past expiry date", async () => {
      const pastDate = new Date("2020-01-01");
      mockDb.select.mockReturnValue(
        createDrizzleChain([{ id: 1, token: "tok", status: "pending", expires_at: pastDate }])
      );
      mockDb.update.mockReturnValue(createDrizzleChain([]));

      await expect(teamInviteService.acceptInvite("tok", 1)).rejects.toThrow(
        "Invite has expired"
      );
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("throws when user not found", async () => {
      const futureDate = new Date("2099-01-01");
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createDrizzleChain([
            { id: 1, token: "tok", status: "pending", expires_at: futureDate, team_id: 5, email: "u@test.com", role: "member" },
          ]);
        }
        // User lookup
        return createDrizzleChain([]);
      });

      await expect(teamInviteService.acceptInvite("tok", 99)).rejects.toThrow(
        "User not found"
      );
    });

    it("throws when email does not match", async () => {
      const futureDate = new Date("2099-01-01");
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createDrizzleChain([
            { id: 1, token: "tok", status: "pending", expires_at: futureDate, team_id: 5, email: "alice@test.com", role: "member" },
          ]);
        }
        if (selectCallCount === 2) {
          return createDrizzleChain([{ id: 99, email: "bob@test.com" }]);
        }
        return createDrizzleChain([]);
      });

      await expect(teamInviteService.acceptInvite("tok", 99)).rejects.toThrow(
        "different email address"
      );
    });
  });

  describe("revokeInvite", () => {
    it("throws when invite not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));

      await expect(teamInviteService.revokeInvite(1, 5)).rejects.toThrow("Invite not found");
    });

    it("throws when invite is not pending", async () => {
      mockDb.select.mockReturnValue(
        createDrizzleChain([{ id: 1, team_id: 5, status: "accepted" }])
      );

      await expect(teamInviteService.revokeInvite(1, 5)).rejects.toThrow(
        "Can only revoke pending invites"
      );
    });

    it("updates status to revoked", async () => {
      mockDb.select.mockReturnValue(
        createDrizzleChain([{ id: 1, team_id: 5, status: "pending" }])
      );
      mockDb.update.mockReturnValue(createDrizzleChain([]));

      await teamInviteService.revokeInvite(1, 5);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("resendInvite", () => {
    it("throws when invite not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));

      await expect(teamInviteService.resendInvite(1, 5)).rejects.toThrow("Invite not found");
    });

    it("throws when invite is not pending", async () => {
      mockDb.select.mockReturnValue(
        createDrizzleChain([{ id: 1, team_id: 5, status: "revoked" }])
      );

      await expect(teamInviteService.resendInvite(1, 5)).rejects.toThrow(
        "Can only resend pending invites"
      );
    });

    it("updates token and sends email", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createDrizzleChain([
            { id: 1, team_id: 5, status: "pending", email: "u@test.com", role: "member", invited_by_user_id: 10 },
          ]);
        }
        if (selectCallCount === 2) {
          return createDrizzleChain([{ id: 5, name: "Acme" }]);
        }
        if (selectCallCount === 3) {
          return createDrizzleChain([{ id: 10, first_name: "Alice", last_name: "Lee" }]);
        }
        return createDrizzleChain([]);
      });
      mockDb.update.mockReturnValue(createDrizzleChain([]));
      mockSendTeamInvite.mockResolvedValue(undefined);

      await teamInviteService.resendInvite(1, 5);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockSendTeamInvite).toHaveBeenCalledWith(
        "u@test.com",
        expect.objectContaining({ teamName: "Acme", inviterName: "Alice Lee" })
      );
    });
  });

  describe("cleanupExpiredInvites", () => {
    it("updates expired pending invites", async () => {
      mockDb.update.mockReturnValue(createDrizzleChain([]));

      await teamInviteService.cleanupExpiredInvites();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("acceptAllPendingInvitesForUser", () => {
    it("skips expired invites and accepts valid ones", async () => {
      const pastDate = new Date("2020-01-01");
      const futureDate = new Date("2099-01-01");

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Pending invites for email
          return createDrizzleChain([
            { id: 1, team_id: 10, role: "member", expires_at: pastDate, status: "pending" },
            { id: 2, team_id: 20, role: "manager", expires_at: futureDate, status: "pending" },
          ]);
        }
        if (selectCallCount === 2) {
          // Existing member check for invite 2 — not a member
          return createDrizzleChain([]);
        }
        return createDrizzleChain([]);
      });
      mockDb.update.mockReturnValue(createDrizzleChain([]));
      mockDb.insert.mockReturnValue(createDrizzleChain([]));

      const result = await teamInviteService.acceptAllPendingInvitesForUser(5, "u@test.com");
      expect(result).toEqual([{ teamId: 20, role: "manager" }]);
      // update called for expired invite + accepted invite
      expect(mockDb.update).toHaveBeenCalled();
      // insert called only for the valid invite
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
  });
});
