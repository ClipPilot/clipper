const BASE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cuttr</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a14;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #0f0f1a; border-radius: 12px; border: 1px solid #27272a;">
          <tr>
            <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #27272a;">
              <img src="{{FRONTEND_URL}}/branding/cuttr_logo.png" alt="Cuttr" width="120" height="40" style="display: inline-block; vertical-align: middle;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              {{CONTENT}}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #27272a; background-color: #16161f; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #71717a; font-size: 12px; line-height: 1.5; text-align: center;">
                This email was sent by Cuttr. If you didn't request this, you can safely ignore it.
              </p>
              <p style="margin: 12px 0 0 0; color: #71717a; font-size: 12px; line-height: 1.5; text-align: center;">
                &copy; {{YEAR}} Cuttr. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export function wrapInBase(content: string, frontendUrl?: string): string {
  const url = frontendUrl || process.env.FRONTEND_URL || "https://platform.cuttr.com";
  return BASE_TEMPLATE
    .replace("{{CONTENT}}", content)
    .replace("{{YEAR}}", new Date().getFullYear().toString())
    .replace(/{{FRONTEND_URL}}/g, url);
}

// ── Team Invite ──

export interface TeamInviteEmailData {
  inviterName: string;
  teamName: string;
  inviteUrl: string;
  role: string;
  expiresIn: string;
}

export const teamInviteEmail = (data: TeamInviteEmailData): string => {
  const content = `<h1 style="margin: 0 0 16px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
  You've been invited to join a workspace
</h1>
<p style="margin: 0 0 24px 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
  <strong style="color: #ffffff;">${data.inviterName}</strong> has invited you to join
  <strong style="color: #ffffff;">${data.teamName}</strong> on Cuttr as a <strong style="color: #4F47E6;">${data.role}</strong>.
</p>
<div style="background-color: #16161f; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #27272a;">
  <p style="margin: 0; color: #a1a1aa; font-size: 14px;">
    <strong style="color: #ffffff;">What you'll get access to:</strong>
  </p>
  <ul style="margin: 12px 0 0 0; padding-left: 20px; color: #a1a1aa; font-size: 14px; line-height: 1.8;">
    <li>Create and edit video clips with the team</li>
    <li>Access shared clip library and folders</li>
    <li>Collaborate with team members in real-time</li>
  </ul>
</div>
<div style="text-align: center; margin-bottom: 24px;">
  <a href="${data.inviteUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4F47E6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
    Accept Invitation
  </a>
</div>
<p style="margin: 0; color: #71717a; font-size: 13px; text-align: center;">
  This invitation expires in ${data.expiresIn}. If you don't have a Cuttr account yet, you'll be prompted to create one.
</p>`;
  return wrapInBase(content);
};

// ── Subscription Welcome ──

export interface SubscriptionWelcomeEmailData {
  userName: string;
  planName: string;
  teamName: string;
  clipsLimit: number;
  dashboardUrl: string;
}

export const subscriptionWelcomeEmail = (data: SubscriptionWelcomeEmailData): string => {
  const clipsText = data.clipsLimit === -1 ? "Unlimited" : data.clipsLimit.toString();
  const content = `<h1 style="margin: 0 0 16px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
  Welcome to Cuttr ${data.planName}!
</h1>
<p style="margin: 0 0 24px 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
  Hey ${data.userName}, thank you for upgrading <strong style="color: #ffffff;">${data.teamName}</strong> to the <strong style="color: #4F47E6;">${data.planName}</strong> plan!
</p>
<div style="background-color: #16161f; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #27272a;">
  <p style="margin: 0 0 12px 0; color: #ffffff; font-size: 14px; font-weight: 600;">
    Your new plan includes:
  </p>
  <ul style="margin: 0; padding-left: 20px; color: #a1a1aa; font-size: 14px; line-height: 1.8;">
    <li><strong style="color: #22c55e;">${clipsText}</strong> clips per month</li>
    <li>Priority video processing</li>
    <li>Team collaboration features</li>
    <li>Advanced caption customization</li>
  </ul>
</div>
<div style="text-align: center; margin-bottom: 24px;">
  <a href="${data.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4F47E6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
    Go to Dashboard
  </a>
</div>
<p style="margin: 0; color: #71717a; font-size: 13px; text-align: center;">
  Need help? Reply to this email and we'll be happy to assist.
</p>`;
  return wrapInBase(content);
};

