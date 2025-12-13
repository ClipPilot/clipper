import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import puppeteer from "puppeteer";
import path from "path";

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
  return new Promise((resolve, reject) => {
    const listPath = outputPath + ".txt";
    const content = clips
      .map(c => `file '${c.replace(/'/g, "'\\''")}'`)
      .join("\n");

    fs.writeFileSync(listPath, content);

    ffmpeg()
      .input(listPath)
      .inputOptions(["-f concat", "-safe 0"])
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
          options: { sigma: 15 },
          inputs: "bg2",
          outputs: "bg",
        },
        {
          filter: "scale",
          options: {
            w: "min(iw,1080)",
            h: "min(ih,1920)",
            force_original_aspect_ratio: "decrease",
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
      ])
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
              font-family: 'Montserrat', 'The Bold Font', -apple-system, BlinkMacSystemFont, sans-serif;
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

