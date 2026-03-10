import { Resend } from "resend";
import { db } from "../db";
import { users } from "@clipper/shared-db/src/schema";
import { eq } from "drizzle-orm";
import {
  teamInviteEmail,
  TeamInviteEmailData,
  subscriptionWelcomeEmail,
  SubscriptionWelcomeEmailData,
  subscriptionCancelledEmail,
  SubscriptionCancelledEmailData,
  paymentFailedEmail,
  PaymentFailedEmailData,
  subscriptionRenewalEmail,
  SubscriptionRenewalEmailData,
  clipsReadyEmail,
  ClipsReadyEmailData,
  admin2faEmail,
  Admin2FAEmailData,
  referralAppliedEmail,
  ReferralAppliedEmailData,
  referralConvertedEmail,
  ReferralConvertedEmailData,
  referralSuccessAdminEmail,
  ReferralSuccessAdminEmailData,
  referralRewardSetEmail,
  ReferralRewardSetEmailData,
  ugcReadyEmail,
  UgcReadyEmailData,
  massPostingApprovedEmail,
  MassPostingApprovedEmailData,
  massPostingRejectedEmail,
  MassPostingRejectedEmailData,
  adPostingReadyEmail,
  AdPostingReadyEmailData,
  campaignStartedEmail,
  CampaignStartedEmailData,
  contractSignedEmail,
  ContractSignedEmailData,
  campaignPausedEmail,
  CampaignPausedEmailData,
} from "../templates/emailTemplates";

export class EmailNotiService {
  static resend = new Resend(process.env.RESEND_API_KEY!);
  private fromEmail = "Cuttr <no-reply@mail.cuttr.com>";

  async sendEmailNotification(to: string, subject: string, body: string) {
    const { data, error } = await EmailNotiService.resend.emails.send({
      from: this.fromEmail,
      to: [to],
      subject: subject,
      html: body,
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
  }

  async sendTeamInvite(to: string, data: TeamInviteEmailData) {
    const html = teamInviteEmail(data);
    return this.sendEmailNotification(
      to,
      `${data.inviterName} invited you to join ${data.teamName} on Cuttr`,
      html
    );
  }

  async sendSubscriptionWelcome(to: string, data: SubscriptionWelcomeEmailData) {
    const html = subscriptionWelcomeEmail(data);
    return this.sendEmailNotification(
      to,
      `Welcome to Cuttr ${data.planName}!`,
      html
    );
  }

  async sendSubscriptionCancelled(to: string, data: SubscriptionCancelledEmailData) {
    const html = subscriptionCancelledEmail(data);
    return this.sendEmailNotification(
      to,
      `Your Cuttr subscription has been cancelled`,
      html
    );
  }

  async sendPaymentFailed(to: string, data: PaymentFailedEmailData) {
    const html = paymentFailedEmail(data);
    return this.sendEmailNotification(
      to,
      `Action required: Payment failed for ${data.teamName}`,
      html
    );
  }

  async sendSubscriptionRenewal(to: string, data: SubscriptionRenewalEmailData) {
    const html = subscriptionRenewalEmail(data);
    return this.sendEmailNotification(
      to,
      `Your Cuttr subscription has been renewed`,
      html
    );
  }

  async isNotificationEnabled(email: string): Promise<boolean> {
    try {
      const [user] = await db
        .select({ enabled: users.email_notifications_enabled })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!user) return false;
      return user.enabled === true;
    } catch (err) {
      console.error(`[EmailNoti] Failed to check notification preference for ${email}:`, err);
      return false;
    }
  }

  async sendClipsReady(to: string, data: ClipsReadyEmailData) {
    if (!(await this.isNotificationEnabled(to))) return;
    const html = clipsReadyEmail(data);
    const subject = data.clipCount > 1
      ? `Your ${data.clipCount} clips are ready!`
      : `Your clip is ready!`;
    return this.sendEmailNotification(to, subject, html);
  }

  async sendAdmin2FACode(to: string, data: Admin2FAEmailData) {
    const html = admin2faEmail(data);
    return this.sendEmailNotification(to, "Your Cuttr Admin Verification Code", html);
  }

  async sendReferralApplied(to: string, data: ReferralAppliedEmailData) {
    const html = referralAppliedEmail(data);
    return this.sendEmailNotification(to, "Someone used your referral code!", html);
  }

  async sendReferralConverted(to: string, data: ReferralConvertedEmailData) {
    const html = referralConvertedEmail(data);
    return this.sendEmailNotification(to, "Your referral converted to a paid plan!", html);
  }

  async sendReferralSuccess(to: string, data: ReferralSuccessAdminEmailData) {
    const html = referralSuccessAdminEmail(data);
    return this.sendEmailNotification(to, `New Referral: ${data.referredTeamName} → ${data.plan}`, html);
  }

  async sendReferralRewardSet(to: string, data: ReferralRewardSetEmailData) {
    const html = referralRewardSetEmail(data);
    return this.sendEmailNotification(to, "Your referral reward has been set!", html);
  }

  async sendUgcReady(to: string, data: UgcReadyEmailData) {
    if (!(await this.isNotificationEnabled(to))) return;
    const html = ugcReadyEmail(data);
    return this.sendEmailNotification(to, "Your UGC video is ready! 🎉", html);
  }

  async sendMassPostingApproved(to: string, data: MassPostingApprovedEmailData) {
    const html = massPostingApprovedEmail(data);
    return this.sendEmailNotification(to, `${data.teamName} is approved for Mass Posting!`, html);
  }

  async sendMassPostingRejected(to: string, data: MassPostingRejectedEmailData) {
    const html = massPostingRejectedEmail(data);
    return this.sendEmailNotification(to, `Update on your Mass Posting application`, html);
  }

  async sendAdPostingReady(to: string, data: AdPostingReadyEmailData) {
    if (!(await this.isNotificationEnabled(to))) return;
    const html = adPostingReadyEmail(data);
    return this.sendEmailNotification(to, "Your clip is prepared and will be posted momentarily!", html);
  }

  async sendCampaignStarted(to: string, data: CampaignStartedEmailData) {
    const html = campaignStartedEmail(data);
    return this.sendEmailNotification(to, `Campaign "${data.campaignName}" is live!`, html);
  }

  async sendContractSigned(to: string, data: ContractSignedEmailData) {
    const html = contractSignedEmail(data);
    return this.sendEmailNotification(to, `Contract signed for ${data.campaignName}`, html);
  }

  async sendCampaignPaused(to: string, data: CampaignPausedEmailData) {
    const html = campaignPausedEmail(data);
    return this.sendEmailNotification(to, `Campaign "${data.campaignName}" has been paused — payment failed`, html);
  }
}

export const emailNotiService = new EmailNotiService();
