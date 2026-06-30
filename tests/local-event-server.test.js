import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalEventServer } from "../src/local-event-server.js";

const servers = [];

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop().close();
  }
});

describe("Local event server", () => {
  it("accepts observable events over HTTP and returns events since a cursor", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "tool:finish",
        tool: "test",
        status: "failed",
      }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, id: 1 });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);

    expect(eventsResponse.status).toBe(200);
    expect(await eventsResponse.json()).toEqual({
      events: [
        {
          id: 1,
          event: {
            type: "tool:finish",
            tool: "test",
            status: "failed",
          },
        },
      ],
    });
  });

  it("clears captured events so tests and live sessions can start isolated", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "prompt:submitted" }),
    });

    const resetResponse = await fetch(`${server.url()}/events`, {
      method: "DELETE",
    });

    expect(resetResponse.status).toBe(200);
    expect(await resetResponse.json()).toEqual({ cleared: true });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);

    expect(await eventsResponse.json()).toEqual({ events: [] });
  });

  it("returns daily readiness diagnostics from a local-only endpoint", async () => {
    const server = createLocalEventServer({
      getReadinessDiagnostic: async () => ({
        permissions: "ready",
        hooks: {
          codex: "ready",
          claudeCode: "missing",
        },
        promptWatcher: "ready",
      }),
    });
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/readiness/diagnostic`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      permissions: "ready",
      hooks: {
        codex: "ready",
        claudeCode: "missing",
      },
      promptWatcher: "ready",
    });
  });

  it("allows browser console controls to clear events through CORS preflight", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/events`, {
      method: "OPTIONS",
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "DELETE"
    );
  });

  it("keeps event ids monotonic after clearing so active pollers do not miss new events", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "tool:start", tool: "test" }),
    });
    await fetch(`${server.url()}/events`, { method: "DELETE" });

    const response = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "tool:start", tool: "edit" }),
    });

    expect(await response.json()).toEqual({ accepted: true, id: 2 });

    const eventsResponse = await fetch(`${server.url()}/events?since=1`);

    expect(await eventsResponse.json()).toEqual({
      events: [
        {
          id: 2,
          event: { type: "tool:start", tool: "edit" },
        },
      ],
    });
  });

  it("clears transient hint suppression state while keeping event ids monotonic", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    const draft = {
      type: "prompt:draft",
      source: "console",
      prompt: "fix the failing checkout test and find the smallest repro",
    };

    const first = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    expect(await first.json()).toEqual({ accepted: true, id: 1 });

    const suppressed = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    expect(await suppressed.json()).toEqual({
      accepted: false,
      reason: "hint_suppressed",
    });

    await fetch(`${server.url()}/events`, { method: "DELETE" });

    const second = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    expect(await second.json()).toEqual({ accepted: true, id: 2 });
  });

  it("summarizes captured session events through a local-only endpoint", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    for (const event of [
      { type: "prompt:submitted" },
      { type: "tool:start", tool: "read" },
      { type: "tool:start", tool: "edit" },
      { type: "tool:finish", tool: "test", status: "failed" },
      { type: "ai:decision", state: "debugging" },
    ]) {
      await fetch(`${server.url()}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
      });
    }

    const response = await fetch(`${server.url()}/session/summary`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      summary: {
        title: "正在修測試失敗",
        phase: "debugging",
        summary: "你剛讀過脈絡、改過程式，測試目前仍失敗。",
        signals: ["read x1", "edit x1", "test failed x1"],
        confidence: "high",
      },
    });
  });

  it("appends an AI decision event after accepting a raw companion event", async () => {
    const classifyEvent = vi.fn(async () => ({
      state: "debugging",
      intensity: "high",
      motion: "panic",
      line: "Tests are being dramatic.",
    }));
    const server = createLocalEventServer({ classifyEvent });
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "tool:finish",
        tool: "test",
        status: "failed",
      }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, id: 1 });

    await waitFor(async () => {
      const eventsResponse = await fetch(`${server.url()}/events?since=0`);
      const payload = await eventsResponse.json();

      expect(payload.events).toEqual([
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
            sourceEventId: 1,
            state: "debugging",
            intensity: "high",
            motion: "panic",
            line: "Tests are being dramatic.",
            skillHint: {
              skill: "diagnose",
              confidence: "high",
              reason: "適合重現、定位並修復 bug 或測試失敗。",
            },
            nextStepAdvice: {
              title: "下一步可用 diagnose",
              action: "適合重現、定位並修復 bug 或測試失敗。",
              reason: "目前狀態是 debugging。",
              skill: "diagnose",
              priority: "medium",
              speakable: false,
            },
          },
        },
      ]);
    });
    expect(classifyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: {
          type: "tool:finish",
          tool: "test",
          status: "failed",
        },
        fallbackState: "error",
      })
    );
  });

  it("preserves active character when appending AI decisions for hook events", async () => {
    const classifyEvent = vi.fn(async () => ({
      state: "debugging",
      intensity: "high",
      motion: "panic",
      line: "Tests need attention.",
    }));
    const server = createLocalEventServer({ classifyEvent });
    servers.push(server);
    await server.listen(0);

    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "tool:finish",
        source: "dashboard-hook-test",
        characterId: "foam-ghost",
        tool: "test",
        status: "failed",
      }),
    });

    await waitFor(async () => {
      const eventsResponse = await fetch(`${server.url()}/events?since=0`);
      const payload = await eventsResponse.json();
      const decision = payload.events.find(
        (item) => item.event.type === "ai:decision"
      )?.event;

      expect(decision).toEqual(
        expect.objectContaining({
          type: "ai:decision",
          characterId: "foam-ghost",
          nextStepAdvice: expect.objectContaining({
            priority: "medium",
            skill: "diagnose",
            reason: "目前狀態是 debugging。",
            presentation: expect.objectContaining({
              characterId: "foam-ghost",
              title: "慢慢來：下一步可用 diagnose",
            }),
          }),
        })
      );
    });
  });

  it("turns prompt drafts into local advice without persisting the raw draft", async () => {
    const classifyEvent = vi.fn(async () => ({
      state: "thinking",
      intensity: "medium",
      motion: "wander",
      line: "This should not be called for drafts.",
    }));
    const server = createLocalEventServer({ classifyEvent });
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "prompt:draft",
        source: "accessibility",
        prompt: "fix the failing checkout test, it crashes in CI",
      }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, id: 1 });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);
    const payload = await eventsResponse.json();

    expect(payload.events).toEqual([
      {
        id: 1,
        event: {
          type: "ai:decision",
          source: "prompt:draft",
          state: "thinking",
          intensity: "medium",
          motion: "point",
          line: "先縮小錯誤範圍。可用 diagnose。",
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
    ]);
    expect(JSON.stringify(payload.events)).not.toContain("checkout test");
    expect(classifyEvent).not.toHaveBeenCalled();
  });

  it("stores prompt typing as content-free animation metadata", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "prompt:typing",
        source: "accessibility",
        provider: "codex",
        appName: "Codex",
        windowTitle: "Codex",
        prompt: "fix the secret checkout prompt",
      }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, id: 1 });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);
    const payload = await eventsResponse.json();

    expect(payload.events).toEqual([
      {
        id: 1,
        event: {
          type: "prompt:typing",
          source: "accessibility",
          provider: "codex",
          appName: "Codex",
          windowTitle: "Codex",
        },
      },
    ]);
    expect(JSON.stringify(payload.events)).not.toContain("checkout");
  });

  it("stays quiet for prompt drafts that do not produce a high-confidence skill", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "prompt:draft",
        source: "console",
        prompt: "improve this feature and make the code better",
      }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      accepted: false,
      reason: "draft_not_actionable",
    });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);
    expect(await eventsResponse.json()).toEqual({
      events: [
        {
          id: 1,
          event: {
            type: "prompt:stuck",
            source: "prompt-draft",
          },
        },
      ],
    });
  });

  it("characterizes prompt draft advice when the dashboard includes an active character", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "prompt:draft",
        source: "console",
        characterId: "foam-ghost",
        prompt: "fix the failing checkout test, it crashes in CI",
      }),
    });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);
    const payload = await eventsResponse.json();

    expect(payload.events).toEqual([
      {
        id: 1,
        event: expect.objectContaining({
          type: "ai:decision",
          source: "prompt:draft",
          characterId: "foam-ghost",
          skillHint: expect.objectContaining({
            skill: "diagnose",
            confidence: "high",
            source: "prompt-draft",
            scenario: "bug",
            characterId: "foam-ghost",
            presentation: {
              characterId: "foam-ghost",
              bubble: "先縮小錯誤範圍。可用 diagnose。",
            },
          }),
        }),
      },
    ]);
    expect(JSON.stringify(payload.events)).not.toContain("checkout test");
  });

  it("uses installed skill metadata when advising on prompt drafts", async () => {
    const loadInstalledSkills = vi.fn(async () => [
      {
        name: "diagnose",
        description:
          "Disciplined diagnosis loop for hard bugs, regressions, and failing tests.",
        path: "/skills/diagnose/SKILL.md",
      },
    ]);
    const server = createLocalEventServer({ loadInstalledSkills });
    servers.push(server);
    await server.listen(0);

    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "prompt:draft",
        source: "console",
        prompt: "fix the failing checkout test and find the smallest repro",
      }),
    });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);
    const payload = await eventsResponse.json();

    expect(payload.events[0].event.skillHint).toEqual({
      skill: "diagnose",
      confidence: "high",
      reason:
        "Disciplined diagnosis loop for hard bugs, regressions, and failing tests.",
      source: "prompt-draft",
      scenario: "bug",
      bubble: "先縮小錯誤範圍。可用 diagnose。",
    });
    expect(loadInstalledSkills).toHaveBeenCalledOnce();
  });

  it("ignores prompt drafts before they have enough signal", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "prompt:draft",
        source: "accessibility",
        prompt: "fix",
      }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      accepted: false,
      reason: "draft_not_actionable",
    });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);
    expect(await eventsResponse.json()).toEqual({ events: [] });
  });

  it("records local hint feedback metrics without storing prompt content", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "companion:hint_shown",
        skill: "diagnose",
        source: "prompt-draft",
        confidence: "high",
        scenario: "bug",
        prompt: "private checkout prompt",
      }),
    });
    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "companion:hint_helpful",
        skill: "diagnose",
        source: "prompt-draft",
        confidence: "high",
        scenario: "bug",
        prompt: "private checkout prompt",
      }),
    });
    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "companion:hint_dismissed",
        skill: "diagnose",
        source: "prompt-draft",
        confidence: "high",
        scenario: "bug",
      }),
    });

    const metricsResponse = await fetch(`${server.url()}/companion/metrics`);
    expect(await metricsResponse.json()).toEqual({
      metrics: {
        hintsShown: 1,
        helpful: 1,
        snoozed: 0,
        dismissed: 1,
        providerFocusChanges: 0,
        promptTypingEvents: 0,
      },
    });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);
    const payload = await eventsResponse.json();
    expect(JSON.stringify(payload.events)).not.toContain("checkout");
    expect(payload.events.map((item) => item.event)).toEqual([
      {
        type: "companion:hint_shown",
        skill: "diagnose",
        source: "prompt-draft",
        confidence: "high",
        scenario: "bug",
      },
      {
        type: "companion:hint_helpful",
        skill: "diagnose",
        source: "prompt-draft",
        confidence: "high",
        scenario: "bug",
      },
      {
        type: "companion:hint_dismissed",
        skill: "diagnose",
        source: "prompt-draft",
        confidence: "high",
        scenario: "bug",
      },
    ]);
  });

  it("snoozes future hints for the same skill and scenario", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "companion:hint_snoozed",
        skill: "diagnose",
        source: "prompt-draft",
        confidence: "high",
        scenario: "bug",
      }),
    });

    const response = await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "prompt:draft",
        source: "console",
        prompt: "fix the failing checkout test and find the smallest repro",
      }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      accepted: false,
      reason: "hint_suppressed",
    });

    const metricsResponse = await fetch(`${server.url()}/companion/metrics`);
    expect(await metricsResponse.json()).toEqual({
      metrics: {
        hintsShown: 0,
        helpful: 0,
        snoozed: 1,
        dismissed: 0,
        providerFocusChanges: 0,
        promptTypingEvents: 0,
      },
    });
  });

  it("uses recent high-friction work context before prompt draft recommendations", async () => {
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    for (const event of [
      { type: "tool:finish", tool: "test", status: "failed" },
      { type: "tool:finish", tool: "test", status: "failed" },
    ]) {
      await fetch(`${server.url()}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
      });
    }

    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "prompt:draft",
        source: "console",
        prompt: "調整 overlay UI layout，讓提示泡泡更像助手",
      }),
    });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);
    const payload = await eventsResponse.json();
    const decision = payload.events.find(
      (item) => item.event.source === "prompt:draft"
    )?.event;

    expect(decision.skillHint).toEqual({
      skill: "diagnose",
      confidence: "high",
      reason: "最近測試連續失敗，工作事件優先於草稿內容。",
      source: "work-event",
      scenario: "bug",
      bubble: "先縮小錯誤範圍。可用 diagnose。",
    });
  });

  it("creates one handoff hint when focus moves between agent providers", async () => {
    let now = 1000;
    const server = createLocalEventServer({ getNow: () => now });
    servers.push(server);
    await server.listen(0);

    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "agent:focus",
        provider: "codex",
        appName: "Codex",
        windowTitle: "Codex",
        prompt: "private prompt",
      }),
    });
    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "prompt:draft",
        source: "console",
        provider: "codex",
        prompt: "調整 overlay UI layout，讓提示泡泡更像助手",
      }),
    });

    now = 1200;
    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "agent:focus",
        provider: "claude-code",
        appName: "Claude",
        windowTitle: "Claude Code",
        conversation: "private conversation",
      }),
    });
    await fetch(`${server.url()}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "agent:focus",
        provider: "codex",
        appName: "Codex",
        windowTitle: "Codex",
      }),
    });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);
    const payload = await eventsResponse.json();
    const handoffDecisions = payload.events
      .map((item) => item.event)
      .filter((event) => event.type === "ai:decision" && event.source === "handoff");

    expect(handoffDecisions).toEqual([
      {
        type: "ai:decision",
        source: "handoff",
        state: "thinking",
        intensity: "medium",
        motion: "point",
        line: "剛才在 Codex 做 UI。先檢查畫面狀態。可用 frontend-design。",
        skillHint: {
          skill: "frontend-design",
          confidence: "high",
          reason: "剛才在 Codex 有明確 UI 工作脈絡。",
          source: "handoff",
          scenario: "ui",
          bubble: "剛才在 Codex 做 UI。先檢查畫面狀態。可用 frontend-design。",
        },
      },
    ]);
    expect(JSON.stringify(payload.events)).not.toContain("private");
  });

  it("saves a Google AI Studio key through a local-only settings endpoint without echoing it", async () => {
    const saveGoogleAiStudioKey = vi.fn(async () => {});
    const server = createLocalEventServer({ saveGoogleAiStudioKey });
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/settings/google-ai-key`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "new-google-key" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      saved: true,
      provider: "google",
      model: "gemma-4-31b-it",
    });
    expect(saveGoogleAiStudioKey).toHaveBeenCalledWith({
      apiKey: "new-google-key",
      model: "gemma-4-31b-it",
    });
  });

  it("reports companion settings status without exposing the API key", async () => {
    const server = createLocalEventServer({
      getSettingsStatus: () => ({
        aiConfigured: true,
        provider: "google",
        model: "gemma-4-31b-it",
      }),
    });
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/settings/status`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      aiConfigured: true,
      provider: "google",
      model: "gemma-4-31b-it",
    });
  });

  it("reads and saves overlay calibration settings through local-only endpoints", async () => {
    const getOverlaySettings = vi.fn(async () => ({
      idleSize: 76,
      activeScale: 1,
      wanderSpeed: 1,
      safeMargin: 24,
    }));
    const saveOverlaySettings = vi.fn(async (settings) => ({
      ...settings,
      idleSize: 88,
    }));
    const server = createLocalEventServer({
      getOverlaySettings,
      saveOverlaySettings,
    });
    servers.push(server);
    await server.listen(0);

    const getResponse = await fetch(`${server.url()}/settings/overlay`);
    expect(await getResponse.json()).toEqual({
      settings: {
        idleSize: 76,
        activeScale: 1,
        wanderSpeed: 1,
        safeMargin: 24,
      },
    });

    const postResponse = await fetch(`${server.url()}/settings/overlay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idleSize: 200,
        activeScale: 1.2,
        wanderSpeed: 1.4,
        safeMargin: 32,
      }),
    });

    expect(postResponse.status).toBe(200);
    expect(await postResponse.json()).toEqual({
      saved: true,
      settings: {
        idleSize: 88,
        activeScale: 1.2,
        wanderSpeed: 1.4,
        safeMargin: 32,
      },
    });
    expect(saveOverlaySettings).toHaveBeenCalledWith({
      idleSize: 200,
      activeScale: 1.2,
      wanderSpeed: 1.4,
      safeMargin: 32,
    });
  });

  it("reports placement diagnostics through a local-only endpoint", async () => {
    const getPlacementDiagnostic = vi.fn(async ({ state, safeZone }) => ({
      ok: true,
      state,
      safeZone,
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
    }));
    const server = createLocalEventServer({ getPlacementDiagnostic });
    servers.push(server);
    await server.listen(0);

    const response = await fetch(
      `${server.url()}/placement/diagnostic?state=coding&safeZone=bottom-right`
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      state: "coding",
      safeZone: "bottom-right",
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
    });
    expect(getPlacementDiagnostic).toHaveBeenCalledWith({
      state: "coding",
      safeZone: "bottom-right",
      settingsOverride: {},
    });
  });

  it("passes preferred side preview overrides to placement diagnostics", async () => {
    const getPlacementDiagnostic = vi.fn(async () => ({
      ok: true,
      state: "coding",
      safeZone: "right-edge",
      placementMode: "geometry-fallback",
      foreground: { appName: "Codex", visible: true },
      accessibility: { regionCount: 0, status: "empty" },
      avoidRegionCount: 3,
      chosenBounds: { x: 108, y: 333, width: 132, height: 156 },
    }));
    const server = createLocalEventServer({ getPlacementDiagnostic });
    servers.push(server);
    await server.listen(0);

    await fetch(
      `${server.url()}/placement/diagnostic?state=coding&safeZone=right-edge&preferredSide=left`
    );

    expect(getPlacementDiagnostic).toHaveBeenCalledWith({
      state: "coding",
      safeZone: "right-edge",
      settingsOverride: { preferredSide: "left" },
    });
  });

  it("analyzes a user-approved screenshot without echoing the image payload", async () => {
    const analyzeVisionContext = vi.fn(async () => ({
      activity: "Looking at Codex test output.",
      suggestedState: "testing",
      confidence: 0.74,
      visibleSignals: ["terminal", "test output"],
    }));
    const server = createLocalEventServer({ analyzeVisionContext });
    servers.push(server);
    await server.listen(0);

    const response = await fetch(`${server.url()}/vision/context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: "data:image/png;base64,ZmFrZQ==",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      context: {
        activity: "Looking at Codex test output.",
        suggestedState: "testing",
        confidence: 0.74,
        visibleSignals: ["terminal", "test output"],
      },
    });
    expect(analyzeVisionContext).toHaveBeenCalledWith({
      imageDataUrl: "data:image/png;base64,ZmFrZQ==",
    });
  });

  it("publishes a vision context decision event for overlay pollers", async () => {
    const analyzeVisionContext = vi.fn(async () => ({
      activity: "Reviewing a failed test panel in Codex.",
      suggestedState: "error",
      confidence: 0.86,
      visibleSignals: ["failed test", "Codex panel"],
      safeZone: "bottom-right",
    }));
    const server = createLocalEventServer({ analyzeVisionContext });
    servers.push(server);
    await server.listen(0);

    await fetch(`${server.url()}/vision/context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: "data:image/png;base64,ZmFrZQ==",
      }),
    });

    const eventsResponse = await fetch(`${server.url()}/events?since=0`);
    const payload = await eventsResponse.json();

    expect(payload.events).toEqual([
      {
        id: 1,
        event: {
          type: "ai:decision",
          source: "vision:context",
          state: "error",
          intensity: "high",
          motion: "panic",
          line: "Reviewing a failed test panel in Codex.",
          visibleSignals: ["failed test", "Codex panel"],
          safeZone: "bottom-right",
          skillHint: {
            skill: "diagnose",
            confidence: "high",
            reason: "適合重現、定位並修復 bug 或測試失敗。",
          },
        },
      },
    ]);
    expect(JSON.stringify(payload.events)).not.toContain("ZmFrZQ==");
  });
});

async function waitFor(assertion, timeoutMs = 250) {
  const start = Date.now();
  let lastError;

  while (Date.now() - start < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw lastError;
}
