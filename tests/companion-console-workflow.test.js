import { describe, expect, it, vi } from "vitest";
import {
  createCompanionConsoleWorkflow,
  createGuidedReadiness,
} from "../src/companion-console-workflow.js";

describe("Companion Console workflow", () => {
  it("loads status, session summary, and latest decision as one console snapshot", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === "http://local/settings/status") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            aiConfigured: true,
            provider: "google",
            model: "gemma-test",
          }),
        };
      }
      if (url === "http://local/session/summary") {
        return {
          ok: true,
          json: async () => ({
            summary: {
              title: "正在修測試失敗",
              phase: "debugging",
              signals: ["test failed x1"],
            },
          }),
        };
      }
      if (url === "http://local/events?since=0") {
        return {
          ok: true,
          json: async () => ({
            events: [
              { id: 1, event: { type: "tool:finish", tool: "test", status: "failed" } },
              {
                id: 2,
                event: {
                  type: "ai:decision",
                  state: "debugging",
                  skillHint: { skill: "diagnose", confidence: "high" },
                  nextStepAdvice: { title: "先縮小測試失敗範圍" },
                },
              },
            ],
          }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const workflow = createCompanionConsoleWorkflow({
      fetchImpl,
      statusEndpoint: "http://local/settings/status",
      sessionSummaryEndpoint: "http://local/session/summary",
      eventsEndpoint: "http://local/events",
    });

    await expect(workflow.loadSnapshot()).resolves.toMatchObject({
      status: {
        server: "online",
        ai: "configured",
        model: "gemma-test",
      },
      sessionSummary: {
        title: "正在修測試失敗",
        phase: "debugging",
      },
      latestDecision: {
        state: "debugging",
        skillHint: { skill: "diagnose" },
        nextStepAdvice: { title: "先縮小測試失敗範圍" },
      },
    });
  });

  it("loads readiness diagnostics for guided onboarding", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === "http://local/readiness/diagnostic") {
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
    const workflow = createCompanionConsoleWorkflow({
      fetchImpl,
      readinessEndpoint: "http://local/readiness/diagnostic",
    });

    await expect(workflow.loadReadinessDiagnostic()).resolves.toEqual({
      permissions: "ready",
      hooks: {
        codex: "ready",
        claudeCode: "missing",
      },
      promptWatcher: "ready",
    });
  });
});

describe("Guided readiness", () => {
  it("describes daily readiness items with actions, retry labels, and skip impact", () => {
    const readiness = createGuidedReadiness({
      status: { server: "offline", ai: "missing" },
      overlaySettingsState: "defaulted",
      permissions: "needs-action",
      hooks: {
        codex: "missing",
        claudeCode: "ready",
      },
      promptWatcher: "blocked",
    });

    expect(readiness.items.map((item) => item.id)).toEqual([
      "server",
      "overlay",
      "permissions",
      "codex-hooks",
      "claude-code-hooks",
      "ai-key",
      "prompt-watcher",
    ]);
    for (const item of readiness.items) {
      expect(item.why).toEqual(expect.any(String));
      expect(item.action).toEqual(expect.any(String));
      expect(item.retryLabel).toBe("重新檢查");
      expect(item.skipImpact).toEqual(expect.any(String));
    }
    expect(readiness.nextItem.id).toBe("server");
  });

  it("keeps AI key as an optional enhancement when the rest of readiness is complete", () => {
    const readiness = createGuidedReadiness({
      status: { server: "online", ai: "missing", model: "not set" },
      overlaySettingsState: "loaded",
      permissions: "ready",
      hooks: {
        codex: "ready",
        claudeCode: "ready",
      },
      promptWatcher: "ready",
    });

    expect(readiness.blocked).toBe(false);
    expect(readiness.nextItem).toEqual(null);
    expect(readiness.items.find((item) => item.id === "ai-key")).toEqual(
      expect.objectContaining({
        state: "optional",
        label: "AI key optional",
        action: expect.stringContaining("Vision context"),
      })
    );
  });
});
