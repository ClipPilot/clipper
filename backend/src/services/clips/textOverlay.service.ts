import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import puppeteer from "puppeteer";
import path from "path";
import { MOBILE_VIDEO_SETTINGS } from "../../config/ffmpegSettings";
import { getVideoMetadata } from "./videoEditor.utils";
import { FONT_CONFIG, EMOJI_FONT } from "../../config/fonts.config";
import type { FontConfig } from "../../config/fonts.config";

const MAC_RENDERER_URL = process.env.MAC_RENDERER_URL || "";

export async function renderHtmlToPng(
  html: string,
  outputPath: string,
  opts: { width?: number; height?: number; deviceScaleFactor?: number } = {},
): Promise<void> {
  const { width = 1080, height = 400, deviceScaleFactor = 1 } = opts;

  if (MAC_RENDERER_URL) {
    try {
      const response = await fetch(`${MAC_RENDERER_URL}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, width, height, deviceScaleFactor }),
        signal: AbortSignal.timeout(15_000),
      });

      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        console.log(`[renderHtmlToPng] Rendered via Mac renderer`);
        return;
      }
      console.warn(
        `[renderHtmlToPng] Mac renderer returned ${response.status}, falling back to local`,
      );
    } catch (err: any) {
      console.warn(
        `[renderHtmlToPng] Mac renderer unavailable — URL: ${MAC_RENDERER_URL}, error: ${err.message}, code: ${err.cause?.code || err.code || "N/A"}`,
      );
    }
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=none",
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.setContent(html);
    await page.evaluate("document.fonts.ready");
    await page.screenshot({
      path: outputPath,
      type: "png",
      omitBackground: true,
    });
  } finally {
    await browser.close();
  }
}

function buildFontFaceCSS(fontConfig: FontConfig): string {
  if (!fontConfig.localFile) return "";
  const fontPath = path.join(__dirname, "../../fonts", fontConfig.localFile);
  if (!fs.existsSync(fontPath)) return "";
  const fontData = fs.readFileSync(fontPath);
  const base64 = fontData.toString("base64");
  const ext = fontConfig.localFile.endsWith(".otf") ? "opentype" : "truetype";
  const familyName = fontConfig.family.replace(/'/g, "").split(",")[0].trim();
  return `@font-face { font-family: '${familyName}'; src: url(data:font/${ext};base64,${base64}) format('${ext}'); font-weight: 900; }`;
}

export const generateTextImage = async (
  text: string,
  outputPath: string,
  fillColor: string = "#FFFFFF",
  strokeColor: string = "#000000",
  fontName: string = "Montserrat",
  style: "stroke" | "instagram" = "stroke",
  headingBgColor: string = "#000000",
): Promise<void> => {
  const fontConfig = FONT_CONFIG[fontName] || FONT_CONFIG["Montserrat"];
  const fontFaceCSS = buildFontFaceCSS(fontConfig);
  const googleFontLink = fontConfig.url
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
       <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
       <link href="${fontConfig.url}" rel="stylesheet">`
    : "";

  const isInstagram = style === "instagram";

  const textStyle = isInstagram
    ? `color: ${fillColor};
       background: ${headingBgColor};
       padding: 12px 28px;
       border-radius: 20px;
       display: inline-block;`
    : `color: ${fillColor};
       -webkit-text-stroke: 6px ${strokeColor};
       paint-order: stroke fill;`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        ${googleFontLink}
        <style>
          ${fontFaceCSS}
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            width: 1080px;
            height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            padding: 30px 50px;
          }
          .text {
            font-size: 52px;
            font-weight: ${isInstagram ? 600 : 900};
            font-family: ${fontConfig.family}, ${EMOJI_FONT}, sans-serif;
            text-align: center;
            line-height: 1.25;
            letter-spacing: -0.01em;
            word-wrap: break-word;
            overflow-wrap: break-word;
            max-width: 100%;
            ${textStyle}
          }
        </style>
      </head>
      <body>
        <div class="text">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      </body>
    </html>
  `;

  await renderHtmlToPng(htmlContent, outputPath, {
    width: 1080,
    height: 400,
    deviceScaleFactor: 1,
  });

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Failed to create text image at ${outputPath}`);
  }
};

