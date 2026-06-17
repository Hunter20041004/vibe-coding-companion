// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { mountOverlay } from "../src/overlay.js";

describe("Codex companion overlay shell", () => {
  it("renders a compact transparent overlay surface without the debug panel", () => {
    document.body.innerHTML = '<main id="overlay"></main>';

    mountOverlay(document.querySelector("#overlay"), { eventUrl: null });

    expect(document.querySelector("[data-overlay-root]")).toBeTruthy();
    expect(document.querySelector("[data-overlay-drag]")).toBeTruthy();
    expect(document.querySelector("[data-character-canvas]")).toBeTruthy();
    expect(document.querySelector("[data-vibe-meter]")).toBeNull();
    expect(document.querySelector("[data-debug-panel]")).toBeNull();
    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "idle"
    );
  });

  it("keeps the desktop overlay free of progress-bar controls", () => {
    document.body.innerHTML = '<main id="overlay"></main>';

    mountOverlay(document.querySelector("#overlay"), { eventUrl: null });

    expect(document.querySelector("[data-vibe-meter]")).toBeNull();
    expect(document.querySelector("[data-scale-control]")).toBeNull();
    expect(document.querySelector("[data-status-line]")).toBeNull();
  });

  it("maps live events into overlay state and light tone", () => {
    document.body.innerHTML = '<main id="overlay"></main>';

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
    });
    const mappedState = overlay.sendEvent({
      type: "tool:finish",
      tool: "test",
      status: "failed",
    });

    expect(mappedState).toBe("error");
    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "error"
    );
    expect(document.querySelector("[data-status-light]").dataset.tone).toBe(
      "blocked"
    );
  });

  it("keeps AI reaction metadata for animation without adding visible HUD text", () => {
    document.body.innerHTML = '<main id="overlay"></main>';

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
    });

    overlay.sendEvent({
      type: "ai:decision",
      state: "debugging",
      intensity: "high",
      motion: "panic",
      line: "Tests are being dramatic.",
    });

    const overlayRoot = document.querySelector("[data-overlay-root]");

    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "debugging"
    );
    expect(overlayRoot.dataset.aiIntensity).toBe("high");
    expect(overlayRoot.dataset.aiMotion).toBe("panic");
    expect(overlayRoot.dataset.aiLine).toBe("Tests are being dramatic.");
    expect(document.querySelector("[data-status-line]")).toBeNull();
  });

  it("shows a compact speech bubble for AI skill hints", () => {
    document.body.innerHTML = '<main id="overlay"></main>';

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
    });

    overlay.sendEvent({
      type: "ai:decision",
      state: "debugging",
      intensity: "high",
      motion: "panic",
      line: "Tests are being dramatic.",
      skillHint: {
        skill: "diagnose",
        confidence: "high",
        reason: "適合重現、定位並修復 bug 或測試失敗。",
      },
    });

    const bubble = document.querySelector("[data-dialogue-bubble]");

    expect(bubble.hidden).toBe(false);
    expect(bubble.textContent).toBe(
      "用 diagnose。先重現錯誤，再縮小範圍。"
    );
    expect(document.querySelector("[data-overlay-root]").dataset.companionGesture)
      .toBe("point");
  });

  it("shows a compact speech bubble for next-step advice", () => {
    document.body.innerHTML = '<main id="overlay"></main>';

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
    });

    overlay.sendEvent({
      type: "ai:decision",
      state: "debugging",
      intensity: "high",
      motion: "panic",
      line: "Tests are being dramatic.",
      skillHint: {
        skill: "diagnose",
        confidence: "high",
      },
      nextStepAdvice: {
        title: "先縮小測試失敗範圍",
        action:
          "用 diagnose 重現最小失敗案例，再分辨是產品邏輯還是測試假設壞掉。",
        skill: "diagnose",
        priority: "high",
      },
    });

    const bubble = document.querySelector("[data-dialogue-bubble]");

    expect(bubble.hidden).toBe(false);
    expect(bubble.textContent).toBe("用 diagnose：重現最小失敗案例。");
    expect(document.querySelector("[data-overlay-root]").dataset.companionGesture)
      .toBe("point");
  });

  it("hides the speech bubble when the overlay returns to a quiet event", () => {
    document.body.innerHTML = '<main id="overlay"></main>';

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
    });

    overlay.sendEvent({
      type: "ai:decision",
      state: "debugging",
      line: "Tests are being dramatic.",
    });
    overlay.sendEvent({ type: "turn:complete" });

    const bubble = document.querySelector("[data-dialogue-bubble]");

    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "waiting"
    );
    expect(bubble.hidden).toBe(true);
    expect(bubble.textContent).toBe("");
  });

  it("auto-hides speech after the brain reaction ttl", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main id="overlay"></main>';

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
    });

    overlay.sendEvent({
      type: "ai:decision",
      state: "debugging",
      intensity: "high",
      motion: "panic",
      skillHint: {
        skill: "diagnose",
        confidence: "high",
      },
    });
    expect(document.querySelector("[data-dialogue-bubble]").hidden).toBe(false);

    vi.advanceTimersByTime(4200);

    expect(document.querySelector("[data-dialogue-bubble]").hidden).toBe(true);
    expect(document.querySelector("[data-dialogue-bubble]").textContent).toBe("");
    vi.useRealTimers();
  });

  it("uses work context to speak after repeated raw failed-test events", () => {
    document.body.innerHTML = '<main id="overlay"></main>';

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
    });

    overlay.sendEvent({
      type: "tool:finish",
      tool: "test",
      status: "failed",
    });
    overlay.sendEvent({
      type: "tool:finish",
      tool: "test",
      status: "failed",
    });

    const bubble = document.querySelector("[data-dialogue-bubble]");

    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "error"
    );
    expect(bubble.hidden).toBe(false);
    expect(bubble.textContent).toBe(
      "連續測試失敗。用 diagnose 先縮小範圍。"
    );
  });

  it("applies overlay calibration settings to the canvas surface", async () => {
    document.body.innerHTML = '<main id="overlay"></main>';

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
      settingsUrl: "http://127.0.0.1:5174/settings/overlay",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          settings: {
            idleSize: 92,
            activeScale: 1.2,
            wanderSpeed: 1.5,
            safeMargin: 36,
          },
        }),
      }),
    });

    await overlay.pollSettingsOnce();

    const overlayRoot = document.querySelector("[data-overlay-root]");
    const canvas = document.querySelector("[data-character-canvas]");

    expect(overlayRoot.dataset.idleSize).toBe("92");
    expect(overlayRoot.dataset.activeScale).toBe("1.2");
    expect(canvas.style.getPropertyValue("--idle-canvas-size")).toBe("92px");
    expect(canvas.style.getPropertyValue("--active-canvas-size")).toBe("142px");
  });

  it("settles short-lived success and error reactions back to waiting", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main id="overlay"></main>';

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
      transientMs: 1400,
    });

    overlay.sendEvent({
      type: "ai:decision",
      state: "success",
      intensity: "high",
      motion: "celebrate",
    });
    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "success"
    );

    vi.advanceTimersByTime(1400);

    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "waiting"
    );
    vi.useRealTimers();
  });
});
