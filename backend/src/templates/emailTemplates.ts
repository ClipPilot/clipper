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
