import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const EVENT_URL = "http://127.0.0.1:5184/events";

test.beforeEach(async ({ request }) => {
  await request.delete(EVENT_URL);
});

test("root opens the daily dashboard instead of the old demo shell", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Vibe Companion Dashboard");
  await expect(page.locator("[data-setup-root]")).toBeVisible();
  await expect(page.locator("[data-character-option]")).toHaveCount(3);
  await expect(page.locator(".companion")).toHaveCount(0);
});

test("user can run the companion demo and personalize it", async ({ page }) => {
  await page.goto("/demo.html");

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
  await page.goto("/demo.html");

  const companionBox = await page.locator(".companion").boundingBox();

  expect(companionBox).not.toBeNull();
  expect(companionBox.y).toBeGreaterThanOrEqual(0);
  expect(companionBox.y + companionBox.height).toBeLessThanOrEqual(720);
});

test("setup console keeps the readiness checklist visible at the top of a long page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/setup-key.html");

  await expect(page).toHaveTitle("Vibe Companion Dashboard");
  await expect(page.locator("[data-readiness-item]")).toHaveCount(3);

  const panelBox = await page.locator(".setup-panel").boundingBox();
  const readinessBox = await page.locator("[data-guided-readiness]")
    .boundingBox();

  expect(panelBox).not.toBeNull();
  expect(readinessBox).not.toBeNull();
  expect(panelBox.y).toBeGreaterThanOrEqual(0);
  expect(readinessBox.y).toBeGreaterThanOrEqual(0);
  await expect(page.locator("[data-diagnostics-panel]")).not.toHaveAttribute(
    "open",
    ""
  );
});

test("daily companion dashboard drives character prompt coach and hook overlay flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/setup-key.html");

  await expect(page.locator("[data-companion-stage]")).toBeVisible();
  await expect(page.locator("[data-diagnostics-panel]")).not.toHaveAttribute(
    "open",
    ""
  );
  await expect(page.locator("[data-readiness-item]")).toHaveCount(3);
  await expect(page.locator('[data-readiness-item="start-companion"]'))
    .toBeVisible();
  await expect(page.locator('[data-readiness-item="try-skill-hint"]'))
    .toBeVisible();
  await expect(page.locator("[data-character-preview-canvas]")).toHaveCount(3);
  await expect(page.locator("[data-stage-character-canvas]")).toBeVisible();
  const previewCanvasesAreDrawn = await page
    .locator("[data-character-list]")
    .evaluate((list) =>
      Array.from(list.querySelectorAll("[data-character-preview-canvas]")).every(
        (canvas) => {
          const context = canvas.getContext("2d");
          const image = context.getImageData(0, 0, canvas.width, canvas.height);

          for (let index = 3; index < image.data.length; index += 4) {
            if (image.data[index] !== 0) return true;
          }

          return false;
        }
      )
    );

  expect(previewCanvasesAreDrawn).toBe(true);
  const previewFingerprints = await page
    .locator("[data-character-list]")
    .evaluate((list) =>
      Array.from(list.querySelectorAll("[data-character-preview-canvas]")).map(
        (canvas) => {
          const gridSize = 14;
          const cellWidth = canvas.width / gridSize;
          const cellHeight = canvas.height / gridSize;
          const context = canvas.getContext("2d");
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const cells = [];

          for (let gridY = 0; gridY < gridSize; gridY += 1) {
            for (let gridX = 0; gridX < gridSize; gridX += 1) {
              let occupied = false;
              const startX = Math.floor(gridX * cellWidth);
              const endX = Math.ceil((gridX + 1) * cellWidth);
              const startY = Math.floor(gridY * cellHeight);
              const endY = Math.ceil((gridY + 1) * cellHeight);

              for (let y = startY; y < endY && !occupied; y += 1) {
                for (let x = startX; x < endX; x += 1) {
                  const alphaIndex = (y * canvas.width + x) * 4 + 3;
                  if (image.data[alphaIndex] !== 0) {
                    occupied = true;
                    break;
                  }
                }
              }

              cells.push(occupied ? "1" : "0");
            }
          }

          return cells.join("");
        }
      )
    );

  expect(new Set(previewFingerprints).size).toBe(3);

  await page.locator('[data-character-option="foam-ghost"]').click();
  await expect(page.locator("[data-setup-root]")).toHaveAttribute(
    "data-active-character",
    "foam-ghost"
  );
  await expect(page.locator("[data-stage-character-canvas]")).toHaveAttribute(
    "data-character-id",
    "foam-ghost"
  );
  await expect(page.locator("[data-active-character-name]")).toContainText(
    "奶泡幽靈"
  );

  await page
    .locator("[data-prompt-draft-input]")
    .fill("fix the failing checkout test, it crashes in CI");
  await expect(page.locator("[data-polished-prompt-panel]")).toBeHidden();
  await expect(page.locator("[data-prompt-coach-status]")).toContainText(
    "先縮小錯誤範圍",
    { timeout: 5000 }
  );
  await expect(page.locator("[data-skill-hint]")).toContainText("diagnose");

  await page.locator("[data-diagnostics-panel] > summary").click();
  await page.locator("[data-send-test-event]").click();
  await expect(page.locator("[data-last-ai-decision]")).toContainText(
    "已送出 hook 測試事件",
    { timeout: 5000 }
  );

  await page.goto("/overlay.html");
  await expect(page.locator("[data-agent-state]")).toHaveText("error", {
    timeout: 3000,
  });
  await expect(page.locator("[data-overlay-root]")).toHaveAttribute(
    "data-active-character",
    "foam-ghost"
  );
});