// ── Subscription Cancelled ──

export interface SubscriptionCancelledEmailData {
  userName: string;
  teamName: string;
  endDate: string;
  reactivateUrl: string;
}

export const subscriptionCancelledEmail = (data: SubscriptionCancelledEmailData): string => {
  const content = `<h1 style="margin: 0 0 16px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
  Your subscription has been cancelled
</h1>
<p style="margin: 0 0 24px 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
  Hey ${data.userName}, we're sorry to see you go. Your <strong style="color: #ffffff;">${data.teamName}</strong> subscription has been cancelled.
</p>
<div style="background-color: #16161f; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #27272a;">
  <p style="margin: 0; color: #a1a1aa; font-size: 14px;">
    <strong style="color: #f59e0b;">Important:</strong> Your workspace will revert to the free plan on <strong style="color: #ffffff;">${data.endDate}</strong>. After that:
  </p>
  <ul style="margin: 12px 0 0 0; padding-left: 20px; color: #a1a1aa; font-size: 14px; line-height: 1.8;">
    <li>You'll be limited to 3 clips per month</li>
    <li>Team members won't be able to access the workspace</li>
    <li>Your existing clips will remain safe</li>
  </ul>
</div>
<div style="text-align: center; margin-bottom: 24px;">
  <a href="${data.reactivateUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4F47E6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
    Reactivate Subscription
  </a>
</div>
<p style="margin: 0; color: #71717a; font-size: 13px; text-align: center;">
  Changed your mind? You can reactivate anytime before ${data.endDate}.
</p>`;
  return wrapInBase(content);
};

// ── Payment Failed ──

export interface PaymentFailedEmailData {
  userName: string;
  teamName: string;
  amount: string;
  retryDate: string;
  updatePaymentUrl: string;
}

export const paymentFailedEmail = (data: PaymentFailedEmailData): string => {
  const content = `<h1 style="margin: 0 0 16px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
  Payment failed for your subscription
</h1>
<p style="margin: 0 0 24px 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
  Hey ${data.userName}, we couldn't process the payment of <strong style="color: #ffffff;">${data.amount}</strong> for <strong style="color: #ffffff;">${data.teamName}</strong>.
</p>
<div style="background-color: rgba(239, 68, 68, 0.1); border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #ef4444;">
  <p style="margin: 0; color: #a1a1aa; font-size: 14px;">
    <strong style="color: #ef4444;">Action required:</strong> Please update your payment method to avoid service interruption. We'll automatically retry on <strong style="color: #ffffff;">${data.retryDate}</strong>.
  </p>
</div>
<div style="text-align: center; margin-bottom: 24px;">
  <a href="${data.updatePaymentUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4F47E6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
    Update Payment Method
  </a>
</div>
<p style="margin: 0; color: #71717a; font-size: 13px; text-align: center;">
  If you believe this is an error, please contact your bank or reach out to us.
</p>`;
  return wrapInBase(content);
};

// ── Subscription Renewal ──

export interface SubscriptionRenewalEmailData {
  userName: string;
  teamName: string;
  planName: string;
  amount: string;
  renewalDate: string;
  manageUrl: string;
}

