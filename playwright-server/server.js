// server.js
import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

let ideUrl = null;
let browser = null; // Store the browser globally

app.post("/set-editor-url", async (req, res) => {
  ideUrl = req.body.ideUrl;
  console.log("✅ IDE URL received:", ideUrl);

  res.sendStatus(200); // Respond to K6 immediately

  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("🚀 Launching:", ideUrl);
    await page.goto(ideUrl, { timeout: 60000 });
    await page.waitForTimeout(15000); // Wait 15s for full load
    // Find frame containing the dialog
    const dialogFrame = page
      .frames()
      .find((f) => f.url().includes("webWorkerExtensionHostIframe.html"));

    if (!dialogFrame) {
      throw new Error("❌ Dialog frame not found!");
    }

    for (const frame of page.frames()) {
      console.log("🔍 Frame URL:", frame.url());

      try {
        const content = await frame.content();
        if (content.includes("Do you trust the authors")) {
          console.log("✅ Found frame with trust dialog:", frame.url());
          // Click the "Yes, I trust the authors" button
          const trustButton = await frame.waitForSelector(
            "a.monaco-button.monaco-text-button",
            { timeout: 20000 }
          );

          await frame.evaluate(() => {
            const overlay = document.querySelector(
              ".monaco-dialog-modal-block.dimmed"
            );
            if (overlay) overlay.style.display = "none";
          });

          await trustButton.click({ force: true });
          console.log("✅ Clicked trust button successfully");
        }
      } catch (err) {
        console.warn("⚠️ Could not read frame:", frame.url(), err.message);
      }
    }
    await page.waitForTimeout(3000); // small delay
    await page.screenshot({ path: "debug.png", fullPage: true });
  } catch (err) {
    console.error("❌ Error launching Playwright:", err);
  }
});

app.get("/get-editor-url", (req, res) => {
  res.json({ ideUrl });
});

app.post("/close-browser", async (req, res) => {
  if (browser) {
    try {
      await browser.close();
      browser = null;
      console.log("🧹 Browser closed via API.");
      res.status(200).send("Browser closed.");
    } catch (err) {
      console.error("❌ Error closing browser:", err);
      res.status(500).send("Error closing browser.");
    }
  } else {
    res.status(400).send("No browser is currently open.");
  }
});

app.listen(8000, () => console.log("🌐 API running on http://localhost:8000"));