test("ambient skill hints handle typing, low confidence, handoff, and feedback", async ({
  page,
  request,
}) => {
  await page.goto("/overlay.html");

  await request.post(EVENT_URL, {
    data: {
      type: "prompt:typing",
      source: "accessibility",
      provider: "codex",
      appName: "Codex",
      prompt: "private typing prompt",
    },
  });
  await expect(page.locator("[data-agent-state]")).toHaveText("typing", {
    timeout: 3000,
  });
  await expect(page.locator("[data-dialogue-bubble]")).toBeHidden();

  await request.post(EVENT_URL, {
    data: {
      type: "prompt:draft",
      source: "console",
      provider: "codex",
      prompt: "please help me with this unclear situation today",
    },
  });
  await expect(page.locator("[data-agent-state]")).toHaveText("stuck", {
    timeout: 3000,
  });
  await expect(page.locator("[data-dialogue-bubble]")).toBeHidden();

  await request.post(EVENT_URL, {
    data: {
      type: "agent:focus",
      provider: "codex",
      appName: "Codex",
      windowTitle: "Codex",
    },
  });
  await request.post(EVENT_URL, {
    data: {
      type: "prompt:draft",
      source: "console",
      provider: "codex",
      prompt: "調整 overlay UI layout，讓提示泡泡更像助手",
    },
  });
  await request.post(EVENT_URL, {
    data: {
      type: "agent:focus",
      provider: "claude-code",
      appName: "Claude",
      windowTitle: "Claude Code",
      conversation: "private conversation",
    },
  });

  await expect(page.locator("[data-dialogue-bubble]")).toContainText(
    "剛才在 Codex 做 UI",
    { timeout: 3000 }
  );

  const eventPayload = await (await request.get(`${EVENT_URL}?since=0`)).json();
  expect(JSON.stringify(eventPayload.events)).not.toContain("private");

  await page.goto("/setup-key.html");
  await page
    .locator("[data-prompt-draft-input]")
    .fill("fix the failing checkout test, it crashes in CI");
  await expect(page.locator("[data-skill-hint]")).toContainText("diagnose", {
    timeout: 5000,
  });
  await page.locator("[data-feedback-helpful]").click();
  await page.locator("[data-feedback-snooze]").click();
  await page.locator("[data-feedback-dismiss]").click();
  await expect(page.locator("[data-feedback-helpful-count]")).toContainText(
    "1",
    { timeout: 5000 }
  );
  await expect(page.locator("[data-feedback-snoozed-count]")).toContainText("1");
  await expect(page.locator("[data-feedback-dismissed-count]")).toContainText(
    "1"
  );
});

test("desktop and compact screenshot states render a nonblank character", async ({
  page,
}, testInfo) => {
  for (const size of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "compact", width: 420, height: 640 },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/demo.html");
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
  await page.goto("/demo.html");

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
  await page.goto("/demo.html");

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
  await page.goto("/demo.html");

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
