import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, gte, inArray } from "drizzle-orm";
import * as schema from "@clipper/shared-db";
import { Resend } from "resend";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import emojiRegex from "emoji-regex";
import * as fs from "fs";
import * as path from "path";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://platform.cuttr.com";
const DEBOUNCE_HOURS = 12;

// Logo loaded once at cold-start for PDF embedding
let logoBase64: string | null = null;
function getLogoBase64(): string | null {
  if (logoBase64 !== null) return logoBase64;
  try {
    // In Lambda: lambda-virality-sync/assets/cuttr-logo.png (relative to dist/)
    const logoPath = path.resolve(__dirname, "../assets/cuttr-logo.png");
    logoBase64 = fs.readFileSync(logoPath).toString("base64");
  } catch {
    console.warn("[Alerts] Could not load logo from assets/cuttr-logo.png");
    logoBase64 = "";
  }
  return logoBase64 || null;
}

interface MetricsEntry {
  recorded_at: string;
  likes: number;
  comments: number;
  views: number | null;
}

interface ViralPost {
  postId: number;
  postUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  platform: string;
  currentViews: number;
  previousViews: number;
  viewsIncrease: number;
  percentIncrease: number;
  likeCount: number;
  commentCount: number;
}

interface ViralAccountResult {
  accountId: number;
  username: string;
  platform: string;
  avatarUrl: string | null;
  viralPosts: ViralPost[];
}

interface ViralCompetitorGroup {
  competitorId: number | null;
  competitorName: string;
  accounts: ViralAccountResult[];
}

/**
 * Detect viral posts for a given account based on the team's viral alert settings.
 */
function detectViralPostsForAccount(
  posts: (typeof schema.viralityPosts.$inferSelect)[],
  settings: typeof schema.viralitySettings.$inferSelect,
  accountUsername: string,
  accountPlatform: string,
  accountAvatarUrl: string | null,
  accountId: number
): ViralAccountResult | null {
  const timeFrameMs = settings.time_frame_hours * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - timeFrameMs).toISOString();

  const viralPosts: ViralPost[] = [];

  for (const post of posts) {
    const history = (post.metrics_history as MetricsEntry[] | null) ?? [];

    // Find the earliest entry within the time frame window
    const entriesInWindow = history.filter((e) => e.recorded_at >= cutoff);

    let prevViews: number;
    let currViews: number;

    if (entriesInWindow.length >= 2) {
      // Normal case: multiple data points in the window
      const earliest = entriesInWindow[0];
      const latest = entriesInWindow[entriesInWindow.length - 1];
      prevViews = earliest.views ?? 0;
      currViews = latest.views ?? 0;
    } else if (entriesInWindow.length === 1) {
      // Only one sync in the window (e.g. freshly added account).
      // Use 0 as baseline only if the post was actually posted within the detection window.
      // Otherwise skip — an old post with one data point has no meaningful growth signal.
      const postedAt = post.posted_at ? new Date(post.posted_at).toISOString() : null;
      if (!postedAt || postedAt < cutoff) continue;
      prevViews = 0;
      currViews = entriesInWindow[0].views ?? 0;
    } else {
      // No data points in window
      continue;
    }

    if (currViews <= prevViews || prevViews < 0) continue;

    const viewsIncrease = currViews - prevViews;

    let isViral = false;

    if (prevViews === 0) {
      // Post was posted within the detection window but we have no prior baseline.
      // Only the absolute threshold is meaningful here — percent growth is undefined.
      isViral = settings.absolute_threshold != null && viewsIncrease >= settings.absolute_threshold;
    } else {
      const percentIncrease = (viewsIncrease / prevViews) * 100;
      const passesPercent = settings.percent_threshold != null && percentIncrease >= settings.percent_threshold;
      const passesAbsolute = settings.absolute_threshold != null && viewsIncrease >= settings.absolute_threshold;

      if (settings.threshold_mode === "and") {
        isViral =
          (settings.percent_threshold != null && settings.absolute_threshold != null)
            ? passesPercent && passesAbsolute
            : passesPercent || passesAbsolute;
      } else {
        isViral = passesPercent || passesAbsolute;
      }
    }

    if (isViral) {
      const percentIncrease = prevViews > 0 ? (viewsIncrease / prevViews) * 100 : 0;
      viralPosts.push({
        postId: post.id,
        postUrl: post.post_url,
        thumbnailUrl: post.thumbnail_url,
        caption: post.caption,
        platform: accountPlatform,
        currentViews: currViews,
        previousViews: prevViews,
        viewsIncrease,
        percentIncrease: Math.round(percentIncrease),
        likeCount: post.like_count ?? 0,
        commentCount: post.comment_count ?? 0,
      });
    }
  }

  if (viralPosts.length === 0) return null;

  return {
    accountId,
    username: accountUsername,
    platform: accountPlatform,
    avatarUrl: accountAvatarUrl,
    viralPosts,
  };
}

