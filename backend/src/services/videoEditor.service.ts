import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { createCanvas } from "canvas";
import path from "path";

export const cutClip = (input: string, output: string, start: number, end: number) => {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .setStartTime(start)
      .setDuration(end - start)
      .outputOptions([
        "-c:v libx264",
        "-preset ultrafast",  // Much faster encoding
        "-crf 23",
        "-c:a aac",
        "-b:a 128k"  // Lower bitrate for speed
      ])
      .save(output)
      .on("end", () => resolve(output))
      .on("error", reject)
      .run();
  });
};

export const mergeClips = async (clips: string[], outputPath: string) => {
  return new Promise((resolve, reject) => {
    const listPath = outputPath + ".txt";

    // Create concat file: file 'clip1.mp4'
    const content = clips.map(c => `file '${c.replace(/'/g, "'\\''")}'`).join("\n");
    fs.writeFileSync(listPath, content);

    ffmpeg()
      .input(listPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])   // <-- no re-encode
      .save(outputPath)
      .on("end", () => {
        fs.unlinkSync(listPath);    // cleanup
        resolve(outputPath);
      })
      .on("error", err => reject(err));
  });
};

// Generate a PNG image with text and emoji support
const generateTextImage = (text: string, outputPath: string): void => {
  // Create canvas with generous dimensions and transparent background
  const canvas = createCanvas(1920, 250);
  const ctx = canvas.getContext("2d");

  // Clear canvas to transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Regex to separate emojis from text
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

  // Split text into parts (text and emoji)
  const parts: Array<{content: string, isEmoji: boolean}> = [];
  let lastIndex = 0;
  let match;

  while ((match = emojiRegex.exec(text)) !== null) {
    // Add text before emoji
    if (match.index > lastIndex) {
      parts.push({
        content: text.substring(lastIndex, match.index),
        isEmoji: false
      });
    }
    // Add emoji
    parts.push({
      content: match[0],
      isEmoji: true
    });
    lastIndex = match.index + match[0].length;
  }
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      content: text.substring(lastIndex),
      isEmoji: false
    });
  }

  // Calculate total width to center everything
  const textFont = 'bold 90px "Helvetica Neue", "Helvetica", "Arial", sans-serif';
  const emojiFont = '90px "Apple Color Emoji"';

  let totalWidth = 0;
  parts.forEach(part => {
    ctx.font = part.isEmoji ? emojiFont : textFont;
    totalWidth += ctx.measureText(part.content).width;
  });

  // Draw each part
  let currentX = centerX - totalWidth / 2;

  parts.forEach(part => {
    if (part.isEmoji) {
      // Render emoji with natural colors
      ctx.font = emojiFont;
      ctx.fillText(part.content, currentX, centerY);
      currentX += ctx.measureText(part.content).width;
    } else {
      // Render text with stroke and white fill
      ctx.font = textFont;

      // Draw stroke (outline)
      ctx.strokeStyle = "black";
      ctx.lineWidth = 10;
      ctx.lineJoin = "round";
      ctx.strokeText(part.content, currentX, centerY);

      // Draw white fill
      ctx.fillStyle = "white";
      ctx.fillText(part.content, currentX, centerY);

      currentX += ctx.measureText(part.content).width;
    }
  });

  // Save to file with PNG transparency
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputPath, buffer);
};

export const addTextOverlay = (
  inputPath: string,
  outputPath: string,
  text: string,
  position: "top" | "center" | "bottom" = "top"
) => {
  return new Promise((resolve, reject) => {
    // Generate text image with emoji support
    const textImagePath = path.join(path.dirname(outputPath), `text_overlay_${Date.now()}.png`);

    try {
      generateTextImage(text, textImagePath);
    } catch (err) {
      console.error("Error generating text image:", err);
      return reject(err);
    }

    // Position calculations for overlay
    const yPosition =
      position === "top" ? "H*0.1" :
      position === "center" ? "(H-h)/2" :
      "H-H*0.15-h";

    // Use image overlay instead of drawtext
    const overlayFilter = `overlay=(W-w)/2:${yPosition}`;

    ffmpeg(inputPath)
      .input(textImagePath)
      .complexFilter([overlayFilter])
      .outputOptions([
        "-c:v libx264",
        "-preset ultrafast",
        "-crf 23",
        "-c:a copy"
      ])
      .save(outputPath)
      .on("end", () => {
        // Clean up text image
        if (fs.existsSync(textImagePath)) {
          fs.unlinkSync(textImagePath);
        }
        resolve(outputPath);
      })
      .on("error", (err) => {
        // Clean up text image on error
        if (fs.existsSync(textImagePath)) {
          fs.unlinkSync(textImagePath);
        }
        console.error("Error adding text overlay:", err);
        reject(err);
      });
  });
};

