import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const EVENT_URL = "http://127.0.0.1:5184/events";

test.beforeEach(async ({ request }) => {
  await request.delete(EVENT_URL);
});

test("user can run the companion demo and personalize it", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Vibe coding companion overlay")).toBeVisible();
  await expect(page.getByText("Vibe Meter")).toBeVisible();

  await page.getByRole("button", { name: "開始" }).click();
  await expect(page.locator("[data-agent-state]")).toHaveText("waiting", {
    timeout: 12000,
  });
  await expect(page.getByRole("button", { name: "重播" })).toBeVisible();

  await page.getByRole("button", { name: "Showcase" }).click();
  await page.locator("[data-scale-control]").fill("1.4");

  const statusBox = await page.locator("[data-status-line]").boundingBox();
  const meterBox = await page.locator("[data-vibe-meter]").boundingBox();

  expect(statusBox).not.toBeNull();
  expect(meterBox).not.toBeNull();
  expect(statusBox.y + statusBox.height).toBeLessThan(meterBox.y + 8);
});

test("overlay stays within the viewport on a desktop-sized screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  const companionBox = await page.locator(".companion").boundingBox();

  expect(companionBox).not.toBeNull();
  expect(companionBox.y).toBeGreaterThanOrEqual(0);
  expect(companionBox.y + companionBox.height).toBeLessThanOrEqual(720);
});

test("desktop and compact screenshot states render a nonblank character", async ({
  page,
}, testInfo) => {
  for (const size of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "compact", width: 420, height: 640 },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await page.locator('[data-debug-state="success"]').click();
    await page.getByRole("button", { name: "Showcase" }).click();

    const nonblankCanvas = await page.locator("[data-character-canvas]")
      .evaluate((canvas) => {
        const context = canvas.getContext("2d");
        const image = context.getImageData(0, 0, canvas.width, canvas.height);

        for (let index = 3; index < image.data.length; index += 4) {
          if (image.data[index] !== 0) {
            return true;
          }
        }

        return false;
      });

    expect(nonblankCanvas).toBe(true);

    const screenshot = await page.screenshot({ fullPage: false });
    await testInfo.attach(`${size.name}-companion`, {
      body: screenshot,
      contentType: "image/png",
    });
  }
});

test("event bridge controls drive the companion without breaking compact layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 640 });
  await page.goto("/");

  await page.getByRole("button", { name: "Snark" }).click();
  await page.locator('[data-event-trigger="test-failed"]').click();

  await expect(page.locator("[data-agent-state]")).toHaveText("error");
  await expect(page.locator("[data-event-last]")).toHaveText(
    "Last event: tool:finish test failed"
  );

  const companionBox = await page.locator(".companion").boundingBox();
  const statusBox = await page.locator("[data-status-line]").boundingBox();
  const meterBox = await page.locator("[data-vibe-meter]").boundingBox();

  expect(companionBox).not.toBeNull();
  expect(companionBox.y + companionBox.height).toBeLessThanOrEqual(640);
  expect(statusBox.height).toBeLessThanOrEqual(24);
  expect(statusBox.y + statusBox.height).toBeLessThan(meterBox.y + 8);
});

test("external CLI event changes the companion through the local event endpoint", async ({
  page,
}) => {
  await page.goto("/");

  await execFileAsync("npm", ["run", "emit:event", "--", "test-failed"], {
    cwd: process.cwd(),
    env: { ...process.env, EVENT_URL },
  });

  await expect(page.locator("[data-agent-state]")).toHaveText("error", {
    timeout: 3000,
  });
  await expect(page.locator("[data-event-last]")).toHaveText(
    "Last event: tool:finish test failed"
  );
});

test("Claude Code hook fixture changes the companion through the hook CLI", async ({
  page,
}) => {
  await page.goto("/");

  await execFileAsync(
    "npm",
    [
      "run",
      "emit:hook",
      "--",
      "claude-code",
      "fixtures/claude-code/test-failed.json",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, EVENT_URL },
    }
  );

  await expect(page.locator("[data-agent-state]")).toHaveText("error", {
    timeout: 3000,
  });
  await expect(page.locator("[data-event-last]")).toHaveText(
    "Last event: tool:finish test failed"
  );
});

test("desktop overlay chrome stays quiet instead of drawing debug frames", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 374 });
  await page.goto("/overlay.html");

  const chrome = await page.evaluate(() => {
    const dragStrip = document.querySelector("[data-overlay-drag]");
    const canvas = document.querySelector("[data-character-canvas]");
    const dragStyles = getComputedStyle(dragStrip);
    const dragBox = dragStrip.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();

    return {
      dragDisplay: dragStyles.display,
      dragBorderWidth: dragStyles.borderTopWidth,
      dragBoxShadow: dragStyles.boxShadow,
      dragWidth: Math.round(dragBox.width),
      canvasWidth: Math.round(canvasBox.width),
      hasHud: Boolean(document.querySelector(".overlay-hud")),
      hasVibeMeter: Boolean(document.querySelector("[data-vibe-meter]")),
      hasScaleControl: Boolean(document.querySelector("[data-scale-control]")),
      hasStatusLine: Boolean(document.querySelector("[data-status-line]")),
      viewportWidth: window.innerWidth,
    };
  });

  expect(chrome.dragDisplay).toBe("none");
  expect(chrome.dragBorderWidth).toBe("0px");
  expect(chrome.dragBoxShadow).toBe("none");
  expect(chrome.canvasWidth).toBeLessThanOrEqual(64);
  expect(chrome.hasHud).toBe(false);
  expect(chrome.hasVibeMeter).toBe(false);
  expect(chrome.hasScaleControl).toBe(false);
  expect(chrome.hasStatusLine).toBe(false);

  const activeChrome = await page.evaluate(() => {
    const root = document.querySelector("[data-overlay-root]");
    const dragStrip = document.querySelector("[data-overlay-drag]");
    root.dataset.overlayState = "coding";
    return {
      dragDisplay: getComputedStyle(dragStrip).display,
    };
  });

  expect(activeChrome.dragDisplay).toBe("none");
});