export const subscriptionRenewalEmail = (data: SubscriptionRenewalEmailData): string => {
  const content = `<h1 style="margin: 0 0 16px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
  Your subscription has been renewed
</h1>
<p style="margin: 0 0 24px 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
  Hey ${data.userName}, your <strong style="color: #4F47E6;">${data.planName}</strong> subscription for <strong style="color: #ffffff;">${data.teamName}</strong> has been successfully renewed.
</p>
<div style="background-color: #16161f; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #27272a;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="color: #a1a1aa; font-size: 14px; padding-bottom: 8px;">Amount charged</td>
      <td style="color: #ffffff; font-size: 14px; font-weight: 600; text-align: right; padding-bottom: 8px;">${data.amount}</td>
    </tr>
    <tr>
      <td style="color: #a1a1aa; font-size: 14px;">Next renewal</td>
      <td style="color: #ffffff; font-size: 14px; font-weight: 600; text-align: right;">${data.renewalDate}</td>
    </tr>
  </table>
</div>
<div style="text-align: center; margin-bottom: 24px;">
  <a href="${data.manageUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4F47E6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
    Manage Subscription
  </a>
</div>
<p style="margin: 0; color: #71717a; font-size: 13px; text-align: center;">
  Your clips have been reset for the new billing period. Happy clipping!
</p>`;
  return wrapInBase(content);
};

// ── Clips Ready ──

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
  const content = `<h1 style="margin: 0 0 16px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
  Your clips are ready!
</h1>
<p style="margin: 0 0 24px 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
  Hey ${data.userName}, great news! Your <strong style="color: #22c55e;">${data.clipCount} clip${plural}</strong> ${have} finished processing and ${are} ready to view.
</p>
<div style="background-color: #16161f; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #27272a;">
  <p style="margin: 0 0 12px 0; color: #ffffff; font-size: 14px; font-weight: 600;">
    What's next?
  </p>
  <ul style="margin: 0; padding-left: 20px; color: #a1a1aa; font-size: 14px; line-height: 1.8;">
    <li>Preview your clips with watermarks</li>
    <li>Edit captions and styling</li>
    <li>Download in high quality</li>
    <li>Share directly to social media</li>
  </ul>
</div>
<div style="text-align: center; margin-bottom: 24px;">
  <a href="${data.clipsUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4F47E6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
    View Your Clips
  </a>
</div>
<p style="margin: 0; color: #71717a; font-size: 13px; text-align: center;">
  Clips processed from: ${data.sourceFileName}
</p>`;
  return wrapInBase(content);
};

// ── Admin 2FA ──

export interface Admin2FAEmailData {
  code: string;
}

export const admin2faEmail = (data: Admin2FAEmailData): string => {
  const content = `<h1 style="margin: 0 0 24px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
  Admin Verification Code
</h1>
<p style="margin: 0 0 24px 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
  Your verification code for Cuttr Admin access is:
</p>
<div style="background-color: #16161f; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px 0; border: 1px solid #10b981;">
  <span style="color: #10b981; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">
    ${data.code}
  </span>
</div>
<p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
  This code will expire in <strong style="color: #ffffff;">15 minutes</strong>.
</p>
<p style="margin: 0 0 24px 0; color: #71717a; font-size: 14px; line-height: 1.6;">
  If you didn't attempt to log in to the admin dashboard, please ignore this email or contact support immediately.
</p>
<div style="background-color: #16161f; border-radius: 8px; padding: 16px; margin-top: 24px;">
  <p style="margin: 0; color: #71717a; font-size: 12px; line-height: 1.5;">
    <strong style="color: #a1a1aa;">Security Notice:</strong> Never share this code with anyone. Cuttr staff will never ask for your verification code.
  </p>
</div>`;
  return wrapInBase(content);
};

// ── Referral Applied ──

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

// ── Referral Converted ──

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

// ── Referral Success Admin ──

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

// ── Referral Reward Set ──

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

// ── UGC Ready ──

export interface UgcReadyEmailData {
  userName: string;
  ugcUrl: string;
}

