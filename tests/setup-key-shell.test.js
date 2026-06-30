// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountSetupKeyPage } from "../src/setup-key.js";

describe("Google AI Studio key setup page", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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
      .toContain("啟動本機服務");
    expect(document.querySelector("[data-runtime-ai]").textContent).toContain(
      "npm run companion:setup-key"
    );
    expect(document.querySelector("[data-runtime-overlay]").textContent)
      .toContain("套用桌面小精靈調校");
    expect(document.querySelector("[data-startup-action]").textContent)
      .toContain("先執行 npm run companion:start");
  });

  it("opens as an ambient companion dashboard before diagnostics", async () => {
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
      expect(document.querySelector("[data-companion-stage]")).toBeTruthy();
    });

    expect(document.querySelector("h1").textContent).toContain(
      "Codex / Claude Code 低調陪伴"
    );
    expect(document.querySelector("[data-dashboard-intro]").textContent)
      .toContain("只有在高信心時提醒可用的 Skill");
    expect(
      [...document.querySelectorAll("[data-dashboard-section]")].map(
        (section) => section.dataset.dashboardSection
      )
    ).toEqual([
      "companion-stage",
      "live-status",
      "try-skill-hint",
      "feedback-metrics",
      "guided-readiness",
      "characters",
      "diagnostics",
    ]);
    expect(document.querySelector("[data-next-step-title]").textContent)
      .toContain("等待高信心 Skill 訊號");
    expect(document.querySelector("[data-active-character-name]").textContent)
      .toContain("宇宙水母");
    expect(document.querySelector("[data-diagnostics-panel]").open).toBe(false);
  });

  it("shows three beginner steps and keeps engineering readiness in diagnostics", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: false,
            provider: null,
            model: null,
          }),
        };
      }

      if (url.endsWith("/settings/overlay")) {
        throw new Error("overlay_settings_unavailable");
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });

    await waitFor(() => {
      expect(document.querySelectorAll("[data-readiness-item]").length).toBe(3);
    });

    expect(
      [...document.querySelectorAll("[data-readiness-item]")].map(
        (item) => item.dataset.readinessItem
      )
    ).toEqual([
      "start-companion",
      "pick-character",
      "try-skill-hint",
    ]);
    expect(
      [...document.querySelectorAll("[data-advanced-readiness-item]")].map(
        (item) => item.dataset.advancedReadinessItem
      )
    ).toEqual([
      "server",
      "overlay",
      "permissions",
      "codex-hooks",
      "claude-code-hooks",
      "ai-key",
      "prompt-watcher",
    ]);
    expect(document.querySelector("[data-privacy-note]").textContent)
      .toContain("只會用草稿暫時判斷 Skill");
  });

  it("renders guided readiness from the local diagnostic endpoint", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: false,
            provider: null,
            model: null,
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
            },
          }),
        };
      }

      if (url.endsWith("/readiness/diagnostic")) {
        return {
          ok: true,
          json: async () => ({
            permissions: "ready",
            hooks: {
              codex: "ready",
              claudeCode: "missing",
            },
            promptWatcher: "ready",
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });

    await waitFor(() => {
      expect(
        document.querySelector('[data-advanced-readiness-item="codex-hooks"]')
          .dataset.state
      ).toBe("ready");
    });
    expect(document.querySelector('[data-advanced-readiness-item="permissions"]')
      .dataset.state).toBe("ready");
    expect(document.querySelector('[data-advanced-readiness-item="prompt-watcher"]')
      .dataset.state).toBe("ready");
    expect(document.querySelector('[data-advanced-readiness-item="claude-code-hooks"]')
      .dataset.state).toBe("needs-action");
  });

  it("saves active character selection and updates the companion stage", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: false,
            provider: null,
            model: null,
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });
    document
      .querySelector('[data-character-option="foam-ghost"]')
      .click();

    expect(document.querySelector("[data-setup-root]").dataset.activeCharacter)
      .toBe("foam-ghost");
    expect(document.querySelector("[data-stage-character-canvas]")
      .dataset.characterId).toBe("foam-ghost");
    expect(document.querySelector("[data-active-character-name]").textContent)
      .toContain("奶泡幽靈");
    expect(document.querySelector("[data-active-character-bubble]").textContent)
      .toContain("只在訊號夠清楚時提醒一個 Skill");
    expect(JSON.parse(window.localStorage.getItem(
      "vibe-coding-companion-preferences"
    )).activeCharacterId).toBe("foam-ghost");
  });

  it("renders a visible preview canvas for each built-in character", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: false,
            provider: null,
            model: null,
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });

    const previews = document.querySelectorAll("[data-character-preview-canvas]");

    expect(previews).toHaveLength(3);
    expect([...previews].map((canvas) => canvas.dataset.characterId)).toEqual([
      "cosmic-jellyfish",
      "foam-ghost",
      "green-phosphor-pixel",
    ]);
  });

  it("gives visible feedback after refresh buttons run", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: false,
            provider: null,
            model: null,
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
            },
          }),
        };
      }

      if (url.endsWith("/readiness/diagnostic")) {
        return {
          ok: true,
          json: async () => ({
            permissions: "ready",
            hooks: {
              codex: "ready",
              claudeCode: "ready",
            },
            promptWatcher: "ready",
          }),
        };
      }

      if (url.endsWith("/session/summary")) {
        return {
          ok: true,
          json: async () => ({
            summary: null,
          }),
        };
      }

      if (url.endsWith("/events")) {
        return {
          ok: true,
          json: async () => ({
            events: [],
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });

    await waitFor(() => {
      expect(document.querySelector("[data-refresh-status]").textContent)
        .toContain("同步狀態");
    });

    document.querySelector("[data-refresh-status]").click();
    await waitFor(() => {
      expect(document.querySelector("[data-refresh-status]").textContent)
        .toBe("已更新");
    });

    document.querySelector("[data-refresh-readiness]").click();
    await waitFor(() => {
      expect(document.querySelector("[data-refresh-readiness]").textContent)
        .toBe("已檢查");
    });
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

  it("does not show captured work advice before the beginner starts", async () => {
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
        .toContain("等待高信心 Skill 訊號");
    });
    expect(document.querySelector("[data-skill-hint]").textContent).toContain(
      "還不用選技能"
    );
  });

  it("can still load latest work advice when explicitly refreshed", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: false,
            provider: null,
            model: null,
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
                  state: "debugging",
                  skillHint: {
                    skill: "diagnose",
                    confidence: "high",
                    reason:
                      "Disciplined diagnosis loop for hard bugs and performance regressions. Reproduce → minimise → hypothesise → instrument → fix → regression-test.",
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

    const page = mountSetupKeyPage(document.querySelector("#setup"), {
      fetchImpl,
    });
    await page.refreshLatestDecision();

    await waitFor(() => {
      expect(document.querySelector("[data-skill-hint]").textContent).toBe(
        "diagnose / high：Disciplined diagnosis loop for hard bugs and performance regressions."
      );
    });
  });

  it("shows local feedback metrics and records hint feedback actions", async () => {
    const postedEvents = [];
    const fetchImpl = vi.fn(async (url, options = {}) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: false,
            provider: null,
            model: null,
          }),
        };
      }

      if (url.endsWith("/companion/metrics")) {
        return {
          ok: true,
          json: async () => ({
            metrics: {
              hintsShown: 2,
              helpful: 1,
              snoozed: 0,
              dismissed: 1,
              providerFocusChanges: 3,
              promptTypingEvents: 5,
            },
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
                  state: "thinking",
                  skillHint: {
                    skill: "diagnose",
                    confidence: "high",
                    source: "prompt-draft",
                    scenario: "bug",
                    bubble: "先縮小錯誤範圍。可用 diagnose。",
                  },
                },
              },
            ],
          }),
        };
      }

      if (url.endsWith("/events") && options.method === "POST") {
        postedEvents.push(JSON.parse(options.body));
        return { ok: true, json: async () => ({ accepted: true, id: 2 }) };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    const page = mountSetupKeyPage(document.querySelector("#setup"), {
      fetchImpl,
    });
    await page.refreshLatestDecision();
    await page.refreshMetrics();

    expect(document.querySelector("[data-feedback-hints-shown]").textContent)
      .toBe("2");
    expect(document.querySelector("[data-feedback-helpful-count]").textContent)
      .toBe("1");
    expect(document.querySelector("[data-feedback-focus-count]").textContent)
      .toBe("3");

    document.querySelector("[data-feedback-helpful]").click();
    document.querySelector("[data-feedback-snooze]").click();
    document.querySelector("[data-feedback-dismiss]").click();

    await waitFor(() => {
      expect(postedEvents.map((event) => event.type)).toEqual([
        "companion:hint_helpful",
        "companion:hint_snoozed",
        "companion:hint_dismissed",
      ]);
    });
    expect(postedEvents[0]).toEqual({
      type: "companion:hint_helpful",
      skill: "diagnose",
      source: "prompt-draft",
      confidence: "high",
      scenario: "bug",
    });
  });

  it("simulates a skill hint without producing a polished prompt", async () => {
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

      if (url.endsWith("/events") && options.method === "POST") {
        expect(JSON.parse(options.body).characterId).toBe("cosmic-jellyfish");
        return { ok: true, json: async () => ({ accepted: true, id: 5 }) };
      }

      if (url.endsWith("/events?since=0")) {
        return {
          ok: true,
          json: async () => ({
            events: [
              {
                id: 5,
                event: {
                  type: "ai:decision",
                  source: "prompt:draft",
                  state: "thinking",
                  skillHint: {
                    skill: "diagnose",
                    confidence: "high",
                    reason: "適合重現、定位並修復 bug 或測試失敗。",
                    source: "prompt-draft",
                    scenario: "bug",
                    bubble: "先縮小錯誤範圍。可用 diagnose。",
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

    mountSetupKeyPage(document.querySelector("#setup"), {
      fetchImpl,
      promptDraftDelayMs: 0,
    });
    const input = document.querySelector("[data-prompt-draft-input]");
    input.value = "fix the failing checkout test, it crashes in CI";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledWith(
        "http://127.0.0.1:5174/events",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "prompt:draft",
            source: "console",
            characterId: "cosmic-jellyfish",
            prompt: "fix the failing checkout test, it crashes in CI",
          }),
        })
      );
    });
    await waitFor(() => {
      expect(document.querySelector("[data-prompt-coach-status]").textContent)
        .toContain("先縮小錯誤範圍");
    });
    expect(document.querySelector("[data-polished-prompt-panel]").hidden)
      .toBe(true);
    expect(document.querySelector("[data-polished-prompt]").textContent)
      .toBe("");
    expect(document.querySelector("[data-copy-polished-prompt]").disabled)
      .toBe(true);
    expect(document.querySelector("[data-skill-hint]").textContent).toContain(
      "diagnose"
    );
    expect(document.querySelector("[data-next-step-title]").textContent)
      .toContain("先縮小錯誤範圍。可用 diagnose。");
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
      .toContain("重要");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:5174/events",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "tool:finish",
          source: "dashboard-hook-test",
          characterId: "cosmic-jellyfish",
          tool: "test",
          status: "failed",
        }),
      })
    );
  });

  it("sends active character with hook test events and stays useful without AI decisions", async () => {
    const fetchImpl = vi.fn(async (url, options = {}) => {
      if (url.endsWith("/settings/status")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: false,
            provider: null,
            model: null,
          }),
        };
      }

      if (url.endsWith("/events") && options.method === "DELETE") {
        return { ok: true, json: async () => ({ cleared: true }) };
      }

      if (url.endsWith("/events") && options.method === "POST") {
        expect(JSON.parse(options.body)).toEqual({
          type: "tool:finish",
          source: "dashboard-hook-test",
          characterId: "foam-ghost",
          tool: "test",
          status: "failed",
        });
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
                  source: "dashboard-hook-test",
                  characterId: "foam-ghost",
                  tool: "test",
                  status: "failed",
                },
              },
            ],
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
              summary: "Dashboard 已送出 hook 測試事件。",
              signals: ["test failed x1"],
            },
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    document.body.innerHTML = '<main id="setup"></main>';

    mountSetupKeyPage(document.querySelector("#setup"), { fetchImpl });
    document
      .querySelector('[data-character-option="foam-ghost"]')
      .click();
    document.querySelector("[data-send-test-event]").click();

    await waitFor(() => {
      expect(document.querySelector("[data-last-ai-decision]").textContent)
        .toContain("已送出 hook 測試事件");
    });
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

async function waitFor(assertion, timeoutMs = 1000) {
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