export const addTextOverlayAtPosition = async (
  inputPath: string,
  outputPath: string,
  text: string,
  xPercent: number,
  yPercent: number,
  fontSize: number,
  fillColor: string = "#FFFFFF",
  strokeColor: string = "#000000",
  fontName: string = "Montserrat",
  style: "stroke" | "instagram" = "stroke",
  headingBgColor: string = "#000000",
): Promise<string> => {
  const textImagePath = path.join(
    path.dirname(outputPath),
    `text_pos_${Date.now()}.png`,
  );

  const fontConfig = FONT_CONFIG[fontName] || FONT_CONFIG["Montserrat"];
  const fontFaceCSS = buildFontFaceCSS(fontConfig);
  const googleFontLink = fontConfig.url
    ? `<link href="${fontConfig.url}" rel="stylesheet">`
    : "";
  const isInstagram = style === "instagram";

  try {
    const textStyle = isInstagram
      ? `color: ${fillColor};
         background: ${headingBgColor};
         padding: 10px 24px;
         border-radius: 20px;
         display: inline-block;`
      : `color: ${fillColor};
         -webkit-text-stroke: 4px ${strokeColor};
         paint-order: stroke fill;`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          ${googleFontLink}
          <style>
            ${fontFaceCSS}
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: 1080px;
              height: 400px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: transparent;
              padding: 20px;
            }
            .text {
              font-size: ${fontSize}px;
              font-weight: ${isInstagram ? 600 : 900};
              font-family: ${fontConfig.family}, ${EMOJI_FONT}, sans-serif;
              text-align: center;
              line-height: 1.2;
              max-width: 100%;
              ${textStyle}
            }
          </style>
        </head>
        <body>
          <div class="text">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </body>
      </html>
    `;

    await renderHtmlToPng(htmlContent, textImagePath, {
      width: 1080,
      height: 400,
      deviceScaleFactor: 1,
    });

    const xPos = `(W*${xPercent / 100})-(w/2)`;
    const yPos = `(H*${yPercent / 100})-(h/2)`;

    return new Promise<string>((resolve, reject) => {
      ffmpeg(inputPath)
        .input(textImagePath)
        .complexFilter([`overlay=${xPos}:${yPos}`])
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          ...MOBILE_VIDEO_SETTINGS,
          "-c:a aac",
          "-b:a 128k",
          "-ar 48000",
          "-movflags +faststart",
          "-map_metadata",
          "-1",
        ])
        .save(outputPath)
        .on("end", () => {
          if (fs.existsSync(textImagePath)) fs.unlinkSync(textImagePath);
          resolve(outputPath);
        })
        .on("error", (err) => {
          if (fs.existsSync(textImagePath)) fs.unlinkSync(textImagePath);
          reject(err);
        });
    });
  } catch (err) {
    if (fs.existsSync(textImagePath)) fs.unlinkSync(textImagePath);
    throw err;
  }
};

export const addPreviewWatermark = async (
  inputPath: string,
  outputPath: string,
): Promise<string> => {
  const logoPath = path.join(__dirname, "../templates/assets/cuttr-logo.png");

  if (!fs.existsSync(logoPath)) {
    throw new Error(`Cuttr logo not found at ${logoPath}`);
  }

  const metadata = await getVideoMetadata(inputPath);
  const duration = metadata.duration || 10;
  const halfDuration = duration / 2;

  const logoSize = Math.round(Math.min(metadata.width, metadata.height) * 0.35);
  const margin = Math.round(Math.min(metadata.width, metadata.height) * 0.04);

  const xExpr = `if(lt(t,${halfDuration}),W-w-${margin},${margin})`;
  const yExpr = `if(lt(t,${halfDuration}),H-h-${margin},${margin})`;

  return new Promise<string>((resolve, reject) => {
    ffmpeg(inputPath)
      .input(logoPath)
      .complexFilter([
        `[1:v]scale=${logoSize}:-1,format=rgba,colorchannelmixer=aa=0.65[logo]`,
        `[0:v][logo]overlay=x='${xExpr}':y='${yExpr}':format=auto`,
      ])
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-c:a aac",
        "-b:a 128k",
        "-ar 48000",
        "-movflags +faststart",
        "-map_metadata",
        "-1",
      ])
      .save(outputPath)
      .on("end", () => {
        resolve(outputPath);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

export const addTextOverlay = async (
  inputPath: string,
  outputPath: string,
  text: string,
  position: "top" | "center" | "bottom" = "top",
  fillColor: string = "#FFFFFF",
  strokeColor: string = "#000000",
  fontName: string = "Montserrat",
  style: "stroke" | "instagram" = "stroke",
  headingBgColor: string = "#000000",
  facecamHeight?: number,
): Promise<string> => {
  const textImagePath = path.join(
    path.dirname(outputPath),
    `text_overlay_${Date.now()}.png`,
  );

  try {
    console.log("Generating text image with:", text);
    await generateTextImage(
      text,
      textImagePath,
      fillColor,
      strokeColor,
      fontName,
      style,
      headingBgColor,
    );
    console.log("Text image created at:", textImagePath);

    if (!fs.existsSync(textImagePath)) {
      throw new Error(`Text image was not created at ${textImagePath}`);
    }

    const yPosition =
      position === "top"
        ? "H*0.05"
        : position === "center"
          ? facecamHeight
            ? `${facecamHeight}-h/2`
            : "(H-h)/2-H*0.05"
          : "H-h-H*0.1";

    return new Promise<string>((resolve, reject) => {
      ffmpeg(inputPath)
        .input(textImagePath)
        .complexFilter([`overlay=(W-w)/2:${yPosition}`])
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          ...MOBILE_VIDEO_SETTINGS,
          "-c:a aac",
          "-b:a 128k",
          "-ar 48000",
          "-movflags +faststart",
          "-map_metadata",
          "-1",
        ])
        .save(outputPath)
        .on("end", () => {
          if (fs.existsSync(textImagePath)) {
            fs.unlinkSync(textImagePath);
          }
          console.log("Text overlay completed successfully");
          resolve(outputPath);
        })
        .on("error", (err) => {
          if (fs.existsSync(textImagePath)) {
            fs.unlinkSync(textImagePath);
          }
          console.error("Error adding text overlay:", err);
          reject(err);
        });
    });
  } catch (err) {
    if (fs.existsSync(textImagePath)) {
      fs.unlinkSync(textImagePath);
    }
    console.error("Error in addTextOverlay:", err);
    throw err;
  }
};

export interface CommentOverlayConfig {
  platform: "tiktok" | "youtube" | "instagram";
  username: string;
  commentText: string;
  profilePicturePath?: string;
  likesCount: number;
  isVerified: boolean;
  timeAgo?: string;
}

const formatLikesCount = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
};

const hashColor = (str: string): string => {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const VERIFIED_BADGE_SVG = {
  tiktok: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#20D5EC"/><path d="M8.5 13.5L5 10l1.4-1.4 2.1 2.1 4.6-4.6L14.5 7.5l-6 6z" fill="#fff"/></svg>`,
  youtube: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#aaa"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  instagram: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#3897F0"/><path d="M8.5 13.5L5 10l1.4-1.4 2.1 2.1 4.6-4.6L14.5 7.5l-6 6z" fill="#fff"/></svg>`,
};

