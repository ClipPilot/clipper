import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import puppeteer from "puppeteer";
import path from "path";

interface VideoMetadata {
  width: number;
  height: number;
  duration?: number;
  bitrate?: number;
}

const getVideoMetadata = (videoPath: string): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === "video");
      if (!videoStream || !videoStream.width || !videoStream.height) {
        return reject(new Error("Could not get video dimensions"));
      }
      resolve({
        width: videoStream.width,
        height: videoStream.height,
        duration: metadata.format.duration,
        bitrate: metadata.format.bit_rate ? parseInt(String(metadata.format.bit_rate)) : undefined,
      });
    });
  });
};

const COMPRESSION_THRESHOLD = 100 * 1024 * 1024;
const TARGET_BITRATE = 4000;

export const compressVideoForUpload = async (
  inputPath: string,
  outputPath: string
): Promise<{ path: string; compressed: boolean; originalSize: number; newSize: number }> => {
  const originalSize = fs.statSync(inputPath).size;

  if (originalSize < COMPRESSION_THRESHOLD) {
    console.log(`[COMPRESS] File ${Math.round(originalSize / 1024 / 1024)}MB below threshold, skipping compression`);
    return { path: inputPath, compressed: false, originalSize, newSize: originalSize };
  }

  console.log(`[COMPRESS] Compressing ${Math.round(originalSize / 1024 / 1024)}MB video...`);

  try {
    const metadata = await getVideoMetadata(inputPath);
    const currentBitrate = metadata.bitrate ? metadata.bitrate / 1000 : 10000;

    if (currentBitrate <= TARGET_BITRATE * 1.2) {
      console.log(`[COMPRESS] Bitrate ${Math.round(currentBitrate)}kbps already optimal, skipping`);
      return { path: inputPath, compressed: false, originalSize, newSize: originalSize };
    }

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-c:v libx264",
          "-preset ultrafast",
          `-b:v ${TARGET_BITRATE}k`,
          `-maxrate ${TARGET_BITRATE * 1.5}k`,
          `-bufsize ${TARGET_BITRATE * 2}k`,
          "-c:a aac",
          "-b:a 128k",
          "-movflags +faststart",
        ])
        .save(outputPath)
        .on("progress", (progress) => {
          if (progress.percent && Math.round(progress.percent) % 25 === 0) {
            console.log(`[COMPRESS] Progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on("end", () => resolve())
        .on("error", reject);
    });

    const newSize = fs.statSync(outputPath).size;
    const savings = Math.round(((originalSize - newSize) / originalSize) * 100);
    console.log(`[COMPRESS] Done: ${Math.round(originalSize / 1024 / 1024)}MB -> ${Math.round(newSize / 1024 / 1024)}MB (${savings}% smaller)`);

    return { path: outputPath, compressed: true, originalSize, newSize };
  } catch (error) {
    console.error("[COMPRESS] Failed, using original:", error);
    return { path: inputPath, compressed: false, originalSize, newSize: originalSize };
  }
};

export const cutClip = (input: string, output: string, start: number, end: number) => {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .setStartTime(start)
      .setDuration(end - start)
      .outputOptions([
        "-c:v libx264",
        "-preset ultrafast",
        "-crf 23",
        "-c:a aac",
        "-b:a 128k"  
      ])
      .save(output)
      .on("end", () => resolve(output))
      .on("error", reject)
      .run();
  });
};
export const mergeClips = async (clips: string[], outputPath: string) => {
  const firstClip = clips[0];
  const metadata = await getVideoMetadata(firstClip);
  const isHorizontal = metadata.width > metadata.height;

  return new Promise((resolve, reject) => {
    const listPath = outputPath + ".txt";
    const content = clips
      .map(c => `file '${c.replace(/'/g, "'\\''")}'`)
      .join("\n");

    fs.writeFileSync(listPath, content);

    const ffmpegCmd = ffmpeg()
      .input(listPath)
      .inputOptions(["-f concat", "-safe 0"]);

    if (isHorizontal) {
      ffmpegCmd
        .complexFilter([
          {
            filter: "scale",
            options: {
              w: 1080,
              h: 1920,
              force_original_aspect_ratio: "increase",
            },
            inputs: "0:v",
            outputs: "bg1",
          },
          {
            filter: "crop",
            options: { w: 1080, h: 1920 },
            inputs: "bg1",
            outputs: "bg2",
          },
          {
            filter: "gblur",
            options: { sigma: 20 },
            inputs: "bg2",
            outputs: "bg",
          },
          {
            filter: "scale",
            options: {
              w: 1080,
              h: -2,
            },
            inputs: "0:v",
            outputs: "fg",
          },
          {
            filter: "overlay",
            options: {
              x: "(W-w)/2",
              y: "(H-h)/2",
            },
            inputs: ["bg", "fg"],
            outputs: "v",
          },
        ])
        .outputOptions([
          "-map [v]",
          "-map 0:a?",
          "-c:v libx264",
          "-preset veryfast",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
        ]);
    } else {
      ffmpegCmd
        .outputOptions([
          "-c:v libx264",
          "-preset veryfast",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          "-c:a aac",
          "-b:a 128k",
        ]);
    }

    ffmpegCmd
      .save(outputPath)
      .on("end", () => {
        fs.unlinkSync(listPath);
        resolve(outputPath);
      })
      .on("error", err => reject(err));
  });
};


