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
}

export const emailNotiService = new EmailNotiService();
