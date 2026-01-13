import { Resend } from "resend";
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

  async sendClipsReady(to: string, data: ClipsReadyEmailData) {
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
    const html = ugcReadyEmail(data);
    return this.sendEmailNotification(to, "Your UGC video is ready! 🎉", html);
  }
}

export const emailNotiService = new EmailNotiService();