const generateTextImage = async (
  text: string,
  outputPath: string,
  fillColor: string = "#FFFFFF",
  strokeColor: string = "#000000"
): Promise<void> => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: 1080,
      height: 400,
      deviceScaleFactor: 2
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap" rel="stylesheet">
          <style>
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
              font-weight: 900;
              font-family: 'Montserrat', 'Apple Color Emoji', sans-serif;
              color: ${fillColor};
              text-align: center;
              -webkit-text-stroke: 6px ${strokeColor};
              paint-order: stroke fill;
              line-height: 1.25;
              letter-spacing: -0.01em;
              word-wrap: break-word;
              overflow-wrap: break-word;
              max-width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="text">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </body>
      </html>
    `;

    await page.setContent(htmlContent);

    await page.screenshot({
      path: outputPath,
      type: 'png',
      omitBackground: true
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Failed to create text image at ${outputPath}`);
    }
  } finally {
    await browser.close();
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
  strokeColor: string = "#000000"
): Promise<string> => {
  const textImagePath = path.join(
    path.dirname(outputPath),
    `text_pos_${Date.now()}.png`
  );

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 400, deviceScaleFactor: 2 });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap" rel="stylesheet">
          <style>
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
              font-weight: 900;
              font-family: 'Montserrat', 'Apple Color Emoji', sans-serif;
              color: ${fillColor};
              text-align: center;
              -webkit-text-stroke: 4px ${strokeColor};
              paint-order: stroke fill;
              line-height: 1.2;
              max-width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="text">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </body>
      </html>
    `;

    await page.setContent(htmlContent);
    await page.screenshot({ path: textImagePath, type: 'png', omitBackground: true });
    await browser.close();

    const xPos = `(W*${xPercent / 100})-(w/2)`;
    const yPos = `(H*${yPercent / 100})-(h/2)`;

    return new Promise<string>((resolve, reject) => {
      ffmpeg(inputPath)
        .input(textImagePath)
        .complexFilter([`overlay=${xPos}:${yPos}`])
        .outputOptions(["-c:v libx264", "-preset ultrafast", "-crf 23", "-c:a copy"])
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
  outputPath: string
): Promise<string> => {
  // Use the Cuttr logo from assets
  const logoPath = path.join(__dirname, '../templates/assets/cuttr-logo.png');

  if (!fs.existsSync(logoPath)) {
    throw new Error(`Cuttr logo not found at ${logoPath}`);
  }

  // Get video dimensions to scale logo appropriately
  const metadata = await getVideoMetadata(inputPath);

  const logoSize = Math.round(Math.min(metadata.width, metadata.height) * 0.22);
  const margin = Math.round(Math.min(metadata.width, metadata.height) * 0.03);

  return new Promise<string>((resolve, reject) => {
    ffmpeg(inputPath)
      .input(logoPath)
      .complexFilter([
        `[1:v]scale=${logoSize}:-1,format=rgba,colorchannelmixer=aa=0.5[logo]`,
        `[0:v][logo]overlay=W-w-${margin}:(H-h)/2:format=auto`
      ])
      .outputOptions(["-c:v libx264", "-preset ultrafast", "-crf 23", "-c:a copy"])
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
  strokeColor: string = "#000000"
): Promise<string> => {
  const textImagePath = path.join(
    path.dirname(outputPath),
    `text_overlay_${Date.now()}.png`
  );

  try {
    console.log("Generating text image with:", text);
    await generateTextImage(text, textImagePath, fillColor, strokeColor);
    console.log("Text image created at:", textImagePath);

    if (!fs.existsSync(textImagePath)) {
      throw new Error(`Text image was not created at ${textImagePath}`);
    }

    const yPosition =
      position === "top"
        ? "H*0.05"
        : position === "center"
        ? "(H-h)/2"
        : "H-h-H*0.1";

    return new Promise<string>((resolve, reject) => {
      ffmpeg(inputPath)
        .input(textImagePath)
        .complexFilter([`overlay=(W-w)/2:${yPosition}`])
        .outputOptions(["-c:v libx264", "-preset ultrafast", "-crf 23", "-c:a copy"])
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