export const ugcReadyEmail = (data: UgcReadyEmailData): string => {
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Your UGC Video is Ready!</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Hey ${data.userName},</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Great news! Your face swap video has finished processing and is ready to view.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.ugcUrl}" style="display: inline-block; background: linear-gradient(135deg, #9333EA, #7C3AED); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Your Video</a>
    </div>
    <p style="color: #a0a0a0; font-size: 14px; margin-top: 24px;">You can download your video from the UGC Studio in your dashboard.</p>
  `;
  return wrapInBase(content);
};

// ── Mass Posting Approved ──

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

// ── Mass Posting Rejected ──

export interface MassPostingRejectedEmailData {
  userName: string;
  teamName: string;
  rejectionReason: string;
  reapplyUrl: string;
}

export const massPostingRejectedEmail = (data: MassPostingRejectedEmailData): string => {
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Mass Posting Application Update</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Hey ${data.userName},</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Thank you for applying for mass posting. After reviewing your application for <strong style="color: #ffffff;">${data.teamName}</strong>, we're unable to approve it at this time.</p>
    <div style="background: #1a1a1a; border-left: 3px solid #ef4444; border-radius: 4px; padding: 16px; margin: 24px 0;">
      <p style="color: #a0a0a0; font-size: 13px; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.05em;">Reason</p>
      <p style="color: #ffffff; font-size: 15px; margin: 0;">${data.rejectionReason}</p>
    </div>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">You're welcome to update your application and reapply at any time.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.reapplyUrl}" style="display: inline-block; background: linear-gradient(135deg, #9333EA, #7C3AED); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Update & Reapply</a>
    </div>
  `;
  return wrapInBase(content);
};

// ── Ad Posting Ready ──

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

// ── Campaign Started ──

export interface CampaignStartedEmailData {
  userName: string;
  teamName: string;
  campaignName: string;
  dashboardUrl: string;
}

export const campaignStartedEmail = (data: CampaignStartedEmailData): string => {
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Your Campaign is Live!</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Hey ${data.userName},</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Great news! Your campaign <strong style="color: #ffffff;">${data.campaignName}</strong> for <strong style="color: #ffffff;">${data.teamName}</strong> is now live. Your videos will start being distributed across our network.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #9333EA, #7C3AED); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Campaign</a>
    </div>
  `;
  return wrapInBase(content);
};

// ── Contract Signed ──

export interface ContractSignedEmailData {
  userName: string;
  teamName: string;
  campaignName: string;
  signerName: string;
  signedDate: string;
}

export const contractSignedEmail = (data: ContractSignedEmailData): string => {
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Contract Signed</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">The contract for campaign <strong style="color: #ffffff;">${data.campaignName}</strong> has been signed.</p>
    <div style="background: #1a1a1a; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="color: #a0a0a0; font-size: 14px; margin: 8px 0;"><strong style="color: #ffffff;">Team:</strong> ${data.teamName}</p>
      <p style="color: #a0a0a0; font-size: 14px; margin: 8px 0;"><strong style="color: #ffffff;">Signed by:</strong> ${data.signerName}</p>
      <p style="color: #a0a0a0; font-size: 14px; margin: 8px 0;"><strong style="color: #ffffff;">Date:</strong> ${data.signedDate}</p>
    </div>
  `;
  return wrapInBase(content);
};

// ── Campaign Paused ──

export interface CampaignPausedEmailData {
  userName: string;
  teamName: string;
  campaignName: string;
  failureReason: string;
  dashboardUrl: string;
  isAdmin?: boolean;
}

export const campaignPausedEmail = (data: CampaignPausedEmailData): string => {
  const adminContext = data.isAdmin
    ? `<p style="color: #a0a0a0; font-size: 14px; margin-top: 16px;"><strong style="color: #ffffff;">Team:</strong> ${data.teamName}</p>`
    : "";
  const content = `
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 16px;">Campaign Paused</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Hey ${data.userName},</p>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">Your campaign <strong style="color: #ffffff;">${data.campaignName}</strong> has been paused because the daily CPM billing charge could not be processed.</p>
    <div style="background: #1a1a1a; border-left: 3px solid #ef4444; border-radius: 4px; padding: 16px; margin: 24px 0;">
      <p style="color: #a0a0a0; font-size: 13px; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.05em;">Reason</p>
      <p style="color: #ffffff; font-size: 15px; margin: 0;">${data.failureReason}</p>
    </div>
    ${adminContext}
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">To resume your campaign, please update your payment method or top up your wallet, then contact support.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #9333EA, #7C3AED); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Campaign</a>
    </div>
  `;
  return wrapInBase(content);
};