const HEART_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

const THUMBS_UP_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#aaa" xmlns="http://www.w3.org/2000/svg"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>`;

const getDefaultAvatarDataUri = (_username: string): string => {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><circle cx="36" cy="36" r="36" fill="#C4C4C4"/><path d="M36 36c5.4 0 9.6-4.2 9.6-9.6S41.4 16.8 36 16.8 26.4 21 26.4 26.4 30.6 36 36 36zm0 4.8c-6.4 0-19.2 3.2-19.2 9.6v2.4c0 1.32 1.08 2.4 2.4 2.4h33.6c1.32 0 2.4-1.08 2.4-2.4v-2.4c0-6.4-12.8-9.6-19.2-9.6z" fill="#fff"/></svg>`,
  )}`;
};

const getCommentHtml = (
  config: CommentOverlayConfig,
  profilePicSrc: string,
): string => {
  const { platform, username, commentText, likesCount, isVerified, timeAgo } =
    config;
  const likes = formatLikesCount(likesCount);
  const badge = isVerified ? VERIFIED_BADGE_SVG[platform] : "";
  const safeUsername = escapeHtml(username);
  const safeComment = escapeHtml(commentText);
  const time = escapeHtml(timeAgo || "2h");

  if (platform === "tiktok") {
    return `
      <!DOCTYPE html><html><head><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 800px; background: transparent; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        .comment { background: rgba(255,255,255,0.95); border-radius: 16px; padding: 16px 20px; display: inline-flex; flex-direction: column; gap: 10px; max-width: 760px; }
        .header { color: #8A8A8A; font-size: 16px; font-weight: 600; }
        .content { display: flex; align-items: center; gap: 14px; }
        .avatar { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .text { color: #000; font-size: 20px; font-weight: 700; line-height: 1.3; word-wrap: break-word; flex: 1; min-width: 0; }
      </style></head><body>
        <div class="comment">
          <div class="header">Reply to @${safeUsername}'s comment</div>
          <div class="content">
            <img class="avatar" src="${profilePicSrc}" />
            <div class="text">${safeComment}</div>
          </div>
        </div>
      </body></html>
    `;
  }

  if (platform === "youtube") {
    return `
      <!DOCTYPE html><html><head><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 800px; background: transparent; padding: 16px; font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .comment { background: rgba(28,28,28,0.92); border-radius: 12px; padding: 14px 16px; display: inline-flex; align-items: flex-start; gap: 12px; max-width: 760px; }
        .avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .body { flex: 1; min-width: 0; }
        .username-row { display: flex; align-items: center; gap: 6px; }
        .username { color: #aaa; font-size: 13px; font-weight: 500; }
        .time { color: #717171; font-size: 12px; }
        .text { color: #fff; font-size: 14px; margin-top: 4px; line-height: 1.4; word-wrap: break-word; }
        .actions { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
        .actions span { color: #aaa; font-size: 12px; }
      </style></head><body>
        <div class="comment">
          <img class="avatar" src="${profilePicSrc}" />
          <div class="body">
            <div class="username-row"><span class="username">@${safeUsername}</span>${badge}<span class="time">${time}</span></div>
            <div class="text">${safeComment}</div>
            <div class="actions">${THUMBS_UP_SVG}<span>${likes}</span></div>
          </div>
        </div>
      </body></html>
    `;
  }

  return `
    <!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { width: 800px; background: transparent; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .comment { background: rgba(0,0,0,0.6); border-radius: 20px; padding: 12px 16px; display: inline-flex; align-items: flex-start; gap: 10px; max-width: 760px; }
      .avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
      .body { flex: 1; min-width: 0; }
      .username-row { display: flex; align-items: center; gap: 4px; }
      .username { color: #fff; font-size: 13px; font-weight: 600; }
      .time { color: rgba(255,255,255,0.4); font-size: 12px; }
      .text { color: #fff; font-size: 13px; margin-top: 3px; line-height: 1.35; word-wrap: break-word; }
      .likes { display: flex; flex-direction: column; align-items: center; gap: 1px; margin-left: 8px; flex-shrink: 0; }
      .likes svg { width: 16px; height: 16px; fill: rgba(255,255,255,0.7); }
      .likes span { color: rgba(255,255,255,0.6); font-size: 11px; }
    </style></head><body>
      <div class="comment">
        <img class="avatar" src="${profilePicSrc}" />
        <div class="body">
          <div class="username-row"><span class="username">${safeUsername}</span>${badge}<span class="time">${time}</span></div>
          <div class="text">${safeComment}</div>
        </div>
        <div class="likes">${HEART_ICON_SVG}<span>${likes}</span></div>
      </div>
    </body></html>
  `;
};

