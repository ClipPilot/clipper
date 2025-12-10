import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { Canvas } from "skia-canvas";
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

// Generate text image with emojis using skia-canvas (better emoji support)
const generateTextImage = async (text: string, outputPath: string): Promise<void> => {
  // Create canvas with transparent background
  const canvas = new Canvas(1920, 250);
  const ctx = canvas.getContext("2d");

  // Clear to transparent
  ctx.clearRect(0, 0, 1920, 250);

  // Configure text styling
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 100px 'Helvetica Neue', 'Arial'";

  const centerX = 1920 / 2;
  const centerY = 250 / 2;

  // Draw text with black stroke (outline)
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 12;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeText(text, centerX, centerY);

  // Draw white text fill
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(text, centerX, centerY);

  // Save as PNG with transparency (using toFile instead of deprecated saveAs)
  await canvas.toFile(outputPath, { format: "png" });

  // Verify file was created
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Failed to create text image at ${outputPath}`);
  }
};

export const addTextOverlay = async (
  inputPath: string,
  outputPath: string,
  text: string,
  position: "top" | "center" | "bottom" = "top"
): Promise<string> => {
  const textImagePath = path.join(
    path.dirname(outputPath),
    `text_overlay_${Date.now()}.png`
  );

  try {
    // Generate the text image with emojis
    console.log("Generating text image with:", text);
    await generateTextImage(text, textImagePath);
    console.log("Text image created at:", textImagePath);

    // Verify the file exists before proceeding
    if (!fs.existsSync(textImagePath)) {
      throw new Error(`Text image was not created at ${textImagePath}`);
    }

    // Position calculations
    const yPosition =
      position === "top"
        ? "H*0.1"
        : position === "center"
        ? "(H-h)/2"
        : "H-h-H*0.1";

    // Overlay the image on the video using Promise wrapper
    return new Promise<string>((resolve, reject) => {
      ffmpeg(inputPath)
        .input(textImagePath)
        .complexFilter([`overlay=(W-w)/2:${yPosition}`])
        .outputOptions(["-c:v libx264", "-preset ultrafast", "-crf 23", "-c:a copy"])
        .save(outputPath)
        .on("end", () => {
          // Clean up temp image
          if (fs.existsSync(textImagePath)) {
            fs.unlinkSync(textImagePath);
          }
          console.log("Text overlay completed successfully");
          resolve(outputPath);
        })
        .on("error", (err) => {
          // Clean up temp image on error
          if (fs.existsSync(textImagePath)) {
            fs.unlinkSync(textImagePath);
          }
          console.error("Error adding text overlay:", err);
          reject(err);
        });
    });
  } catch (err) {
    // Clean up temp image on error
    if (fs.existsSync(textImagePath)) {
      fs.unlinkSync(textImagePath);
    }
    console.error("Error in addTextOverlay:", err);
    throw err;
  }
};

