import { describe, it, expect } from "vitest";
import {
  wrapInBase,
  teamInviteEmail,
  subscriptionWelcomeEmail,
  subscriptionCancelledEmail,
  paymentFailedEmail,
  subscriptionRenewalEmail,
  clipsReadyEmail,
  admin2faEmail,
  referralAppliedEmail,
  referralConvertedEmail,
  referralSuccessAdminEmail,
  referralRewardSetEmail,
  ugcReadyEmail,
  massPostingApprovedEmail,
  massPostingRejectedEmail,
  adPostingReadyEmail,
  campaignStartedEmail,
  contractSignedEmail,
  campaignPausedEmail,
} from "../index";

describe("wrapInBase", () => {
  it("wraps content in the base email template", () => {
    const html = wrapInBase("<p>Hello</p>", "https://test.cuttr.com");
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("test.cuttr.com/branding/cuttr_logo.png");
    expect(html).toContain(new Date().getFullYear().toString());
  });

  it("uses default frontend URL when not provided", () => {
    const html = wrapInBase("<p>Test</p>");
    expect(html).toContain("platform.cuttr.com/branding/cuttr_logo.png");
  });
});

describe("teamInviteEmail", () => {
  it("renders invite details", () => {
    const html = teamInviteEmail({
      inviterName: "Alice",
      teamName: "Acme Corp",
      inviteUrl: "https://test.com/invite/abc",
      role: "editor",
      expiresIn: "7 days",
    });
    expect(html).toContain("Alice");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("https://test.com/invite/abc");
    expect(html).toContain("editor");
    expect(html).toContain("7 days");
  });
});

describe("subscriptionWelcomeEmail", () => {
  it("renders plan details with numeric clip limit", () => {
    const html = subscriptionWelcomeEmail({
      userName: "Bob",
      planName: "Studio",
      teamName: "Team A",
      clipsLimit: 400,
      dashboardUrl: "https://test.com/dashboard",
    });
    expect(html).toContain("Bob");
    expect(html).toContain("Studio");
    expect(html).toContain("400");
  });

  it("renders Unlimited when clipsLimit is -1", () => {
    const html = subscriptionWelcomeEmail({
      userName: "Bob",
      planName: "Enterprise",
      teamName: "Team A",
      clipsLimit: -1,
      dashboardUrl: "https://test.com/dashboard",
    });
    expect(html).toContain("Unlimited");
  });
});

describe("subscriptionCancelledEmail", () => {
  it("renders cancellation details", () => {
    const html = subscriptionCancelledEmail({
      userName: "Carol",
      teamName: "Team B",
      endDate: "March 15, 2026",
      reactivateUrl: "https://test.com/reactivate",
    });
    expect(html).toContain("Carol");
    expect(html).toContain("March 15, 2026");
    expect(html).toContain("https://test.com/reactivate");
  });
});

describe("paymentFailedEmail", () => {
  it("renders payment failure details", () => {
    const html = paymentFailedEmail({
      userName: "Dave",
      teamName: "Team C",
      amount: "$49.99",
      retryDate: "March 20, 2026",
      updatePaymentUrl: "https://test.com/payment",
    });
    expect(html).toContain("Dave");
    expect(html).toContain("$49.99");
    expect(html).toContain("March 20, 2026");
  });
});

describe("subscriptionRenewalEmail", () => {
  it("renders renewal details", () => {
    const html = subscriptionRenewalEmail({
      userName: "Eve",
      teamName: "Team D",
      planName: "Scale",
      amount: "$99.00",
      renewalDate: "April 1, 2026",
      manageUrl: "https://test.com/manage",
    });
    expect(html).toContain("Eve");
    expect(html).toContain("Scale");
    expect(html).toContain("$99.00");
    expect(html).toContain("April 1, 2026");
  });
});

describe("clipsReadyEmail", () => {
  it("renders singular clip text", () => {
    const html = clipsReadyEmail({
      userName: "Frank",
      clipCount: 1,
      sourceFileName: "video.mp4",
      clipsUrl: "https://test.com/clips",
    });
    expect(html).toContain("1 clip");
    expect(html).not.toContain("1 clips");
    expect(html).toContain("video.mp4");
  });

  it("renders plural clip text", () => {
    const html = clipsReadyEmail({
      userName: "Frank",
      clipCount: 5,
      sourceFileName: "video.mp4",
      clipsUrl: "https://test.com/clips",
    });
    expect(html).toContain("5 clips");
  });
});

describe("admin2faEmail", () => {
  it("renders verification code", () => {
    const html = admin2faEmail({ code: "123456" });
    expect(html).toContain("123456");
    expect(html).toContain("15 minutes");
  });
});

describe("referralAppliedEmail", () => {
  it("renders referral signup", () => {
    const html = referralAppliedEmail({
      referrerName: "Grace",
      referredTeamName: "New Team",
    });
    expect(html).toContain("Grace");
    expect(html).toContain("New Team");
  });
});

describe("referralConvertedEmail", () => {
  it("capitalizes plan name", () => {
    const html = referralConvertedEmail({
      referrerName: "Hank",
      referredTeamName: "Converted Team",
      plan: "studio",
    });
    expect(html).toContain("Studio");
    expect(html).toContain("Hank");
  });
});

