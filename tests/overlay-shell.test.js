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

  it("uses the active character and characterized bubble from AI decisions", () => {
    document.body.innerHTML = '<main id="overlay"></main>';

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
    });

    overlay.sendEvent({
      type: "ai:decision",
      characterId: "foam-ghost",
      state: "debugging",
      intensity: "high",
      motion: "panic",
      nextStepAdvice: {
        title: "Prompt 草稿可補重現線索",
        action: "補上錯誤訊息、重現步驟或測試指令。",
        reason: "草稿看起來是在修 bug，但還缺少可重現的線索。",
        skill: "diagnose",
        priority: "medium",
        speakable: true,
        presentation: {
          characterId: "foam-ghost",
          title: "慢慢來：Prompt 草稿可補重現線索",
          action:
            "先不用急，補上錯誤訊息、重現步驟或測試指令。 也可以先用 Dashboard textarea。",
          bubble: "慢慢來：補上錯誤訊息、重現步驟或測試指令。",
        },
      },
    });

    expect(document.querySelector("[data-overlay-root]").dataset.activeCharacter)
      .toBe("foam-ghost");
    expect(document.querySelector("[data-dialogue-bubble]").textContent)
      .toBe("慢慢來：補上錯誤訊息、重現步驟或測試指令。");
  });

  it("passes the active character into overlay canvas drawing", () => {
    document.body.innerHTML = '<main id="overlay"></main>';
    const drawBlobImpl = vi.fn();

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
      animationEnabled: false,
      drawBlobImpl,
    });

    overlay.sendEvent({
      type: "ai:decision",
      characterId: "foam-ghost",
      state: "debugging",
      intensity: "medium",
      motion: "wander",
    });
    overlay.drawFrameForTest(300);

    expect(drawBlobImpl).toHaveBeenCalledWith(
      document.querySelector("[data-character-canvas]"),
      expect.objectContaining({
        characterId: "foam-ghost",
      })
    );
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

  it("throttles quiet overlay drawing and pauses while the page is hidden", () => {
    document.body.innerHTML = '<main id="overlay"></main>';
    const frameCallbacks = [];
    const listeners = new Map();
    const documentRef = {
      visibilityState: "visible",
      addEventListener: vi.fn((event, listener) => {
        listeners.set(event, listener);
      }),
      removeEventListener: vi.fn(),
    };
    const requestAnimationFrameImpl = vi.fn((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    const cancelAnimationFrameImpl = vi.fn();
    const drawBlobImpl = vi.fn();

    const overlay = mountOverlay(document.querySelector("#overlay"), {
      eventUrl: null,
      animationEnabled: true,
      documentRef,
      requestAnimationFrameImpl,
      cancelAnimationFrameImpl,
      drawBlobImpl,
    });

    frameCallbacks.shift()(0);
    frameCallbacks.shift()(100);
    frameCallbacks.shift()(250);

    expect(drawBlobImpl).toHaveBeenCalledTimes(2);

    documentRef.visibilityState = "hidden";
    listeners.get("visibilitychange")();

    expect(cancelAnimationFrameImpl).toHaveBeenCalled();

    documentRef.visibilityState = "visible";
    listeners.get("visibilitychange")();
    frameCallbacks.shift()(500);

    expect(drawBlobImpl).toHaveBeenCalledTimes(3);

    overlay.destroy();
  });
});
