import { readFileSync } from "fs";
import { join } from "path";

const templatesDir = __dirname;

const loadTemplate = (filename: string): string => {
  return readFileSync(join(templatesDir, filename), "utf-8");
};

const baseTemplate = loadTemplate("base.html");
const teamInviteTemplate = loadTemplate("team-invite.html");
const subscriptionWelcomeTemplate = loadTemplate("subscription-welcome.html");
const subscriptionCancelledTemplate = loadTemplate("subscription-cancelled.html");
const paymentFailedTemplate = loadTemplate("payment-failed.html");
const subscriptionRenewalTemplate = loadTemplate("subscription-renewal.html");
const clipsReadyTemplate = loadTemplate("clips-ready.html");
const admin2faTemplate = loadTemplate("admin-2fa.html");

const wrapInBase = (content: string): string => {
  const frontendUrl = process.env.FRONTEND_URL || "https://platform.cuttr.com";
  return baseTemplate
    .replace("{{CONTENT}}", content)
    .replace("{{YEAR}}", new Date().getFullYear().toString())
    .replace(/{{FRONTEND_URL}}/g, frontendUrl);
};

export interface TeamInviteEmailData {
  inviterName: string;
  teamName: string;
  inviteUrl: string;
  role: string;
  expiresIn: string;
}

export const teamInviteEmail = (data: TeamInviteEmailData): string => {
  const content = teamInviteTemplate
    .replace(/{{INVITER_NAME}}/g, data.inviterName)
    .replace(/{{TEAM_NAME}}/g, data.teamName)
    .replace(/{{INVITE_URL}}/g, data.inviteUrl)
    .replace(/{{ROLE}}/g, data.role)
    .replace(/{{EXPIRES_IN}}/g, data.expiresIn);
  return wrapInBase(content);
};

export interface SubscriptionWelcomeEmailData {
  userName: string;
  planName: string;
  teamName: string;
  clipsLimit: number;
  dashboardUrl: string;
}

export const subscriptionWelcomeEmail = (data: SubscriptionWelcomeEmailData): string => {
  const clipsText = data.clipsLimit === -1 ? "Unlimited" : data.clipsLimit.toString();
  const content = subscriptionWelcomeTemplate
    .replace(/{{USER_NAME}}/g, data.userName)
    .replace(/{{PLAN_NAME}}/g, data.planName)
    .replace(/{{TEAM_NAME}}/g, data.teamName)
    .replace(/{{CLIPS_LIMIT}}/g, clipsText)
    .replace(/{{DASHBOARD_URL}}/g, data.dashboardUrl);
  return wrapInBase(content);
};

export interface SubscriptionCancelledEmailData {
  userName: string;
  teamName: string;
  endDate: string;
  reactivateUrl: string;
}

export const subscriptionCancelledEmail = (data: SubscriptionCancelledEmailData): string => {
  const content = subscriptionCancelledTemplate
    .replace(/{{USER_NAME}}/g, data.userName)
    .replace(/{{TEAM_NAME}}/g, data.teamName)
    .replace(/{{END_DATE}}/g, data.endDate)
    .replace(/{{REACTIVATE_URL}}/g, data.reactivateUrl);
  return wrapInBase(content);
};

export interface PaymentFailedEmailData {
  userName: string;
  teamName: string;
  amount: string;
  retryDate: string;
  updatePaymentUrl: string;
}

export const paymentFailedEmail = (data: PaymentFailedEmailData): string => {
  const content = paymentFailedTemplate
    .replace(/{{USER_NAME}}/g, data.userName)
    .replace(/{{TEAM_NAME}}/g, data.teamName)
    .replace(/{{AMOUNT}}/g, data.amount)
    .replace(/{{RETRY_DATE}}/g, data.retryDate)
    .replace(/{{UPDATE_PAYMENT_URL}}/g, data.updatePaymentUrl);
  return wrapInBase(content);
};

export interface SubscriptionRenewalEmailData {
  userName: string;
  teamName: string;
  planName: string;
  amount: string;
  renewalDate: string;
  manageUrl: string;
}

export const subscriptionRenewalEmail = (data: SubscriptionRenewalEmailData): string => {
  const content = subscriptionRenewalTemplate
    .replace(/{{USER_NAME}}/g, data.userName)
    .replace(/{{TEAM_NAME}}/g, data.teamName)
    .replace(/{{PLAN_NAME}}/g, data.planName)
    .replace(/{{AMOUNT}}/g, data.amount)
    .replace(/{{RENEWAL_DATE}}/g, data.renewalDate)
    .replace(/{{MANAGE_URL}}/g, data.manageUrl);
  return wrapInBase(content);
};

export interface ClipsReadyEmailData {
  userName: string;
  clipCount: number;
  sourceFileName: string;
  clipsUrl: string;
}

export const clipsReadyEmail = (data: ClipsReadyEmailData): string => {
  const plural = data.clipCount > 1 ? "s" : "";
  const have = data.clipCount > 1 ? "have" : "has";
  const are = data.clipCount > 1 ? "are" : "is";
  const content = clipsReadyTemplate
    .replace(/{{USER_NAME}}/g, data.userName)
    .replace(/{{CLIP_COUNT}}/g, data.clipCount.toString())
    .replace(/{{CLIP_PLURAL}}/g, plural)
    .replace(/{{CLIP_HAVE}}/g, have)
    .replace(/{{CLIP_ARE}}/g, are)
    .replace(/{{SOURCE_FILE}}/g, data.sourceFileName)
    .replace(/{{CLIPS_URL}}/g, data.clipsUrl);
  return wrapInBase(content);
};

