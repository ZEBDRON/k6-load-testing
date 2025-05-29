import { browser } from "k6/browser";
import { check } from "https://jslib.k6.io/k6-utils/1.5.0/index.js";

export const options = {
  scenarios: {
    ui: {
      executor: "shared-iterations",
      options: {
        browser: {
          type: "chromium",
        },
      },
    },
  },
  thresholds: {
    checks: ["rate==1.0"],
  },
};

export default async function () {
    const context = await browser.newContext();
    await context.grantPermissions(['camera', 'microphone']);
    const page = await context.newPage();

  try {

    // 1. Navigate to login page
    await page.goto(
      "https://qa-interview.geektrust.in/interview-agent/login/MDVyZGsWeE?loginCode=fa309fea-ad5d-4483-be0a-043ac57c0513",
      {
        waitUntil: "networkidle",
        timeout: 30000,
      }
    );

    await page.waitForTimeout(2000);
    // 2. Check terms and conditions with verification
    const termsCheckbox = page.locator(
      "div.text.terms-n-condition input.checkbox"
    );
    await termsCheckbox.click({ timeout: 10000 });

    // Verify checkbox is checked
    const isChecked = await termsCheckbox.isChecked();
    check(isChecked, {
      "Terms checkbox is checked": (checked) => checked === true,
    });

    // 3. Click Proceed button - using exact class names from your HTML
    const proceedButton = page.locator("div.start-btn > div.btn-text");
    await proceedButton.click();

    await page.waitForTimeout(2000);
     // Verify button click worked by waiting for next screen
     check(await page.locator("div.setup-btn").isVisible(), {
        "Proceed button worked": (visible) => visible === true,
      });

    
    // 4. Click Next button - using exact class names from your HTML
    const nextButton = page.locator("div.setup-btn > div.btn-text");
    await nextButton.click();

    await page.waitForTimeout(2000);

    check(await page.locator("div.proctoring-btn").isVisible(), {
        "Next button worked": (visible) => visible === true,
      });

    const permissionsButton = page.locator("div.proctoring-btn div.btn-text");
    await permissionsButton.click({ timeout: 15000 });

    await page.waitForTimeout(2000);
    check(await page.locator("div.start-btn").isVisible(), {
        "Auto accepted media permissions": (visible) => visible === true,
      });

    const startInterviewBtn = page.locator("div.start-btn div.start-text");
    await startInterviewBtn.click({ timeout: 15000 });

    await page.waitForTimeout(5000);
    const letsStartButton = page.locator("div.action-tag > div.action-text");
    await letsStartButton.click();

    await page.waitForTimeout(3000);

    // 7. Locate the disabled "Let's start" button
    const disabledButton = page.locator("div.actions div.disabled-tag div.disabled-text");
    await disabledButton.waitFor({ state: "visible", timeout: 10000 });

    // Verify it's disabled and has correct text
    const disabledText = await disabledButton.textContent();
    console.log(disabledText)
    check(disabledText.trim() === "Let's start", {
      "Disabled 'Let\\'s start' button visible": (visible) => visible === true
    });

    // Keep browser open for inspection (60 seconds)
    await page.waitForTimeout(60000);
  } finally {
    await page.close();
  }
}
