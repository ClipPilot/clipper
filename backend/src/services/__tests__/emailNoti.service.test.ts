import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

vi.mock("../../templates/emailTemplates", () => ({
  teamInviteEmail: vi.fn(() => "<html>invite</html>"),
  subscriptionWelcomeEmail: vi.fn(() => "<html>welcome</html>"),
  subscriptionCancelledEmail: vi.fn(() => "<html>cancelled</html>"),
  paymentFailedEmail: vi.fn(() => "<html>failed</html>"),
  subscriptionRenewalEmail: vi.fn(() => "<html>renewal</html>"),
  clipsReadyEmail: vi.fn(() => "<html>clips</html>"),
  admin2faEmail: vi.fn(() => "<html>2fa</html>"),
  referralAppliedEmail: vi.fn(() => "<html>applied</html>"),
  referralConvertedEmail: vi.fn(() => "<html>converted</html>"),
  referralSuccessAdminEmail: vi.fn(() => "<html>success</html>"),
  referralRewardSetEmail: vi.fn(() => "<html>reward</html>"),
  ugcReadyEmail: vi.fn(() => "<html>ugc</html>"),
}));

import { emailNotiService } from "../emailNoti.service";

describe("EmailNotiService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("sendEmailNotification", () => {
    it("sends email via Resend", async () => {
      mockSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

      const result = await emailNotiService.sendEmailNotification(
        "user@test.com",
        "Test Subject",
        "<p>Hello</p>"
      );

      expect(mockSend).toHaveBeenCalledWith({
        from: "Cuttr <no-reply@mail.cuttr.com>",
        to: ["user@test.com"],
        subject: "Test Subject",
        html: "<p>Hello</p>",
      });
      expect(result).toEqual({ id: "msg-1" });
    });

    it("throws when Resend returns an error", async () => {
      mockSend.mockResolvedValue({ data: null, error: { message: "Rate limit" } });

      await expect(
        emailNotiService.sendEmailNotification("x@x.com", "S", "B")
      ).rejects.toThrow("Failed to send email: Rate limit");
    });
  });

  describe("sendTeamInvite", () => {
    it("sends with correct subject", async () => {
      mockSend.mockResolvedValue({ data: { id: "msg-2" }, error: null });

      await emailNotiService.sendTeamInvite("new@test.com", {
        inviterName: "Alice",
        teamName: "Acme",
        inviteUrl: "https://cuttr.com/invite/abc",
        role: "Member",
        expiresIn: "7 days",
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Alice invited you to join Acme on Cuttr",
          to: ["new@test.com"],
        })
      );
    });
  });

  describe("sendClipsReady", () => {
    it("uses singular subject for 1 clip", async () => {
      mockSend.mockResolvedValue({ data: { id: "msg-3" }, error: null });

      await emailNotiService.sendClipsReady("u@t.com", {
        clipCount: 1,
      } as any);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Your clip is ready!" })
      );
    });

    it("uses plural subject for multiple clips", async () => {
      mockSend.mockResolvedValue({ data: { id: "msg-4" }, error: null });

      await emailNotiService.sendClipsReady("u@t.com", {
        clipCount: 5,
      } as any);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Your 5 clips are ready!" })
      );
    });
  });

  describe("other email methods", () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ data: { id: "ok" }, error: null });
    });

    it("sendSubscriptionWelcome", async () => {
      await emailNotiService.sendSubscriptionWelcome("u@t.com", { planName: "Studio" } as any);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Welcome to Cuttr Studio!" })
      );
    });

    it("sendSubscriptionCancelled", async () => {
      await emailNotiService.sendSubscriptionCancelled("u@t.com", {} as any);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Your Cuttr subscription has been cancelled" })
      );
    });

    it("sendPaymentFailed", async () => {
      await emailNotiService.sendPaymentFailed("u@t.com", { teamName: "Acme" } as any);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Action required: Payment failed for Acme" })
      );
    });

    it("sendAdmin2FACode", async () => {
      await emailNotiService.sendAdmin2FACode("a@b.com", { code: "123456" } as any);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Your Cuttr Admin Verification Code" })
      );
    });

    it("sendUgcReady", async () => {
      await emailNotiService.sendUgcReady("u@t.com", {} as any);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Your UGC video is ready! 🎉" })
      );
    });
  });
});