export interface Admin2FAEmailData {
  code: string;
}

export const admin2faEmail = (data: Admin2FAEmailData): string => {
  const content = admin2faTemplate.replace(/{{CODE}}/g, data.code);
  return wrapInBase(content);
};

export interface ReferralAppliedEmailData {
  referrerName: string;
  referredTeamName: string;
}

export const referralAppliedEmail = (data: ReferralAppliedEmailData): string => {
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Someone Used Your Referral Code!</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Hey ${data.referrerName},</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;"><strong style="color: #ffffff;">${data.referredTeamName}</strong> just signed up using your referral code. Once they subscribe to a paid plan, you'll earn your reward!</p>
    <p style="color: #a0a0a0; font-size: 14px; margin-top: 24px;">Keep sharing your code to earn more rewards.</p>
  `;
  return wrapInBase(content);
};

export interface ReferralConvertedEmailData {
  referrerName: string;
  referredTeamName: string;
  plan: string;
}

export const referralConvertedEmail = (data: ReferralConvertedEmailData): string => {
  const planName = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Your Referral Converted!</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Hey ${data.referrerName},</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Great news! <strong style="color: #ffffff;">${data.referredTeamName}</strong> just subscribed to the <strong style="color: #10b981;">${planName}</strong> plan using your referral code.</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Our team will set your reward shortly. Check your referrals page to see your benefits!</p>
  `;
  return wrapInBase(content);
};

export interface ReferralSuccessAdminEmailData {
  referrerTeamName: string;
  referrerEmail: string;
  referredTeamName: string;
  referredEmail: string;
  plan: string;
}

export const referralSuccessAdminEmail = (data: ReferralSuccessAdminEmailData): string => {
  const planName = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">New Referral Conversion</h1>
    <div style="background: #1a1a1a; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="color: #a0a0a0; font-size: 14px; margin: 8px 0;"><strong style="color: #ffffff;">Referrer:</strong> ${data.referrerTeamName} (${data.referrerEmail})</p>
      <p style="color: #a0a0a0; font-size: 14px; margin: 8px 0;"><strong style="color: #ffffff;">Referred:</strong> ${data.referredTeamName} (${data.referredEmail})</p>
      <p style="color: #a0a0a0; font-size: 14px; margin: 8px 0;"><strong style="color: #ffffff;">Plan:</strong> ${planName}</p>
    </div>
    <p style="color: #a0a0a0; font-size: 14px;">Please set the referral reward in the admin dashboard.</p>
  `;
  return wrapInBase(content);
};

export interface ReferralRewardSetEmailData {
  referrerName: string;
  bonusClips: number;
  percentOff: number;
}

export const referralRewardSetEmail = (data: ReferralRewardSetEmailData): string => {
  let rewardText = "";
  if (data.bonusClips > 0 && data.percentOff > 0) {
    rewardText = `${data.bonusClips} bonus clips and ${data.percentOff}% off`;
  } else if (data.bonusClips > 0) {
    rewardText = `${data.bonusClips} bonus clips`;
  } else if (data.percentOff > 0) {
    rewardText = `${data.percentOff}% off your subscription`;
  }

  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Your Referral Reward is Set!</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Hey ${data.referrerName},</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Your referral reward has been set: <strong style="color: #10b981;">${rewardText}</strong></p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Bonus clips will be added on your next subscription renewal. Percent off applies to all future subscription payments!</p>
  `;
  return wrapInBase(content);
};

export interface UgcReadyEmailData {
  userName: string;
  ugcUrl: string;
}

export const ugcReadyEmail = (data: UgcReadyEmailData): string => {
  const frontendUrl = process.env.FRONTEND_URL || "https://platform.cuttr.com";
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Your UGC Video is Ready! 🎉</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Hey ${data.userName},</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Great news! Your face swap video has finished processing and is ready to view.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.ugcUrl}" style="display: inline-block; background: linear-gradient(135deg, #9333EA, #7C3AED); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Your Video</a>
    </div>
    <p style="color: #a0a0a0; font-size: 14px; margin-top: 24px;">You can download your video from the UGC Studio in your dashboard.</p>
  `;
  return wrapInBase(content);
};

export interface MassPostingApprovedEmailData {
  userName: string;
  teamName: string;
  dashboardUrl: string;
  driveFolderUrl: string;
}

export const massPostingApprovedEmail = (data: MassPostingApprovedEmailData): string => {
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">You're Approved for Mass Posting!</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Hey ${data.userName},</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Great news! <strong style="color: #ffffff;">${data.teamName}</strong> has been approved for mass posting. You can now send clips to multiple platforms at once.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #9333EA, #7C3AED); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Go to Dashboard</a>
    </div>
    <p style="color: #a0a0a0; font-size: 14px; margin-top: 24px;">Your Google Drive folder: <a href="${data.driveFolderUrl}" style="color: #9333EA;">${data.driveFolderUrl}</a></p>
  `;
  return wrapInBase(content);
};

export interface AdPostingReadyEmailData {
  userName: string;
  clipTitle: string;
  platforms: string;
  dashboardUrl: string;
}

export const adPostingReadyEmail = (data: AdPostingReadyEmailData): string => {
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Your Clip is Prepared!</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Hey ${data.userName},</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Your clip <strong style="color: #ffffff;">${data.clipTitle}</strong> has been re-encoded and uploaded to Google Drive for the following platforms:</p>
    <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0;">${data.platforms}</p>
    </div>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">It will be posted momentarily. You'll be able to see the live links in your dashboard once posted.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #9333EA, #7C3AED); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View in Dashboard</a>
    </div>
  `;
  return wrapInBase(content);
};
