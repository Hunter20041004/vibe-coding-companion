import { describe, expect, it, vi } from "vitest";
import { createCompanionConsoleWorkflow } from "../src/companion-console-workflow.js";

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
});