describe("referralSuccessAdminEmail", () => {
  it("renders admin referral details", () => {
    const html = referralSuccessAdminEmail({
      referrerTeamName: "Team R",
      referrerEmail: "r@test.com",
      referredTeamName: "Team N",
      referredEmail: "n@test.com",
      plan: "scale",
    });
    expect(html).toContain("Team R");
    expect(html).toContain("r@test.com");
    expect(html).toContain("Scale");
  });
});

describe("referralRewardSetEmail", () => {
  it("renders both bonus clips and percent off", () => {
    const html = referralRewardSetEmail({
      referrerName: "Ivy",
      bonusClips: 10,
      percentOff: 20,
    });
    expect(html).toContain("10 bonus clips and 20% off");
  });

  it("renders only bonus clips", () => {
    const html = referralRewardSetEmail({
      referrerName: "Ivy",
      bonusClips: 5,
      percentOff: 0,
    });
    expect(html).toContain("5 bonus clips");
    expect(html).not.toContain("% off");
  });

  it("renders only percent off", () => {
    const html = referralRewardSetEmail({
      referrerName: "Ivy",
      bonusClips: 0,
      percentOff: 15,
    });
    expect(html).toContain("15% off");
    expect(html).not.toContain("bonus clips");
  });
});

describe("ugcReadyEmail", () => {
  it("renders UGC video link", () => {
    const html = ugcReadyEmail({
      userName: "Jack",
      ugcUrl: "https://test.com/ugc/123",
    });
    expect(html).toContain("Jack");
    expect(html).toContain("https://test.com/ugc/123");
  });
});

describe("massPostingApprovedEmail", () => {
  it("renders approval with drive folder", () => {
    const html = massPostingApprovedEmail({
      userName: "Kate",
      teamName: "Team MP",
      dashboardUrl: "https://test.com/dashboard",
      driveFolderUrl: "https://drive.google.com/drive/folders/abc",
    });
    expect(html).toContain("Kate");
    expect(html).toContain("Team MP");
    expect(html).toContain("drive.google.com");
  });
});

describe("massPostingRejectedEmail", () => {
  it("renders rejection reason", () => {
    const html = massPostingRejectedEmail({
      userName: "Leo",
      teamName: "Team MR",
      rejectionReason: "Insufficient content quality",
      reapplyUrl: "https://test.com/reapply",
    });
    expect(html).toContain("Insufficient content quality");
    expect(html).toContain("https://test.com/reapply");
  });
});

describe("adPostingReadyEmail", () => {
  it("renders clip and platform details", () => {
    const html = adPostingReadyEmail({
      userName: "Mike",
      clipTitle: "Product Demo",
      platforms: "Instagram, TikTok",
      dashboardUrl: "https://test.com/dashboard",
    });
    expect(html).toContain("Product Demo");
    expect(html).toContain("Instagram, TikTok");
  });
});

describe("campaignStartedEmail", () => {
  it("renders campaign launch details", () => {
    const html = campaignStartedEmail({
      userName: "Nina",
      teamName: "Team CS",
      campaignName: "Summer Sale",
      dashboardUrl: "https://test.com/campaign/1",
    });
    expect(html).toContain("Nina");
    expect(html).toContain("Summer Sale");
    expect(html).toContain("Team CS");
  });
});

describe("contractSignedEmail", () => {
  it("renders contract signing details", () => {
    const html = contractSignedEmail({
      userName: "Oscar",
      teamName: "Team CO",
      campaignName: "Winter Campaign",
      signerName: "Oscar P.",
      signedDate: "Jan 1, 2026",
    });
    expect(html).toContain("Oscar P.");
    expect(html).toContain("Winter Campaign");
    expect(html).toContain("Jan 1, 2026");
  });
});

describe("campaignPausedEmail", () => {
  it("renders pause reason and dashboard link", () => {
    const html = campaignPausedEmail({
      userName: "Pat",
      teamName: "Team CP",
      campaignName: "Q1 Push",
      failureReason: "Card charge failed: card_declined",
      dashboardUrl: "https://test.com/campaign/5",
    });
    expect(html).toContain("Pat");
    expect(html).toContain("Q1 Push");
    expect(html).toContain("Card charge failed: card_declined");
    expect(html).toContain("https://test.com/campaign/5");
    expect(html).toContain("Campaign Paused");
  });

  it("includes team name for admin emails", () => {
    const html = campaignPausedEmail({
      userName: "Admin",
      teamName: "Team CP",
      campaignName: "Q1 Push",
      failureReason: "No card on file",
      dashboardUrl: "https://test.com/campaign/5",
      isAdmin: true,
    });
    expect(html).toContain("<strong style=\"color: #ffffff;\">Team:</strong> Team CP");
  });

  it("does not include team label for non-admin emails", () => {
    const html = campaignPausedEmail({
      userName: "Pat",
      teamName: "Team CP",
      campaignName: "Q1 Push",
      failureReason: "No card on file",
      dashboardUrl: "https://test.com/campaign/5",
      isAdmin: false,
    });
    expect(html).not.toContain("<strong style=\"color: #ffffff;\">Team:</strong> Team CP");
  });
});
