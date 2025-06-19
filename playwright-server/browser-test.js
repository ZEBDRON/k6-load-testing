import { chromium } from "playwright";

const STORAGE_STATE = "./trusted-session.json";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
  });
  const page = await context.newPage();
  await page.goto(
    "https://qa-interview.geektrust.in/vscode/1cfaf6c24b6da1bcccf9cf3d35116106/"
  );

  console.log(await page.title());

  await page.waitForTimeout(10000); // Wait 10s for full load

  // Save trusted state for future use
  await context.storageState({ path: STORAGE_STATE });

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

        // await trustButton.click({ force: true });
        // Focus the button and press Enter
        await trustButton.focus();
        await page.keyboard.press("Enter");
        console.log("✅ Clicked trust button successfully");
      }
    } catch (err) {
      console.warn("⚠️ Could not read frame:", frame.url(), err.message);
    }
  }
  // Continue test logic...
  await page.waitForTimeout(3000); // small delay
  await page.screenshot({ path: "debug.png", fullPage: true });
  console.log("Page Content", await page.content());

  console.log("✅ Trust button clicked");
})();