/**
 * Check if a viral alert was already sent for this team within the debounce window.
 */
async function wasAlertRecentlySent(
  db: NodePgDatabase<typeof schema>,
  teamId: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - DEBOUNCE_HOURS * 60 * 60 * 1000);
  const [recent] = await db
    .select({ id: schema.viralityAlertLogs.id })
    .from(schema.viralityAlertLogs)
    .where(
      and(
        eq(schema.viralityAlertLogs.team_id, teamId),
        eq(schema.viralityAlertLogs.status, "sent"),
        gte(schema.viralityAlertLogs.sent_at, cutoff)
      )
    )
    .limit(1);
  return !!recent;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X (Twitter)",
};

const MAX_POSTS_PER_COMPETITOR_EMAIL = 8;
const MAX_POSTS_EMAIL = 30;
const MAX_CAPTION_LENGTH = 50;

interface AlertSettings {
  percentThreshold: number | null;
  absoluteThreshold: number | null;
  timeFrameHours: number;
  thresholdMode: string;
}

/**
 * Clean a caption for display: strip hashtags, mentions, newlines, and trim.
 */
function cleanCaption(raw: string | null): string {
  if (!raw) return "No caption";
  let cleaned = raw
    .replace(/\n+/g, " ")
    .replace(/#\S+/g, "")
    .replace(/@\S+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) return "No caption";
  if (cleaned.length > MAX_CAPTION_LENGTH) {
    cleaned = cleaned.substring(0, MAX_CAPTION_LENGTH) + "...";
  }
  return cleaned;
}

/** Strip emoji characters (jsPDF built-in fonts can't render them). */
function stripEmojis(str: string): string {
  return str
    .replace(emojiRegex(), "")
    .replace(/\s{2,}/g, " ")
    .trim() || str;
}

/**
 * Build the settings summary line for email/PDF headers.
 */
function buildSettingsSummary(s: AlertSettings): string {
  const parts: string[] = [];
  if (s.percentThreshold != null) parts.push(`${s.percentThreshold}% growth`);
  if (s.absoluteThreshold != null) parts.push(`${formatNumber(s.absoluteThreshold)} views gained`);
  const mode = parts.length === 2 ? (s.thresholdMode === "and" ? " AND " : " OR ") : "";
  return `${parts.join(mode)} within ${s.timeFrameHours}h`;
}

/**
 * Build the summary email body.
 * Grouped by competitor, shows up to 5 posts per competitor, max 30 total.
 */
function buildSummaryEmail(groups: ViralCompetitorGroup[], teamName: string, alertSettings: AlertSettings): string {
  const totalViralPosts = groups.reduce((s, g) => s + g.accounts.reduce((a, r) => a + r.viralPosts.length, 0), 0);
  const settingsSummary = buildSettingsSummary(alertSettings);

  let postsShown = 0;

  const competitorSections = groups
    .map((group) => {
      if (postsShown >= MAX_POSTS_EMAIL) return "";

      // Flatten all posts for this competitor with account info, sorted by % increase
      const allPosts: { post: ViralPost; username: string; platform: string }[] = [];
      for (const account of group.accounts) {
        for (const post of account.viralPosts) {
          allPosts.push({ post, username: account.username, platform: account.platform });
        }
      }
      allPosts.sort((a, b) => b.post.percentIncrease - a.post.percentIncrease);

      const remaining = MAX_POSTS_EMAIL - postsShown;
      const postsToShow = allPosts.slice(0, Math.min(MAX_POSTS_PER_COMPETITOR_EMAIL, remaining));
      const hiddenCount = allPosts.length - postsToShow.length;
      postsShown += postsToShow.length;

      const postRows = postsToShow
        .map(({ post: p, username, platform }) => {
          const platformLabel = PLATFORM_LABELS[platform] || platform;
          const shortCaption = cleanCaption(p.caption);
          return `
          <tr style="border-bottom: 1px solid #2a2d3e;">
            <td style="padding: 8px 8px 8px 12px; color: #d1d5db; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.postUrl ? `<a href="${p.postUrl}" style="color: #93c5fd; text-decoration: underline;" target="_blank">${shortCaption}</a>` : shortCaption}</td>
            <td style="padding: 8px 6px; color: #9ca3af; font-size: 11px; white-space: nowrap;">@${username}<br/><span style="color:#6b7280;font-size:10px;">${platformLabel}</span></td>
            <td style="padding: 8px 6px; text-align: right; color: #ffffff; font-size: 12px; white-space: nowrap;">${formatNumber(p.currentViews)}</td>
            <td style="padding: 8px 12px 8px 6px; text-align: right; color: #10b981; font-size: 12px; font-weight: 600; white-space: nowrap;">+${p.percentIncrease}%</td>
          </tr>`;
        })
        .join("");

      const hiddenNote =
        hiddenCount > 0
          ? `<tr><td colspan="4" style="padding: 8px 12px; color: #6b7280; font-size: 12px; font-style: italic;">+${hiddenCount} more post${hiddenCount !== 1 ? "s" : ""} in attached report</td></tr>`
          : "";

      const totalCompPosts = allPosts.length;
      const accountCount = group.accounts.length;

      return `
      <div style="margin-bottom: 20px;">
        <div style="padding: 10px 12px; background: #1e2033; border-radius: 6px 6px 0 0;">
          <span style="color: #ffffff; font-weight: 700; font-size: 14px;">${group.competitorName}</span>
          <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">&middot; ${accountCount} account${accountCount !== 1 ? "s" : ""}</span>
          <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">&middot; ${totalCompPosts} viral post${totalCompPosts !== 1 ? "s" : ""}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; background: #141627; table-layout: fixed;">
          <colgroup>
            <col style="width: 40%;" />
            <col style="width: 25%;" />
            <col style="width: 18%;" />
            <col style="width: 17%;" />
          </colgroup>
          <thead>
            <tr style="border-bottom: 1px solid #2a2d3e;">
              <th style="padding: 6px 8px 6px 12px; text-align: left; color: #6b7280; font-size: 10px; font-weight: 600; text-transform: uppercase;">Post</th>
              <th style="padding: 6px 6px; text-align: left; color: #6b7280; font-size: 10px; font-weight: 600; text-transform: uppercase;">Account</th>
              <th style="padding: 6px 6px; text-align: right; color: #6b7280; font-size: 10px; font-weight: 600; text-transform: uppercase;">Views</th>
              <th style="padding: 6px 12px 6px 6px; text-align: right; color: #6b7280; font-size: 10px; font-weight: 600; text-transform: uppercase;">Growth</th>
            </tr>
          </thead>
          <tbody>
            ${postRows}
            ${hiddenNote}
          </tbody>
        </table>
      </div>`;
    })
    .join("");

  // Count overflow posts
  let overflowPostCount = 0;
  let tempCount = 0;
  for (const group of groups) {
    const groupTotal = group.accounts.reduce((s, a) => s + a.viralPosts.length, 0);
    const willShow = Math.min(MAX_POSTS_PER_COMPETITOR_EMAIL, MAX_POSTS_EMAIL - tempCount);
    if (willShow <= 0) {
      overflowPostCount += groupTotal;
    } else {
      const shown = Math.min(groupTotal, willShow);
      overflowPostCount += groupTotal - shown;
      tempCount += shown;
    }
  }

  const overflowNote =
    overflowPostCount > 0
      ? `<p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0 0 8px 0;">
          +${overflowPostCount} more post${overflowPostCount !== 1 ? "s" : ""} in the attached PDF report
        </p>`
      : "";

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; background: #0f1117; color: #ffffff;">
    <div style="padding: 16px 24px; text-align: right; border-bottom: 1px solid #2a2d3e;">
      <img src="${FRONTEND_URL}/branding/cuttr_logo.png" alt="Cuttr" width="100" height="33" style="display: inline-block;" />
    </div>
    <div style="padding: 24px 24px 28px; text-align: center; border-bottom: 1px solid #2a2d3e;">
      <h1 style="color: #ffffff; font-size: 22px; margin: 0 0 8px 0;">Viral Posts Detected 🚨</h1>
      <p style="color: #9ca3af; font-size: 14px; margin: 0 0 12px 0;">
        ${totalViralPosts} post${totalViralPosts !== 1 ? "s" : ""} from ${groups.length} competitor${groups.length !== 1 ? "s" : ""} ${totalViralPosts !== 1 ? "are" : "is"} going viral
      </p>
      <div style="display: inline-block; padding: 6px 14px; background: #1e2033; border-radius: 6px; border: 1px solid #2a2d3e;">
        <span style="color: #6b7280; font-size: 11px;">Detection:</span>
        <span style="color: #d1d5db; font-size: 11px; margin-left: 4px;">${settingsSummary}</span>
      </div>
    </div>

    <div style="padding: 24px 16px;">
      ${competitorSections}
    </div>

    <div style="padding: 0 24px 24px; text-align: center;">
      ${overflowNote}
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 16px 0;">Full report with all posts attached as PDF</p>
    </div>

    <div style="padding: 24px; text-align: center; border-top: 1px solid #2a2d3e;">
      <a href="${FRONTEND_URL}/dashboard/virality" style="display: inline-block; padding: 12px 32px; background: #818cf8; color: #ffffff; font-weight: 600; font-size: 14px; border-radius: 8px; text-decoration: none;">
        View Dashboard
      </a>
    </div>

    <div style="padding: 16px 24px; text-align: center; border-top: 1px solid #2a2d3e;">
      <p style="color: #6b7280; font-size: 11px; margin: 0;">
        Sent to all members of ${teamName}. Adjust settings in your <a href="${FRONTEND_URL}/dashboard/virality" style="color: #818cf8; text-decoration: none;">Virality Dashboard</a>.
      </p>
      <p style="color: #6b7280; font-size: 11px; margin: 8px 0 0 0;">&copy; ${new Date().getFullYear()} Cuttr</p>
    </div>
  </div>`;
}

/**
 * Build a PDF report buffer attached to the email.
 * Full report: every viral post grouped by competitor with views, growth, links.
 * Uses a clean light theme so content is always visible.
 */
function buildPdfReport(groups: ViralCompetitorGroup[], teamName: string, alertSettings: AlertSettings): Buffer {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const totalViralPosts = groups.reduce((s, g) => s + g.accounts.reduce((a, r) => a + r.viralPosts.length, 0), 0);
  const settingsSummary = buildSettingsSummary(alertSettings);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Colors
  const brandPurple: [number, number, number] = [99, 102, 241]; // #6366f1
  const green: [number, number, number] = [16, 163, 116]; // #10a374
  const darkText: [number, number, number] = [17, 24, 39]; // #111827
  const grayText: [number, number, number] = [107, 114, 128]; // #6b7280
  const headerBg: [number, number, number] = [243, 244, 246]; // #f3f4f6
  const stripeBg: [number, number, number] = [249, 250, 251]; // #f9fafb

  // Logo top-right + Header
  let y = 40;
  const logo = getLogoBase64();
  if (logo) {
    const logoW = 80;
    const logoH = 27;
    doc.addImage(`data:image/png;base64,${logo}`, "PNG", pageWidth - 40 - logoW, 20, logoW, logoH);
  }

  doc.setFontSize(18);
  doc.setTextColor(...darkText);
  doc.text("Viral Alert Report", 40, y);

  y += 16;
  doc.setFontSize(9);
  doc.setTextColor(...grayText);
  doc.text(
    `${teamName}  |  ${date}  |  ${totalViralPosts} viral post${totalViralPosts !== 1 ? "s" : ""} across ${groups.length} competitor${groups.length !== 1 ? "s" : ""}`,
    40,
    y
  );

  y += 12;
  doc.setFontSize(8);
  doc.setTextColor(...grayText);
  doc.text(`Detection: ${settingsSummary}`, 40, y);

  y += 10;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(40, y, pageWidth - 40, y);
  y += 16;

  // Per-competitor sections
  for (const group of groups) {
    // Flatten all posts for this competitor with account info
    const allPosts: { post: ViralPost; username: string; platform: string }[] = [];
    for (const account of group.accounts) {
      for (const post of account.viralPosts) {
        allPosts.push({ post, username: account.username, platform: account.platform });
      }
    }
    allPosts.sort((a, b) => b.post.percentIncrease - a.post.percentIncrease);

    const totalCompPosts = allPosts.length;
    const accountCount = group.accounts.length;

    // Check if we need a new page for the header + at least one row
    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      y = 40;
    }

    // Competitor header
    doc.setFontSize(13);
    doc.setTextColor(...darkText);
    doc.text(group.competitorName, 44, y);

    const actualWidth = doc.getTextWidth(group.competitorName);
    doc.setFontSize(9);
    doc.setTextColor(...grayText);
    doc.text(
      `${accountCount} account${accountCount !== 1 ? "s" : ""}  •  ${totalCompPosts} viral post${totalCompPosts !== 1 ? "s" : ""}`,
      44 + actualWidth + 10,
      y
    );

    y += 14;

    // Build table rows — every post with account, platform, and post URL
    const tableBody = allPosts.map(({ post: p, username, platform }) => {
      const platformLabel = PLATFORM_LABELS[platform] || platform;
      return [
        stripEmojis(cleanCaption(p.caption)),
        `@${username}`,
        platformLabel,
        formatNumber(p.currentViews),
        `+${p.percentIncrease}%`,
        `+${formatNumber(p.viewsIncrease)}`,
        formatNumber(p.likeCount),
        p.postUrl ? p.postUrl : "-",
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: 40, right: 40 },
      head: [["Post", "Account", "Platform", "Views", "Growth", "Gained", "Likes", "Link"]],
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 8,
        textColor: darkText,
        cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
        lineColor: [229, 231, 235] as [number, number, number],
        lineWidth: 0.5,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: headerBg,
        textColor: grayText,
        fontSize: 7.5,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: stripeBg,
      },
      columnStyles: {
        0: { cellWidth: "auto" }, // Caption
        1: { cellWidth: 70 }, // Account
        2: { cellWidth: 52 }, // Platform
        3: { cellWidth: 48, halign: "right" }, // Views
        4: { cellWidth: 44, halign: "right", textColor: green, fontStyle: "bold" }, // Growth %
        5: { cellWidth: 48, halign: "right" }, // Gained
        6: { cellWidth: 38, halign: "right" }, // Likes
        7: { cellWidth: 110, textColor: brandPurple, fontSize: 7 }, // Link
      },
      // Make link cells clickable
      didDrawCell: (data: any) => {
        if (data.section === "body" && data.column.index === 7) {
          const url = data.cell.raw as string;
          if (url && url !== "-") {
            doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 24;
  }

  // Footer
  if (y > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    y = 40;
  }
  doc.setDrawColor(229, 231, 235);
  doc.line(40, y, pageWidth - 40, y);
  y += 16;

  doc.setFontSize(9);
  doc.setTextColor(...brandPurple);
  doc.textWithLink("View in Dashboard", pageWidth / 2, y, {
    url: `${FRONTEND_URL}/dashboard/virality`,
    align: "center",
  });

  y += 14;
  doc.setFontSize(7);
  doc.setTextColor(...grayText);
  doc.text(`© ${new Date().getFullYear()} Cuttr`, pageWidth / 2, y, { align: "center" });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

/**
 * Consolidated viral alert check for a single team.
 * Checks all alert-enabled accounts, detects viral posts, and sends one email.
 */
export async function checkAndSendViralAlertsForTeam(
  db: NodePgDatabase<typeof schema>,
  teamId: number
): Promise<void> {
  // 1. Fetch team's viral alert settings
  const [settings] = await db
    .select()
    .from(schema.viralitySettings)
    .where(eq(schema.viralitySettings.team_id, teamId))
    .limit(1);

  if (!settings) {
    console.log(`[Alerts] No viral settings for team=${teamId}, skipping`);
    return;
  }

  // 2. Check debounce — skip if alert was sent recently
  if (await wasAlertRecentlySent(db, teamId)) {
    console.log(`[Alerts] Alert already sent for team=${teamId} within ${DEBOUNCE_HOURS}h, skipping`);
    return;
  }

  // 3. Fetch all alert-enabled accounts for this team
  const alertAccounts = await db
    .select()
    .from(schema.viralityAccounts)
    .where(
      and(
        eq(schema.viralityAccounts.team_id, teamId),
        eq(schema.viralityAccounts.alert_enabled, true),
        eq(schema.viralityAccounts.is_active, true)
      )
    );

  if (alertAccounts.length === 0) {
    return;
  }

  // 4. Batch-fetch all posts for alert-enabled accounts, then detect viral ones
  const accountIds = alertAccounts.map((a) => a.id);
  const allPosts = await db
    .select()
    .from(schema.viralityPosts)
    .where(inArray(schema.viralityPosts.account_id, accountIds));

  const postsByAccountId = new Map<number, (typeof allPosts)[number][]>();
  for (const post of allPosts) {
    const bucket = postsByAccountId.get(post.account_id) ?? [];
    bucket.push(post);
    postsByAccountId.set(post.account_id, bucket);
  }

  const viralResults: ViralAccountResult[] = [];

  for (const acc of alertAccounts) {
    const posts = postsByAccountId.get(acc.id) ?? [];

    const result = detectViralPostsForAccount(
      posts,
      settings,
      acc.username,
      acc.platform,
      acc.avatar_url,
      acc.id
    );

    if (result) {
      viralResults.push(result);
    }
  }

  if (viralResults.length === 0) {
    console.log(`[Alerts] No viral posts detected for team=${teamId}`);
    return;
  }

  const allViralPostIds = viralResults.flatMap((r) => r.viralPosts.map((p) => p.postId));
  console.log(`[Alerts] Found ${allViralPostIds.length} viral posts across ${viralResults.length} accounts for team=${teamId}`);

  // 5. Fetch team info and members
  const [team] = await db
    .select({ id: schema.teams.id, name: schema.teams.name })
    .from(schema.teams)
    .where(eq(schema.teams.id, teamId))
    .limit(1);

  const teamName = team?.name || "your team";

  const members = await db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.users, eq(schema.teamMembers.user_id, schema.users.id))
    .where(eq(schema.teamMembers.team_id, teamId));

  if (members.length === 0) {
    console.log(`[Alerts] No team members found for team=${teamId}`);
    return;
  }

  // Sort viral posts within each account by % increase (highest first)
  for (const result of viralResults) {
    result.viralPosts.sort((a, b) => b.percentIncrease - a.percentIncrease);
  }

  // 5b. Group results by competitor
  // Build a map of accountId → competitor_id from the alertAccounts we already fetched
  const accountCompetitorMap = new Map<number, number | null>();
  for (const acc of alertAccounts) {
    accountCompetitorMap.set(acc.id, acc.competitor_id);
  }

  // Fetch competitor names — just get all competitors for this team (cheap single query)
  const competitorNameMap = new Map<number, string>();
  const allCompetitors = await db
    .select({ id: schema.viralityCompetitors.id, name: schema.viralityCompetitors.name })
    .from(schema.viralityCompetitors)
    .where(eq(schema.viralityCompetitors.team_id, teamId));
  for (const c of allCompetitors) {
    competitorNameMap.set(c.id, c.name);
  }

  // Group viral results by competitor
  const groupMap = new Map<number | null, ViralAccountResult[]>();
  for (const result of viralResults) {
    const compId = accountCompetitorMap.get(result.accountId) ?? null;
    if (!groupMap.has(compId)) groupMap.set(compId, []);
    groupMap.get(compId)!.push(result);
  }

  const competitorGroups: ViralCompetitorGroup[] = [];
  for (const [compId, accounts] of groupMap) {
    competitorGroups.push({
      competitorId: compId,
      competitorName: compId != null ? (competitorNameMap.get(compId) || "Unknown Competitor") : "Ungrouped",
      accounts,
    });
  }
  // Sort: named competitors first, ungrouped last
  competitorGroups.sort((a, b) => {
    if (a.competitorId == null && b.competitorId != null) return 1;
    if (a.competitorId != null && b.competitorId == null) return -1;
    return a.competitorName.localeCompare(b.competitorName);
  });

  // 6. Build summary email + PDF report attachment
  const alertSettings: AlertSettings = {
    percentThreshold: settings.percent_threshold,
    absoluteThreshold: settings.absolute_threshold,
    timeFrameHours: settings.time_frame_hours,
    thresholdMode: settings.threshold_mode,
  };
  let emailHtml: string | null = buildSummaryEmail(competitorGroups, teamName, alertSettings);
  let pdfBuffer: Buffer | null = buildPdfReport(competitorGroups, teamName, alertSettings);
  const reportDate = new Date().toISOString().split("T")[0];
  const subject = `🚨 ${allViralPostIds.length} viral post${allViralPostIds.length !== 1 ? "s" : ""} detected from your competitors`;

  // 7. Build a lightweight summary for the alert log (avoid storing full HTML)
  const logSummary = `${allViralPostIds.length} viral post(s) across ${competitorGroups.length} competitor(s): ${competitorGroups.map((g) => `${g.competitorName} (${g.accounts.reduce((s, a) => s + a.viralPosts.length, 0)} posts)`).join(", ")}`;

  // 8. Send emails and log
  const resend = new Resend(RESEND_API_KEY);

  for (const member of members) {
    try {
      await resend.emails.send({
        from: "Cuttr <no-reply@mail.cuttr.com>",
        to: member.email,
        subject,
        html: emailHtml!,
        attachments: [
          {
            filename: `viral-report-${reportDate}.pdf`,
            content: pdfBuffer!,
          },
        ],
      });

      await db.insert(schema.viralityAlertLogs).values({
        team_id: teamId,
        user_id: member.userId,
        email: member.email,
        subject,
        email_body: logSummary,
        viral_post_ids: allViralPostIds,
        status: "sent",
        sent_at: new Date(),
      });

      console.log(`[Alerts] Email sent to ${member.email} for team=${teamId}`);
    } catch (err: any) {
      console.error(`[Alerts] Failed to send email to ${member.email}:`, err.message);

      await db.insert(schema.viralityAlertLogs).values({
        team_id: teamId,
        user_id: member.userId,
        email: member.email,
        subject,
        email_body: logSummary,
        viral_post_ids: allViralPostIds,
        status: "failed",
        error_message: err.message || "Unknown error",
        sent_at: new Date(),
      });
    }
  }

  // Release large buffers so GC can reclaim memory between teams
  emailHtml = null;
  pdfBuffer = null;
}

/**
 * Main entry point: called by the reporter Lambda after ALL account syncs complete.
 * Collects unique team IDs from the sync results, then checks and sends
 * one consolidated viral alert email per team.
 */
export async function checkAndSendViralAlertsForTeams(
  db: NodePgDatabase<typeof schema>,
  teamIds: number[]
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log("[Alerts] RESEND_API_KEY not configured, skipping viral alerts");
    return;
  }

  console.log(`[Alerts] Checking viral alerts for ${teamIds.length} teams: ${teamIds.join(", ")}`);

  for (const teamId of teamIds) {
    try {
      await checkAndSendViralAlertsForTeam(db, teamId);
    } catch (err: any) {
      console.error(`[Alerts] Error processing team=${teamId}:`, err.message);
    }
  }
}
