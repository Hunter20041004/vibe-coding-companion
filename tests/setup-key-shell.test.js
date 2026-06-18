// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { mountSetupKeyPage } from "../src/setup-key.js";

describe("Google AI Studio key setup page", () => {
  it("loads companion status into the control panel", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: true,
            provider: "google",
            model: "gemma-4-31b-it",
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });

    await waitFor(() => {
      expect(document.querySelector("[data-server-status]").textContent).toBe(
        "online"
      );
    });
    expect(document.querySelector("[data-ai-status]").textContent).toBe(
      "configured"
    );
    expect(document.querySelector("[data-model-status]").textContent).toBe(
      "gemma-4-31b-it"
    );
  });

  it("shows an actionable runtime readiness checklist when local services are not ready", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        throw new Error("server_not_running");
      }

      if (url.endsWith("/settings/overlay")) {
        throw new Error("overlay_settings_unavailable");
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });

    await waitFor(() => {
      expect(document.querySelector("[data-startup-command]").textContent)
        .toContain("npm run companion:start");
    });
    expect(document.querySelector("[data-runtime-server]").textContent)
      .toContain("啟動本機 runtime");
    expect(document.querySelector("[data-runtime-ai]").textContent).toContain(
      "npm run companion:setup-key"
    );
    expect(document.querySelector("[data-runtime-overlay]").textContent)
      .toContain("套用 overlay 調校");
    expect(document.querySelector("[data-startup-action]").textContent)
      .toContain("先執行 npm run companion:start");
  });

  it("shows the current session summary in the local Companion Console", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: true,
            provider: "google",
            model: "gemma-4-31b-it",
          }),
        };
      }

      if (url.endsWith("/session/summary")) {
        return {
          ok: true,
          json: async () => ({
            summary: {
              title: "正在修測試失敗",
              phase: "debugging",
              summary: "你剛讀過脈絡、改過程式，測試目前仍失敗。",
              signals: ["read x1", "edit x1", "test failed x1"],
              confidence: "high",
            },
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });

    await waitFor(() => {
      expect(document.querySelector("[data-session-summary-title]").textContent)
        .toContain("正在修測試失敗");
    });
    expect(document.querySelector("[data-session-summary-phase]").textContent)
      .toContain("debugging");
    expect(document.querySelector("[data-session-summary-body]").textContent)
      .toContain("測試目前仍失敗");
    expect(document.querySelector("[data-session-summary-signals]").textContent)
      .toContain("read x1");
  });

  it("loads the latest next-step advice from captured events on open", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: true,
            provider: "google",
            model: "gemma-4-31b-it",
          }),
        };
      }

      if (url.endsWith("/events?since=0")) {
        return {
          ok: true,
          json: async () => ({
            events: [
              {
                id: 1,
                event: {
                  type: "ai:decision",
                  state: "error",
                  skillHint: {
                    skill: "diagnose",
                    confidence: "high",
                    reason: "適合重現、定位並修復 bug 或測試失敗。",
                  },
                  nextStepAdvice: {
                    title: "先縮小測試失敗範圍",
                    action:
                      "用 diagnose 重現最小失敗案例，再分辨是產品邏輯還是測試假設壞掉。",
                    reason: "最近連續 2 次測試失敗。",
                    skill: "diagnose",
                    priority: "high",
                  },
                },
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });

    await waitFor(() => {
      expect(document.querySelector("[data-next-step-title]").textContent)
        .toContain("先縮小測試失敗範圍");
    });
    expect(document.querySelector("[data-skill-hint]").textContent).toContain(
      "diagnose"
    );
  });

  it("saves a pasted key to the local settings endpoint and clears the input", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        saved: true,
        provider: "google",
        model: "gemma-4-31b-it",
      }),
    }));
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });
    const input = document.querySelector("[data-api-key-input]");
    input.value = "new-google-key";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    document
      .querySelector("[data-setup-form]")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:5174/settings/google-ai-key",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: "new-google-key",
          model: "gemma-4-31b-it",
        }),
      })
    );
    await waitFor(() => {
      expect(document.querySelector("[data-setup-status]").textContent).toContain(
        "已儲存"
      );
    });
    expect(input.value).toBe("");
  });

  it("sends a test event and shows the latest AI decision", async () => {
    const fetchImpl = vi.fn(async (url, options = {}) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: true,
            provider: "google",
            model: "gemma-4-31b-it",
          }),
        };
      }

      if (url.endsWith("/events") && options.method === "DELETE") {
        return { ok: true, json: async () => ({ cleared: true }) };
      }

      if (url.endsWith("/events") && options.method === "POST") {
        return { ok: true, json: async () => ({ accepted: true, id: 1 }) };
      }

      if (url.endsWith("/events?since=0")) {
        return {
          ok: true,
          json: async () => ({
            events: [
              {
                id: 1,
                event: {
                  type: "tool:finish",
                  tool: "test",
                  status: "failed",
                },
              },
              {
                id: 2,
                event: {
                  type: "ai:decision",
                  state: "error",
                  intensity: "high",
                  motion: "panic",
                  line: "The tests are acting up.",
                  skillHint: {
                    skill: "diagnose",
                    confidence: "high",
                    reason: "適合重現、定位並修復 bug 或測試失敗。",
                  },
                  nextStepAdvice: {
                    title: "先縮小測試失敗範圍",
                    action:
                      "用 diagnose 重現最小失敗案例，再分辨是產品邏輯還是測試假設壞掉。",
                    reason: "最近連續 2 次測試失敗。",
                    skill: "diagnose",
                    priority: "high",
                  },
                },
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });
    document.querySelector("[data-send-test-event]").click();

    await waitFor(() => {
      expect(document.querySelector("[data-last-ai-decision]").textContent)
        .toContain("The tests are acting up.");
    });
    expect(document.querySelector("[data-skill-hint]").textContent).toContain(
      "diagnose"
    );
    expect(document.querySelector("[data-next-step-title]").textContent)
      .toContain("先縮小測試失敗範圍");
    expect(document.querySelector("[data-next-step-action]").textContent)
      .toContain("重現最小失敗案例");
    expect(document.querySelector("[data-next-step-reason]").textContent)
      .toContain("最近連續 2 次測試失敗");
    expect(document.querySelector("[data-next-step-priority]").textContent)
      .toContain("high");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:5174/events",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "tool:finish",
          tool: "test",
          status: "failed",
        }),
      })
    );
  });

  it("captures one approved screen frame and shows the vision context", async () => {
    const captureScreenFrame = vi.fn(async () => {
      return "data:image/png;base64,ZmFrZS1wbmc=";
    });
    const fetchImpl = vi.fn(async (url, options = {}) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: true,
            provider: "google",
            model: "gemma-4-31b-it",
          }),
        };
      }

      if (url.endsWith("/settings/overlay") && !options.method) {
        return {
          ok: true,
          json: async () => ({
            settings: {
              idleSize: 64,
              activeScale: 1,
              wanderSpeed: 1,
              safeMargin: 24,
            },
          }),
        };
      }

      if (url.endsWith("/vision/context") && options.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            context: {
              activity: "Reviewing a failed test result in Codex.",
              suggestedState: "error",
              confidence: 0.82,
              visibleSignals: ["failed test output", "Codex window"],
            },
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), {
      fetchImpl,
      captureScreenFrame,
    });
    document.querySelector("[data-analyze-screen]").click();

    await waitFor(() => {
      expect(document.querySelector("[data-vision-context]").textContent)
        .toContain("Reviewing a failed test result in Codex.");
    });
    expect(captureScreenFrame).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:5174/vision/context",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: "data:image/png;base64,ZmFrZS1wbmc=",
        }),
      })
    );
  });

  it("loads and saves overlay calibration settings", async () => {
    const fetchImpl = vi.fn(async (url, options = {}) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: true,
            provider: "google",
            model: "gemma-4-31b-it",
          }),
        };
      }

      if (url.endsWith("/settings/overlay") && !options.method) {
        return {
          ok: true,
          json: async () => ({
            settings: {
              idleSize: 76,
              activeScale: 1,
              wanderSpeed: 1,
              safeMargin: 24,
              preferredSide: "right",
            },
          }),
        };
      }

      if (url.endsWith("/settings/overlay") && options.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            saved: true,
            settings: JSON.parse(options.body),
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });

    await waitFor(() => {
      expect(document.querySelector("[data-overlay-idle-size]").value).toBe("76");
    });
    expect(document.querySelector("[data-overlay-preferred-side]").value).toBe(
      "right"
    );
    document.querySelector("[data-overlay-idle-size]").value = "92";
    document.querySelector("[data-overlay-active-scale]").value = "1.2";
    document.querySelector("[data-overlay-wander-speed]").value = "1.5";
    document.querySelector("[data-overlay-safe-margin]").value = "36";
    document.querySelector("[data-overlay-preferred-side]").value = "left";
    document
      .querySelector("[data-overlay-settings-form]")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(document.querySelector("[data-overlay-settings-status]").textContent)
        .toContain("已套用");
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:5174/settings/overlay",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          idleSize: 92,
          activeScale: 1.2,
          wanderSpeed: 1.5,
          safeMargin: 36,
          preferredSide: "left",
        }),
      })
    );
  });

  it("shows placement diagnostics in the local Companion Console", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: true,
            provider: "google",
            model: "gemma-4-31b-it",
          }),
        };
      }

      if (url.endsWith("/settings/overlay")) {
        return {
          ok: true,
          json: async () => ({
            settings: {
              idleSize: 64,
              activeScale: 1,
              wanderSpeed: 1,
              safeMargin: 24,
              preferredSide: "auto",
            },
          }),
        };
      }

      if (url.includes("/placement/diagnostic")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            state: "coding",
            safeZone: "right-edge",
            placementMode: "geometry-fallback",
            foreground: {
              appName: "Codex",
              windowTitle: "Codex",
              visible: true,
              bounds: { x: 15, y: 47, width: 1423, height: 807 },
            },
            accessibility: { regionCount: 0, status: "empty" },
            avoidRegionCount: 3,
            chosenBounds: { x: 27, y: 354, width: 132, height: 156 },
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });
    document.querySelector("[data-overlay-preferred-side]").value = "left";
    document.querySelector("[data-refresh-placement]").click();

    await waitFor(() => {
      expect(document.querySelector("[data-placement-mode]").textContent)
        .toContain("geometry-fallback");
    });
    expect(document.querySelector("[data-placement-foreground]").textContent)
      .toContain("Codex");
    expect(document.querySelector("[data-placement-bounds]").textContent)
      .toContain("132x156 @ 27,354");
    expect(document.querySelector("[data-placement-avoid]").textContent)
      .toContain("3 no-fly");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:5174/placement/diagnostic?state=coding&safeZone=right-edge&preferredSide=left"
    );
  });
});

async function waitFor(assertion, timeoutMs = 250) {
  const start = Date.now();
  let lastError;

  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw lastError;
}
