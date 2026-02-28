import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3100;
const MAX_BODY = "10mb";

app.use(express.json({ limit: MAX_BODY }));

// Keep a persistent browser instance (pages are cheap, browsers are expensive)
let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--font-render-hinting=none",
      ],
    });
  }
  return browser;
}

// POST /render — accepts HTML, returns PNG
app.post("/render", async (req, res) => {
  const { html, width = 1080, height = 400, deviceScaleFactor = 1 } = req.body;

  if (!html) {
    return res.status(400).json({ error: "html is required" });
  }

  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate("document.fonts.ready");

    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: true,
    });

    res.type("image/png").send(screenshot);
  } catch (err) {
    console.error("[render] Error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// POST /render-and-measure — accepts HTML, returns PNG + bounding box dimensions
app.post("/render-and-measure", async (req, res) => {
  const { html, selector = ".comment", width = 800, height = 400, deviceScaleFactor = 2, padding = 32 } = req.body;

  if (!html) {
    return res.status(400).json({ error: "html is required" });
  }

  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate("document.fonts.ready");

    const el = await page.$(selector);
    if (!el) {
      return res.status(400).json({ error: "selector not found: " + selector });
    }

    const box = await el.boundingBox();
    const clipWidth = Math.ceil(box.width) + padding;
    const clipHeight = Math.ceil(box.height) + padding;

    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: true,
      clip: {
        x: Math.max(0, box.x - padding / 2),
        y: Math.max(0, box.y - padding / 2),
        width: clipWidth,
        height: clipHeight,
      },
    });

    res.type("image/png");
    res.set("X-Render-Width", String(clipWidth));
    res.set("X-Render-Height", String(clipHeight));
    res.send(screenshot);
  } catch (err) {
    console.error("[render-and-measure] Error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", browser: browser?.connected ?? false });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Mac renderer listening on port ${PORT}`);
  // Pre-warm the browser
  getBrowser().then(() => console.log("Browser pre-warmed"));
});
