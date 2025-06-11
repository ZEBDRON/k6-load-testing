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
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("🚀 Launching:", ideUrl);
    await page.goto(ideUrl, { timeout: 60000 });
    await page.waitForTimeout(600000); // Wait for 10 minutes
    console.log("✅ Done");
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