export const generateCommentImage = async (
  config: CommentOverlayConfig,
  outputPath: string,
): Promise<{ width: number; height: number }> => {
  console.log(
    `[COMMENT] Generating ${config.platform} comment image for @${config.username}`,
  );

  let profilePicSrc = getDefaultAvatarDataUri(config.username);
  if (config.profilePicturePath && fs.existsSync(config.profilePicturePath)) {
    const imageBuffer = fs.readFileSync(config.profilePicturePath);
    const ext = path.extname(config.profilePicturePath).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
    profilePicSrc = `data:${mime};base64,${imageBuffer.toString("base64")}`;
  }

  const htmlContent = getCommentHtml(config, profilePicSrc);

  if (MAC_RENDERER_URL) {
    try {
      const response = await fetch(`${MAC_RENDERER_URL}/render-and-measure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: htmlContent,
          selector: ".comment",
          width: 800,
          height: 400,
          deviceScaleFactor: 2,
          padding: 32,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        const dimensions = {
          width: parseInt(response.headers.get("X-Render-Width") || "800", 10),
          height: parseInt(
            response.headers.get("X-Render-Height") || "200",
            10,
          ),
        };
        console.log(
          `[COMMENT] Generated via Mac renderer: ${dimensions.width}x${dimensions.height}px`,
        );
        return dimensions;
      }
      console.warn(
        `[COMMENT] Mac renderer returned ${response.status}, falling back to local`,
      );
    } catch (err: any) {
      console.warn(
        `[COMMENT] Mac renderer unavailable — URL: ${MAC_RENDERER_URL}, error: ${err.message}, code: ${err.cause?.code || err.code || "N/A"}`,
      );
    }
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 400, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const commentEl = await page.$(".comment");
    let dimensions = { width: 800, height: 200 };
    if (commentEl) {
      const box = await commentEl.boundingBox();
      if (box) {
        dimensions = {
          width: Math.ceil(box.width) + 32,
          height: Math.ceil(box.height) + 32,
        };
      }
    }

    await page.screenshot({
      path: outputPath,
      type: "png",
      omitBackground: true,
      clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height },
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Failed to create comment image at ${outputPath}`);
    }

    console.log(
      `[COMMENT] Generated ${config.platform} comment: ${dimensions.width}x${dimensions.height}px -> ${outputPath}`,
    );
    return dimensions;
  } finally {
    await browser.close();
  }
};
