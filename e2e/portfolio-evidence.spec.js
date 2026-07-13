import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PROMPT =
  "fix the failing checkout test; reproduce it, identify the smallest cause, and verify the repair";
const CAPTURE_CSS = `
  html { zoom: 1 !important; }
  body { height: 900px; overflow: hidden; }
  .setup-shell { height: 900px; padding: 20px; }
  .setup-panel {
    width: min(1320px, 100%);
    height: 860px;
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
    grid-template-rows: auto minmax(0, 1.1fr) minmax(0, 0.9fr);
    gap: 18px;
    padding: 24px;
    overflow: hidden;
  }
  .setup-header { grid-column: 1 / -1; margin-bottom: 0; }
  .companion-stage {
    grid-column: 1;
    grid-row: 2 / 4;
    grid-template-columns: 1fr;
    align-content: center;
    justify-items: stretch;
    gap: 22px;
    padding: 28px;
    text-align: center;
  }
  .stage-orb { width: 184px; justify-self: center; }
  [data-stage-character-canvas] { width: 168px; height: 168px; }
  .stage-copy { justify-items: center; }
  .stage-copy h2 { font-size: 26px; }
  .stage-tagline { font-size: 16px; }
  .stage-bubble { font-size: 17px; }
  .stage-status { width: 100%; text-align: left; }
  .stage-status strong { font-size: 16px; }
  .prompt-coach-panel {
    grid-column: 2;
    grid-row: 2;
    margin-bottom: 0;
    padding: 24px;
  }
  .prompt-coach-panel .decision-line { font-size: 17px; }
  .prompt-coach-field > span { font-size: 15px; }
  [data-prompt-draft-input] {
    min-height: 150px;
    font-size: 18px;
    line-height: 1.55;
  }
  .privacy-note { font-size: 14px; line-height: 1.55; }
  .skill-panel {
    grid-column: 2;
    grid-row: 3;
    margin-bottom: 0;
    padding: 22px 24px;
  }
  .next-step-skill { font-size: 16px; }
  .next-step-title { font-size: 23px; }
  .next-step-action { font-size: 18px; line-height: 1.5; }
  .next-step-reason { font-size: 16px; line-height: 1.5; }
  .live-status-panel,
  .feedback-metrics-panel,
  .guided-readiness-panel,
  .characters-panel,
  .diagnostics-panel { display: none !important; }
`;

test("committed recommendation WebM decodes and seeks in Chromium", async ({
  page,
  baseURL,
}) => {
  const videoPath = path.join(ROOT, "docs/demo/skill-recommendation.webm");
  const video = await fs.readFile(videoPath);

  expect([...video.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  expect(video.byteLength).toBeGreaterThan(100 * 1024);
  expect(baseURL).toBeTruthy();

  await page.setContent('<video muted playsinline preload="auto"></video>');
  const metadata = await page.evaluate(async (source) => {
    const element = document.querySelector("video");
    element.src = source;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("video_decode_timeout")), 5000);
      element.addEventListener(
        "canplay",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      element.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          reject(new Error(`video_decode_error:${element.error?.code ?? "unknown"}`));
        },
        { once: true },
      );
    });

    return {
      width: element.videoWidth,
      height: element.videoHeight,
      duration: element.duration,
      readyState: element.readyState,
    };
  }, new URL("/docs/demo/skill-recommendation.webm", baseURL).href);

  expect(metadata.width).toBe(1280);
  expect(metadata.height).toBe(720);
  expect(metadata.duration).toBeGreaterThanOrEqual(3);
  expect(metadata.duration).toBeLessThanOrEqual(10);
  expect(metadata.readyState).toBeGreaterThanOrEqual(3);

  const playback = await page.evaluate(async () => {
    const element = document.querySelector("video");
    await element.play();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("video_play_timeout")), 5000);
      const onProgress = () => {
        if (element.currentTime < 0.1) return;
        clearTimeout(timeout);
        element.removeEventListener("timeupdate", onProgress);
        resolve();
      };
      element.addEventListener("timeupdate", onProgress);
    });
    element.pause();

    const seekTarget = Math.min(1.5, element.duration - 0.25);
    element.currentTime = seekTarget;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("video_seek_timeout")), 5000);
      element.addEventListener(
        "seeked",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });

    return {
      currentTime: element.currentTime,
      errorCode: element.error?.code ?? null,
      readyState: element.readyState,
    };
  });

  expect(playback.currentTime).toBeCloseTo(1.5, 1);
  expect(playback.errorCode).toBeNull();
  expect(playback.readyState).toBeGreaterThanOrEqual(2);
});

test("captures a real diagnose recommendation", async ({ browser, baseURL }) => {
  const videoDirectory = path.join(ROOT, "test-results", "portfolio-video");
  const videoPath = path.join(ROOT, "docs/demo/skill-recommendation.webm");
  const screenshotPath = path.join(ROOT, "docs/screenshots/dashboard.png");
  await fs.mkdir(videoDirectory, { recursive: true });
  await fs.mkdir(path.dirname(videoPath), { recursive: true });

  expect(baseURL).toBeTruthy();
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1600, height: 900 },
    recordVideo: {
      dir: videoDirectory,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  const video = page.video();

  try {
    expect(page.viewportSize()).toEqual({ width: 1600, height: 900 });
    await page.goto("/setup-key.html");
    await page.addStyleTag({ content: CAPTURE_CSS });
    await page.locator("[data-prompt-draft-input]").fill(PROMPT);
    await expect(page.locator("[data-skill-hint]")).toContainText("diagnose", {
      timeout: 5000,
    });
    await expect(page.locator("[data-prompt-coach-status]")).toContainText(
      "先縮小錯誤範圍",
    );
    await expect(page.locator("[data-prompt-draft-input]")).toHaveValue(PROMPT);
    await expect(page.locator("[data-next-step-action]")).toHaveText(
      "Overlay 只會顯示這個 Skill 提醒，不改寫或插入 prompt。",
    );
    await expect(page.locator("[data-next-step-reason]")).toHaveText(
      "適合重現、定位並修復 bug 或測試失敗。",
    );
    const evidenceTypography = await page.evaluate(() => ({
      zoom: getComputedStyle(document.documentElement).zoom,
      prompt: Number.parseFloat(
        getComputedStyle(document.querySelector("[data-prompt-draft-input]")).fontSize,
      ),
      action: Number.parseFloat(
        getComputedStyle(document.querySelector("[data-next-step-action]")).fontSize,
      ),
      reason: Number.parseFloat(
        getComputedStyle(document.querySelector("[data-next-step-reason]")).fontSize,
      ),
    }));
    expect(evidenceTypography.zoom).toBe("1");
    expect(evidenceTypography.prompt).toBeGreaterThanOrEqual(18);
    expect(evidenceTypography.action).toBeGreaterThanOrEqual(18);
    expect(evidenceTypography.reason).toBeGreaterThanOrEqual(16);
    for (const selector of [
      "[data-prompt-draft-input]",
      "[data-skill-hint]",
      "[data-next-step-action]",
      "[data-next-step-reason]",
    ]) {
      await expect(page.locator(selector)).toBeInViewport();
    }
    await page.screenshot({
      path: screenshotPath,
      clip: { x: 80, y: 0, width: 1440, height: 900 },
    });
    await page.waitForTimeout(2500);
  } finally {
    await page.close();
    await context.close();
  }

  await video.saveAs(videoPath);
});
