import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PROMPT =
  "fix the failing checkout test; reproduce it, identify the smallest cause, and verify the repair";

test("captures a real diagnose recommendation", async ({ browser, baseURL }) => {
  const videoDirectory = path.join(ROOT, "test-results", "portfolio-video");
  const videoPath = path.join(ROOT, "docs/demo/skill-recommendation.webm");
  const screenshotPath = path.join(ROOT, "docs/screenshots/dashboard.png");
  await fs.mkdir(videoDirectory, { recursive: true });
  await fs.mkdir(path.dirname(videoPath), { recursive: true });

  expect(baseURL).toBeTruthy();
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: videoDirectory,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  const video = page.video();

  try {
    expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });
    await page.goto("/setup-key.html");
    await page.locator("[data-prompt-draft-input]").fill(PROMPT);
    await expect(page.locator("[data-skill-hint]")).toContainText("diagnose", {
      timeout: 5000,
    });
    await expect(page.locator("[data-prompt-coach-status]")).toContainText(
      "先縮小錯誤範圍",
    );
    await expect(page.locator("[data-prompt-draft-input]")).toHaveValue(PROMPT);
    await expect(page.locator("[data-next-step-action]")).toContainText(
      "不改寫或插入 prompt",
    );
    await expect(page.locator("[data-next-step-reason]")).not.toBeEmpty();
    await page.evaluate(() => {
      document.documentElement.style.zoom = "0.62";
    });
    for (const selector of [
      "[data-prompt-draft-input]",
      "[data-skill-hint]",
      "[data-next-step-action]",
      "[data-next-step-reason]",
    ]) {
      await expect(page.locator(selector)).toBeInViewport();
    }
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await page.waitForTimeout(2500);
  } finally {
    await page.close();
    await context.close();
  }

  await video.saveAs(videoPath);
});
